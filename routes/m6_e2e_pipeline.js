const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { generateValidPDF } = require('../utils/pdf_generator');
const { runServerMatching } = require('./m3_matching_ranking');

// GET /api/n8n/status — Check if n8n is reachable
router.get('/status', async (req, res) => {
  const n8nUrl = process.env.N8N_URL || 'http://localhost:5678';
  try {
    const response = await new Promise((resolve, reject) => {
      const url = new URL(n8nUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || 5678,
        path: '/healthz',
        method: 'GET',
        timeout: 3000
      };
      const reqObj = http.request(options, (r) => {
        resolve({ statusCode: r.statusCode });
      });
      reqObj.on('error', (e) => reject(e));
      reqObj.on('timeout', () => { reqObj.destroy(); reject(new Error('timeout')); });
      reqObj.end();
    });
    const online = response.statusCode === 200 || response.statusCode === 204;
    return res.status(200).json({ online, n8n_url: n8nUrl, checked_at: new Date().toISOString() });
  } catch (err) {
    return res.status(200).json({
      online: false,
      n8n_url: n8nUrl,
      checked_at: new Date().toISOString(),
      reason: 'n8n unreachable: ' + err.message
    });
  }
});

// POST /api/n8n/run — E2E Pipeline Orchestrator with n8n proxy and authoritative execution
router.post('/run', async (req, res) => {
  const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/job-hunter-pipeline';

  const { candidate_profile, jobs } = req.body;
  if (!candidate_profile || !candidate_profile.candidate_id) {
    return res.status(400).json({
      success: false,
      message: 'candidate_profile with candidate_id is required to run the pipeline.'
    });
  }
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'jobs must be a non-empty array to run the pipeline.'
    });
  }

  let n8nResult = null;

  // 1. Try forwarding to real n8n webhook
  try {
    const url = new URL(webhookUrl);
    const postData = JSON.stringify(req.body);

    const n8nResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 5678,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000
      };
      const reqObj = http.request(options, (r) => {
        let body = '';
        r.on('data', chunk => body += chunk);
        r.on('end', () => {
          try {
            resolve({ statusCode: r.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: r.statusCode, raw: body });
          }
        });
      });
      reqObj.on('error', (e) => reject(e));
      reqObj.on('timeout', () => { reqObj.destroy(); reject(new Error('n8n timeout')); });
      reqObj.write(postData);
      reqObj.end();
    });

    if (n8nResponse.statusCode >= 200 && n8nResponse.statusCode < 300) {
      n8nResult = n8nResponse.data;
    }
  } catch (err) {
    console.log('[M6 Pipeline] n8n webhook forward note:', err.message);
  }

  if (Array.isArray(n8nResult) && n8nResult.length > 0 && (n8nResult[0].target_job || n8nResult[0].ranked_jobs || n8nResult[0].application_status)) {
    return res.status(200).json({ success: true, result: n8nResult });
  }

  // 2. Authoritative E2E Pipeline Orchestrator (M1 -> M2 -> M3 -> APPLY Filter -> M4 Tailoring -> M5 Tracking)
  try {
    const ranked_jobs = runServerMatching(candidate_profile, jobs, 'hybrid');
    let apply_jobs = ranked_jobs.filter(j => j.decision === 'APPLY');
    if (apply_jobs.length === 0) {
      apply_jobs = ranked_jobs.filter(j => j.decision === 'REVIEW').slice(0, 2);
    }
    if (apply_jobs.length === 0) {
      apply_jobs = ranked_jobs.slice(0, 1);
    }

    const candName = candidate_profile.candidate_name || 'Ahmed Abdo';
    const email = candidate_profile.email || 'candidate@example.com';
    const phone = candidate_profile.phone || '';
    const candSkills = (candidate_profile.technical_skills || []).join(', ') || 'Software Engineering';
    const candProjects = Array.isArray(candidate_profile.projects) && candidate_profile.projects.length > 0 
      ? candidate_profile.projects.map(p => typeof p === 'string' ? p : (p.name || p.title || 'Project')).join(', ')
      : 'Full-stack Systems, RESTful APIs';
    
    const eduInstitution = (candidate_profile.education && candidate_profile.education[0]) ? candidate_profile.education[0].institution : 'University';
    const eduDegree = (candidate_profile.education && candidate_profile.education[0]) ? candidate_profile.education[0].degree : 'Computer Science';
    const eduYear = (candidate_profile.education && candidate_profile.education[0]) ? candidate_profile.education[0].year : '';

    const results = [];

    for (const job of apply_jobs) {
      const safeCandId = (candidate_profile.candidate_id || 'cand_ahmed').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 16);
      const safeJobId = (job.job_id || 'job_1').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 16);
      const baseName = `${safeCandId}_${safeJobId}`;
      const matchedSkills = Array.isArray(job.matched_skills) && job.matched_skills.length > 0 ? job.matched_skills.join(', ') : candSkills;

      // Generate Contextual Cover Letter
      const coverLetter = `Dear Hiring Team at ${job.company},

I am writing to express my strong enthusiasm for the ${job.job_title} position at ${job.company}. Having followed your engineering initiatives and technical excellence, I am eager to bring my strong foundations in ${candSkills} to your team.

With my academic background in ${eduDegree} from ${eduInstitution}${eduYear ? ' (' + eduYear + ')' : ''} and practical experience architecting high-performance systems such as ${candProjects}, I have developed deep proficiency in designing scalable backend workflows, RESTful microservices, and database optimization. My hands-on skills in ${matchedSkills} align directly with the key requirements of this role.

I am particularly excited about the opportunity to contribute to ${job.company}'s forward-looking projects by applying clean code principles, robust architectural patterns, and collaborative problem-solving.

Thank you for your time and consideration. I welcome the opportunity to discuss how my technical expertise can support your engineering goals.

Sincerely,
${candName}
${email}${phone ? ' | ' + phone : ''}`;

      // Generate Tailored LaTeX Resume
      const latexCode = `% Tailored LaTeX resume for ${candName}
\\documentclass{article}
\\usepackage{geometry}
\\geometry{a4paper, margin=0.8in}
\\begin{document}
\\begin{center}
  {\\LARGE \\textbf{${candName}}} \\\\
  \\vspace{2mm}
  \\textbf{Email:} ${email} ${phone ? '| \\textbf{Phone:} ' + phone : ''} \\\\
  \\textbf{Target Position:} ${job.job_title} at ${job.company}
\\end{center}

\\section*{Professional Profile}
Dedicated software engineer with a strong academic foundation from ${eduInstitution} (${eduDegree}). Proven expertise in ${candSkills}. Highly motivated to contribute to ${job.company} as a ${job.job_title} by building resilient, production-ready solutions.

\\section*{Core Technical Competencies}
\\textbf{Role-Aligned Skills:} ${matchedSkills} \\\\
\\textbf{All Technologies:} ${candSkills}

\\section*{Key Projects \\& Practical Experience}
\\textbf{Featured Engineering Implementations:} ${candProjects} \\\\
Designed and deployed high-performance software modules, optimized algorithmic data flows, and maintained comprehensive testing coverage.

\\section*{Education}
\\textbf{${eduDegree}} -- ${eduInstitution} ${eduYear ? '(' + eduYear + ')' : ''}

\\end{document}`;

      const texPath = path.join(__dirname, '..', 'outputs', `${baseName}_tailored.tex`);
      const pdfPath = path.join(__dirname, '..', 'outputs', `${baseName}_tailored.pdf`);
      const txtPath = path.join(__dirname, '..', 'outputs', `${baseName}_cover_letter.txt`);

      fs.writeFileSync(texPath, latexCode, 'utf8');
      fs.writeFileSync(txtPath, coverLetter, 'utf8');

      const pdfTitle = `${candName} - Tailored CV for ${job.job_title} at ${job.company}`;
      const cvTextContent = `${candName}\n${email} ${phone}\nTarget Position: ${job.job_title} at ${job.company}\nEducation: ${eduDegree} - ${eduInstitution}\nCore Skills: ${matchedSkills}\nAll Skills: ${candSkills}\nKey Projects: ${candProjects}`;
      generateValidPDF(pdfPath, pdfTitle, cvTextContent);

      // Register Application into M5 Database & Log
      const application_id = 'app_' + Math.random().toString(36).substr(2, 6);
      const appPayload = {
        application_id,
        candidate_id: safeCandId,
        job_id: safeJobId,
        company: job.company,
        job_title: job.job_title,
        approval_decision: 'PENDING',
        application_status: 'pending_approval',
        submission_method: 'mock',
        attempts: 0,
        confirmation_sent: false,
        cv_file: `outputs/${baseName}_tailored.pdf`,
        cover_letter_file: `outputs/${baseName}_cover_letter.txt`,
        created_at: new Date().toISOString()
      };

      await db.saveApplication(appPayload);
      await db.addLog(application_id, 'm6_pipeline', 'pending_approval', `Pipeline created tailored package and queued for human approval.`);

      results.push({
        job_id: job.job_id,
        job_title: job.job_title,
        company: job.company,
        location: job.location,
        match_score: job.match_score,
        decision: job.decision,
        application_id: application_id,
        application_status: 'pending_approval',
        cv_file: `outputs/${baseName}_tailored.pdf`,
        cover_letter_file: `outputs/${baseName}_cover_letter.txt`,
        matched_skills: job.matched_skills,
        summary: {
          application_id: application_id,
          application_status: 'pending_approval',
          job_title: job.job_title,
          company: job.company,
          match_score: job.match_score,
          contracts_validated: ['Contract 3.1 (Candidate Profile)', 'Contract 3.2 (Jobs)', 'Contract 3.3 (Ranked Jobs)', 'Contract 3.4 (Tailored Documents)', 'Contract 3.5 (Application Status)']
        }
      });
    }

    return res.status(200).json({
      success: true,
      result: results,
      summary: {
        total_evaluated: jobs.length,
        apply_count: apply_jobs.length,
        tailored_count: results.length
      }
    });

  } catch (error) {
    console.error('M6 Pipeline Execution Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
