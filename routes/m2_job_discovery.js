const express = require('express');
const router = express.Router();
const https = require('https');
const path = require('path');
const fs = require('fs');

const mockSourceA = [
  {
    "id": "job_a_01",
    "title": "Backend Engineer",
    "company": "Tech Innovations Inc.",
    "loc": "New York, NY",
    "url": "https://techinnovations.example/apply/job_001",
    "desc": "We are looking for a Backend Engineer with strong expertise in Node.js, Express, and SQL databases. You will design and deploy REST APIs and work with Docker. Experience with React is a plus. Candidates should have a BS in Computer Science and at least 3 years of experience.",
    "skills_required": "Node.js, Express, SQL, Docker, REST APIs",
    "experience_req_years": 3,
    "posted": "2026-08-13T10:00:00Z"
  },
  {
    "id": "job_a_02",
    "title": "Data Scientist",
    "company": "Data Insights Corp.",
    "loc": "Boston, MA",
    "url": "https://datainsights.example/jobs/data-scientist",
    "desc": "Seeking a Data Scientist to build machine learning models in Python. Experience with Pandas, NumPy, Scikit-Learn, and SQL is required. PyTorch or TensorFlow is preferred. PhD or MS in Statistics/CS required. Minimum 5 years experience.",
    "skills_required": "Python, Pandas, SQL, Machine Learning",
    "experience_req_years": 5,
    "posted": "2026-08-13T09:00:00Z"
  }
];

const mockSourceB = [
  {
    "id": "job_b_01",
    "jobTitle": "Frontend Developer",
    "companyName": "DesignCo Studio",
    "locationInfo": "Remote",
    "jobUrl": "https://designco.example/careers/frontend-dev",
    "jobDescription": "Join our team as a Frontend Developer. You should be expert in React, HTML, CSS, and modern Javascript. Experience with Node.js backend integration is good but this is a pure frontend layout role. Minimum 2 years experience.",
    "skills": ["React", "HTML", "CSS", "JavaScript"],
    "experienceYears": 2,
    "retrieved": "2026-08-13T11:00:00Z"
  },
  {
    "id": "job_b_02",
    "jobTitle": "Backend Engineer",
    "companyName": "Tech Innovations Inc.",
    "locationInfo": "New York, NY",
    "jobUrl": "https://techinnovations.example/apply/job_001",
    "jobDescription": "We are seeking a Backend Software Developer to build Node.js and Express servers. SQLite and Docker containerization are highly preferred. Salary competitive.",
    "skills": ["Node.js", "Express", "SQLite", "Docker"],
    "experienceYears": 3,
    "retrieved": "2026-08-13T11:30:00Z"
  }
];

// GET /api/mock/source-a
router.get('/mock/source-a', (req, res) => {
  const { query, location } = req.query;
  console.log(`Source A search triggered for query="${query}" and location="${location}"`);
  return res.status(200).json(mockSourceA);
});

// GET /api/mock/source-b
router.get('/mock/source-b', (req, res) => {
  const { q, loc } = req.query;
  console.log(`Source B search triggered for q="${q}" and loc="${loc}"`);
  return res.status(200).json(mockSourceB);
});

// POST /api/jobs/live-search
router.post('/live-search', async (req, res) => {
  try {
    const { searchTerm, location, useMockFallback } = req.body;
    let allJobs = [];
    let remotiveCount = 0;
    let jobicyCount = 0;

    if (useMockFallback) {
      allJobs = mockSourceA.map(j => ({
        job_id: j.id,
        job_title: j.title,
        company: j.company,
        location: j.loc,
        source: 'Mock Source A (Fallback)',
        description: j.desc,
        application_url: j.url,
        required_skills: typeof j.skills_required === 'string' ? j.skills_required.split(',').map(s => s.trim()) : (j.skills_required || []),
        required_experience_years: j.experience_req_years
      })).concat(mockSourceB.map(j => ({
        job_id: j.id,
        job_title: j.jobTitle,
        company: j.companyName,
        location: j.locationInfo,
        source: 'Mock Source B (Fallback)',
        description: j.jobDescription,
        application_url: j.jobUrl,
        required_skills: Array.isArray(j.skills) ? j.skills : (j.skills ? [j.skills] : []),
        required_experience_years: j.experienceYears
      })));
      remotiveCount = mockSourceA.length;
      jobicyCount = mockSourceB.length;
    } else {
      const fetchPromises = [];
      const rapidKey = process.env.RAPIDAPI_KEY || 'c451e214fbmsh883d83a2fec6552p13e1a9jsn8f76ca0b119d';

      // 1. JSearch API (LinkedIn, Indeed, Glassdoor Live Search)
      if (rapidKey) {
        const jsearchPromise = new Promise((resolve) => {
          const targetLoc = (location && location !== 'Worldwide / Remote') ? location : 'Remote';
          let cleanSearch = (searchTerm || 'Software Engineer').trim();
          if (cleanSearch.includes(',')) {
            const parts = cleanSearch.split(',').map(s => s.trim()).filter(Boolean);
            cleanSearch = parts.slice(0, 2).join(' ') + ' Developer';
          }
          const queryStr = `${cleanSearch} in ${targetLoc}`;
          const options = {
            method: 'GET',
            hostname: 'jsearch.p.rapidapi.com',
            path: `/search-v2?query=${encodeURIComponent(queryStr)}`,
            headers: {
              'x-rapidapi-key': rapidKey,
              'x-rapidapi-host': 'jsearch.p.rapidapi.com'
            },
            timeout: 10000
          };

          const req = https.request(options, (apiRes) => {
            let body = '';
            apiRes.on('data', c => body += c);
            apiRes.on('end', () => {
              try {
                const data = JSON.parse(body);
                const rawJobs = (data.data && data.data.jobs) ? data.data.jobs : (Array.isArray(data.data) ? data.data : []);
                const jobs = rawJobs.map((j, idx) => {
                  const skills = [];
                  const fullDesc = ((j.title || j.job_title || '') + ' ' + (j.description || j.job_description || '')).toLowerCase();
                  ['python', 'java', 'node.js', 'express', 'react', 'sql', 'mysql', 'postgresql', 'mongodb', 'docker', 'aws', 'c++', 'c#', 'javascript', 'typescript', 'git', 'linux', 'rest api'].forEach(sk => {
                    if (fullDesc.includes(sk)) skills.push(sk.charAt(0).toUpperCase() + sk.slice(1));
                  });
                  if (skills.length === 0) skills.push('Software Engineering', 'REST APIs');

                  const locName = j.location || [j.job_city, j.job_country].filter(Boolean).join(', ') || targetLoc;
                  const shortId = typeof j.job_id === 'string' ? j.job_id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8) : `${idx+1}`;

                  return {
                    job_id: `jsearch_${shortId}_${Math.random().toString(36).substring(2, 6)}`,
                    job_title: j.title || j.job_title || 'Software Engineer',
                    company: j.company || j.employer_name || 'Tech Company',
                    location: locName,
                    source: `LinkedIn / ${j.job_publisher || 'Web'} (JSearch Live)`,
                    description: (j.description || j.job_description || '').replace(/<[^>]+>/g, ' ').substring(0, 350),
                    application_url: j.job_apply_link || j.url || 'https://www.linkedin.com/jobs',
                    required_skills: skills,
                    required_experience_years: 2.0
                  };
                });
                remotiveCount = jobs.length;
                console.log(`[JSearch Live] Found ${jobs.length} live jobs for query="${queryStr}"`);
                resolve(jobs);
              } catch (e) {
                console.warn('JSearch parse warning:', e.message);
                resolve([]);
              }
            });
          });
          req.on('error', (err) => {
            console.warn('JSearch request error:', err.message);
            resolve([]);
          });
          req.end();
        });
        fetchPromises.push(jsearchPromise);
      }

      // 2. Remotive API (Worldwide Remote)
      const remotivePromise = new Promise((resolve) => {
        const url = `https://remotive.com/api/remote-jobs?limit=10&search=${encodeURIComponent(searchTerm.split(',')[0].trim())}`;
        https.get(url, { timeout: 8000 }, (apiRes) => {
          let body = '';
          apiRes.on('data', c => body += c);
          apiRes.on('end', () => {
            try {
              const data = JSON.parse(body);
              const jobs = (data.jobs || []).map(j => ({
                job_id: `remotive_${j.id}`,
                job_title: j.title,
                company: j.company_name,
                location: j.candidate_required_location || 'Remote (Worldwide)',
                source: 'Remotive Live API',
                description: j.description ? j.description.replace(/<[^>]+>/g, ' ').substring(0, 300) : '',
                application_url: j.url,
                required_skills: Array.isArray(j.tags) ? j.tags.filter(t => t.length < 25) : ['Software Engineering'],
                required_experience_years: 2.0
              }));
              jobicyCount = jobs.length;
              resolve(jobs);
            } catch (e) {
              resolve([]);
            }
          });
        }).on('error', () => resolve([]));
      });
      fetchPromises.push(remotivePromise);

      const results = await Promise.all(fetchPromises);
      results.forEach(r => { allJobs = allJobs.concat(r); });

      if (allJobs.length === 0) {
        allJobs = mockSourceA.map(j => ({
          job_id: j.id,
          job_title: j.title,
          company: j.company,
          location: j.loc,
          source: 'Mock Source A (Fallback)',
          description: j.desc,
          application_url: j.url,
          required_skills: typeof j.skills_required === 'string' ? j.skills_required.split(',').map(s => s.trim()) : (j.skills_required || []),
          required_experience_years: j.experience_req_years
        }));
        remotiveCount = allJobs.length;
      }
    }

    // Deduplication across sources
    const normalized = [];
    const seen = new Set();
    let duplicatesCount = 0;

    allJobs.forEach(job => {
      const key = `${(job.job_title || '').toLowerCase().trim()}_${(job.company || '').toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        normalized.push({
          schema_version: "1.0",
          job_id: job.job_id,
          job_title: job.job_title,
          company: job.company,
          location: job.location,
          source: job.source,
          description: job.description,
          application_url: job.application_url,
          required_skills: job.required_skills,
          retrieved_at: new Date().toISOString(),
          required_experience_years: job.required_experience_years || 1.0
        });
      } else {
        duplicatesCount++;
      }
    });

    return res.status(200).json({
      success: true,
      total_retrieved: allJobs.length,
      feed_a_count: remotiveCount,
      feed_b_count: jobicyCount,
      duplicates_removed: duplicatesCount,
      jobs: normalized
    });

  } catch (error) {
    console.error('Live search error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
module.exports.mockSourceA = mockSourceA;
module.exports.mockSourceB = mockSourceB;
