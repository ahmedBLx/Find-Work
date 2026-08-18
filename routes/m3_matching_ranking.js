const express = require('express');
const router = express.Router();
const { callN8nWebhook } = require('../utils/n8n_helper');

const matchSynonyms = {
  'js': ['javascript', 'js', 'typescript', 'ts'],
  'javascript': ['javascript', 'js', 'typescript', 'ts'],
  'typescript': ['javascript', 'js', 'typescript', 'ts'],
  'ts': ['javascript', 'js', 'typescript', 'ts'],
  'postgres': ['postgresql', 'postgres', 'sql'],
  'postgresql': ['postgresql', 'postgres', 'sql'],
  'sql': ['sql', 'postgresql', 'postgres', 'sqlite', 'mysql', 'mongodb'],
  'mongo': ['mongodb', 'mongo', 'nosql', 'sql'],
  'mongodb': ['mongodb', 'mongo', 'nosql', 'sql'],
  'python': ['python', 'py'],
  'react': ['react', 'react.js', 'reactjs', 'frontend'],
  'node': ['node', 'node.js', 'nodejs', 'backend'],
  'node.js': ['node', 'node.js', 'nodejs', 'backend']
};

function runServerMatching(candidate, jobs, method = 'hybrid') {
  const candSkills = [
    ...(candidate.technical_skills || []),
    ...(candidate.programming_languages || []),
    ...(candidate.frameworks || []),
    ...(candidate.tools || []),
    ...(candidate.databases || [])
  ].map(s => s.toLowerCase().trim());

  function checkSkillMatch(skill) {
    const sLower = skill.toLowerCase().trim();
    if (candSkills.some(cs => cs === sLower || cs.includes(sLower) || sLower.includes(cs))) return true;
    for (const key in matchSynonyms) {
      if (matchSynonyms[key].includes(sLower) && matchSynonyms[key].some(syn => candSkills.includes(syn))) {
        return true;
      }
    }
    return false;
  }

  const candTitles = [
    ...(candidate.preferred_roles || []),
    ...(candidate.job_titles || []),
    'software engineer', 'backend engineer', 'developer'
  ].map(t => t.toLowerCase().trim());
  
  const candKeywords = (candidate.keywords || candidate.technical_skills || []).map(k => k.toLowerCase().trim());
  
  let candExp = candidate.experience_years || 0;
  if (candExp === 0 && Array.isArray(candidate.experience) && candidate.experience.length > 0) {
    candExp = candidate.experience.reduce((sum, e) => sum + (e.duration_years || 1), 0);
  }
  if (candExp === 0 && ((candidate.projects || []).length > 0 || (candidate.education || []).length > 0)) {
    candExp = 2.0;
  }

  const scored = jobs.map(job => {
    const reqSkills = job.required_skills || [];
    const matched = [];
    const missing = [];
    reqSkills.forEach(s => {
      if (checkSkillMatch(s)) matched.push(s);
      else missing.push(s);
    });

    const keywordScore = reqSkills.length > 0
      ? (matched.length / reqSkills.length) * 100
      : 85;

    let titleSim = 0.5;
    const jobTitleLower = (job.job_title || '').toLowerCase();
    const isTitleMatch = candTitles.some(title => jobTitleLower.includes(title));
    if (isTitleMatch) titleSim = 1.0;

    let kwSim = 0.5;
    const jobDescLower = (job.description || job.job_title || '').toLowerCase();
    if (candKeywords.length > 0) {
      const matchedKw = candKeywords.filter(kw => jobDescLower.includes(kw));
      kwSim = Math.max(matchedKw.length / candKeywords.length, 0.4);
    } else {
      kwSim = 0.8;
    }
    const semanticSimilarity = (titleSim * 0.5) + (kwSim * 0.5);
    const semanticScore = semanticSimilarity * 100;

    const reqExp = job.required_experience_years || 2.0;
    const satisfied = candExp >= reqExp;
    const experienceScore = reqExp > 0 ? Math.min((candExp / reqExp) * 100, 100) : 100;

    let finalScore = 0;
    if (method === 'keyword') {
      finalScore = parseFloat(keywordScore.toFixed(1));
    } else if (method === 'semantic') {
      finalScore = parseFloat(semanticScore.toFixed(1));
    } else {
      const wKeyword = 0.35;
      const wSemantic = 0.35;
      const wExperience = 0.30;
      finalScore = parseFloat(((keywordScore * wKeyword) + (semanticScore * wSemantic) + (experienceScore * wExperience)).toFixed(1));
    }

    let decision = 'SKIP';
    if (finalScore >= 75) decision = 'APPLY';
    else if (finalScore >= 50) decision = 'REVIEW';

    let explanation = `Scored ${finalScore}% based on ${matched.length}/${reqSkills.length} matched skills (${matched.slice(0, 4).join(', ')}). Role similarity: ${Math.round(semanticScore)}%. Experience: ${candExp} yrs vs ${reqExp} yrs required.`;

    return {
      schema_version: "1.0",
      job_id: job.job_id,
      company: job.company,
      job_title: job.job_title,
      location: job.location,
      source: job.source,
      description: job.description,
      application_url: job.application_url,
      required_skills: reqSkills,
      match_score: finalScore,
      score_breakdown: {
        keyword_score: parseFloat(keywordScore.toFixed(1)),
        semantic_score: parseFloat(semanticScore.toFixed(1)),
        experience_score: parseFloat(experienceScore.toFixed(1)),
        weights: {
          keyword: 0.35,
          semantic: 0.35,
          experience: 0.30
        }
      },
      matched_skills: matched,
      missing_skills: missing,
      experience_match: {
        candidate_years: candExp,
        required_years: reqExp,
        satisfied: satisfied
      },
      pass_threshold: 75,
      decision: decision,
      explanation: explanation
    };
  });

  scored.sort((a, b) => {
    if (b.match_score !== a.match_score) {
      return b.match_score - a.match_score;
    }
    return a.job_id.localeCompare(b.job_id);
  });

  return scored;
}

// POST /api/match/rank
router.post('/rank', async (req, res) => {
  try {
    const { candidate_profile, jobs, method } = req.body;
    if (!candidate_profile) {
      return res.status(400).json({ success: false, message: 'candidate_profile is required.' });
    }
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ success: false, message: 'jobs must be a non-empty array.' });
    }

    try {
      const n8nRes = await callN8nWebhook('m3-matching-ranking', req.body);
      const responseData = Array.isArray(n8nRes.data) ? n8nRes.data[0] : n8nRes.data;
      if (n8nRes.statusCode >= 200 && n8nRes.statusCode < 300 && responseData && responseData.ranked_jobs) {
        const ranked_jobs = responseData.ranked_jobs;
        return res.status(200).json({
          success: true,
          ranked_jobs,
          summary: {
            total: ranked_jobs.length,
            apply_count: ranked_jobs.filter(j => j.decision === 'APPLY').length,
            review_count: ranked_jobs.filter(j => j.decision === 'REVIEW').length,
            skip_count: ranked_jobs.filter(j => j.decision === 'SKIP').length
          }
        });
      }
    } catch (n8nErr) {
      // Proceed to authoritative server matching
    }

    const ranked_jobs = runServerMatching(candidate_profile, jobs, method || 'hybrid');
    return res.status(200).json({
      success: true,
      ranked_jobs,
      summary: {
        total: ranked_jobs.length,
        apply_count: ranked_jobs.filter(j => j.decision === 'APPLY').length,
        review_count: ranked_jobs.filter(j => j.decision === 'REVIEW').length,
        skip_count: ranked_jobs.filter(j => j.decision === 'SKIP').length
      }
    });
  } catch (error) {
    console.error('M3 Rank Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
module.exports.runServerMatching = runServerMatching;
module.exports.matchSynonyms = matchSynonyms;
