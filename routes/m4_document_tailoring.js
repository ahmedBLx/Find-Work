const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { generateValidPDF } = require('../utils/pdf_generator');

// POST /api/documents/assemble
router.post('/assemble', (req, res) => {
  try {
    const { candidate_id, job_id, company, job_title, tailored_cv_text, latex_code, cover_letter_text } = req.body;
    if (!candidate_id || !job_id) {
      return res.status(400).json({ success: false, message: 'candidate_id and job_id are required.' });
    }

    const safeCandId = (candidate_id || 'cand').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 16);
    const safeJobId = (job_id || 'job').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 16);
    
    const baseName = `${safeCandId}_${safeJobId}`;
    const texPath = path.join(__dirname, '..', 'outputs', `${baseName}_tailored.tex`);
    const pdfPath = path.join(__dirname, '..', 'outputs', `${baseName}_tailored.pdf`);
    const txtPath = path.join(__dirname, '..', 'outputs', `${baseName}_cover_letter.txt`);

    if (latex_code) {
      fs.writeFileSync(texPath, latex_code, 'utf8');
    }

    const finalCoverText = cover_letter_text || `Dear Hiring Manager at ${company || 'the Company'},\n\nI am writing to express my strong interest in the ${job_title || 'open'} position.\n\nSincerely,\nCandidate`;
    fs.writeFileSync(txtPath, finalCoverText, 'utf8');

    const pdfTitle = `Tailored CV - ${job_title || 'Position'} at ${company || 'Company'}`;
    const cvContent = tailored_cv_text || latex_code || `${job_title} Application`;
    generateValidPDF(pdfPath, pdfTitle, cvContent);

    return res.status(200).json({
      success: true,
      cv_pdf_file: `outputs/${baseName}_tailored.pdf`,
      cover_letter_file: `outputs/${baseName}_cover_letter.txt`,
      tex_file: `outputs/${baseName}_tailored.tex`
    });
  } catch (error) {
    console.error('Assemble error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/cv/generate-tailored
router.post('/generate-tailored', (req, res) => {
  try {
    const { candidate_profile, job } = req.body;
    if (!candidate_profile || !job) {
      return res.status(400).json({ success: false, message: 'candidate_profile and job are required.' });
    }

    const candName = candidate_profile.candidate_name || 'Candidate';
    const email = candidate_profile.email || 'candidate@example.com';
    const phone = candidate_profile.phone || '';
    const candSkills = (candidate_profile.technical_skills || candidate_profile.programming_languages || []).join(', ') || 'Software Engineering';
    const candProjects = Array.isArray(candidate_profile.projects) && candidate_profile.projects.length > 0 
      ? candidate_profile.projects.map(p => typeof p === 'string' ? p : (p.name || p.title || 'Software Project')).join(', ')
      : 'Full-stack Systems, Algorithm Optimization, RESTful APIs';
    
    const eduInstitution = (candidate_profile.education && candidate_profile.education[0]) ? candidate_profile.education[0].institution : 'University';
    const eduDegree = (candidate_profile.education && candidate_profile.education[0]) ? candidate_profile.education[0].degree : 'Computer Science';
    const eduYear = (candidate_profile.education && candidate_profile.education[0]) ? candidate_profile.education[0].year : '';

    const company = job.company || 'the Target Company';
    const jobTitle = job.job_title || 'Software Engineer';
    const matchedSkills = Array.isArray(job.matched_skills) && job.matched_skills.length > 0 
      ? job.matched_skills.join(', ') 
      : (candSkills || 'Modern Technologies');

    const rawCandId = candidate_profile.candidate_id || 'cand_' + Math.random().toString(36).substr(2, 6);
    const rawJobId = job.job_id || 'job_' + Math.random().toString(36).substr(2, 6);

    const safeCandId = rawCandId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 16);
    const safeJobId = rawJobId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 16);
    const baseName = `${safeCandId}_${safeJobId}`;

    // 1. Synthesize Contextual Cover Letter
    const coverLetter = `Dear Hiring Team at ${company},

I am writing to express my strong enthusiasm for the ${jobTitle} position at ${company}. Having followed your company's technical initiatives and engineering excellence, I am eager to bring my strong foundations in ${candSkills} to your team.

With my academic background in ${eduDegree} from ${eduInstitution}${eduYear ? ' (' + eduYear + ')' : ''} and practical experience architecting high-performance systems such as ${candProjects}, I have developed deep proficiency in designing scalable backend workflows, RESTful microservices, and database optimization. My hands-on skills in ${matchedSkills} align directly with the key requirements of this role.

I am particularly excited about the opportunity to contribute to ${company}'s forward-looking projects by applying clean code principles, robust architectural patterns, and collaborative problem-solving.

Thank you for your time and consideration. I welcome the opportunity to discuss how my technical expertise and passion can support your engineering goals.

Sincerely,
${candName}
${email}${phone ? ' | ' + phone : ''}`;

    // 2. Synthesize Tailored LaTeX Resume
    const latexCode = `% Tailored LaTeX resume for ${candName}
\\documentclass{article}
\\usepackage{geometry}
\\geometry{a4paper, margin=0.8in}
\\begin{document}
\\begin{center}
  {\\LARGE \\textbf{${candName}}} \\\\
  \\vspace{2mm}
  \\textbf{Email:} ${email} ${phone ? '| \\textbf{Phone:} ' + phone : ''} \\\\
  \\textbf{Target Position:} ${jobTitle} at ${company}
\\end{center}

\\section*{Professional Profile}
Dedicated software engineer with a strong academic foundation from ${eduInstitution} (${eduDegree}). Proven expertise in ${candSkills}. Highly motivated to contribute to ${company} as a ${jobTitle} by building resilient, production-ready solutions.

\\section*{Core Technical Competencies}
\\textbf{Role-Aligned Skills:} ${matchedSkills} \\\\
\\textbf{All Technologies:} ${candSkills}

\\section*{Key Projects \\& Practical Experience}
\\textbf{Featured Engineering Implementations:} ${candProjects} \\\\
Designed and deployed high-performance software modules, optimized algorithmic data flows, and maintained comprehensive testing coverage.

\\section*{Education}
\\textbf{${eduDegree}} -- ${eduInstitution} ${eduYear ? '(' + eduYear + ')' : ''}

\\end{document}`;

    // 3. Compile and write files to outputs/
    const texPath = path.join(__dirname, '..', 'outputs', `${baseName}_tailored.tex`);
    const pdfPath = path.join(__dirname, '..', 'outputs', `${baseName}_tailored.pdf`);
    const txtPath = path.join(__dirname, '..', 'outputs', `${baseName}_cover_letter.txt`);

    fs.writeFileSync(texPath, latexCode, 'utf8');
    fs.writeFileSync(txtPath, coverLetter, 'utf8');

    const pdfTitle = `${candName} - Tailored CV for ${jobTitle} at ${company}`;
    const cvTextContent = `${candName}\n${email} ${phone}\nTarget Position: ${jobTitle} at ${company}\nEducation: ${eduDegree} - ${eduInstitution}\nCore Skills: ${matchedSkills}\nAll Skills: ${candSkills}\nKey Projects: ${candProjects}`;
    generateValidPDF(pdfPath, pdfTitle, cvTextContent);

    return res.status(200).json({
      success: true,
      candidate_id: safeCandId,
      job_id: safeJobId,
      cv_pdf_file: `outputs/${baseName}_tailored.pdf`,
      cover_letter_file: `outputs/${baseName}_cover_letter.txt`,
      tex_file: `outputs/${baseName}_tailored.tex`,
      latex_code: latexCode,
      cover_letter_text: coverLetter
    });
  } catch (err) {
    console.error('Tailoring Generation Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
