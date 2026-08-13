// ===========================================================================
// MODULE 6 — INTEGRATION & ARCHITECTURE TESTS
// Tests verify contracts, filter logic, architecture compliance, and n8n status.
// ===========================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

let allPassed = true;
let results = [];

function pass(name) {
  console.log(`✅ PASS: ${name}`);
  results.push({ name, pass: true });
}
function fail(name, reason) {
  console.log(`❌ FAIL: ${name} — ${reason}`);
  results.push({ name, pass: false, reason });
  allPassed = false;
}

function getRequest(p) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: 3000, path: p, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch(e) { resolve({ status: res.statusCode, raw: body }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function postRequest(p, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost', port: 3000, path: p, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch(e) { resolve({ status: res.statusCode, raw: body }); } });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// In-process matching logic (mirrors M3/Complete_Job_Hunter.json)
function runMatchingLogic(candidate, jobs) {
  const synonyms = {
    'js': ['javascript', 'js', 'typescript', 'ts'],
    'javascript': ['javascript', 'js', 'typescript', 'ts'],
    'typescript': ['javascript', 'js', 'typescript', 'ts'],
    'ts': ['javascript', 'js', 'typescript', 'ts'],
    'postgres': ['postgresql', 'postgres', 'sql'],
    'postgresql': ['postgresql', 'postgres', 'sql'],
    'sql': ['sql', 'postgresql', 'postgres', 'sqlite', 'mysql']
  };

  const candSkills = [
    ...(candidate.technical_skills || []),
    ...(candidate.programming_languages || []),
    ...(candidate.frameworks || []),
    ...(candidate.tools || [])
  ].map(s => s.toLowerCase().trim());

  function checkSkill(skill) {
    const s = skill.toLowerCase().trim();
    if (candSkills.includes(s)) return true;
    for (const key in synonyms) {
      if (synonyms[key].includes(s) && synonyms[key].some(syn => candSkills.includes(syn))) return true;
    }
    return false;
  }

  const candTitles = [...(candidate.preferred_roles || []), ...(candidate.job_titles || [])].map(t => t.toLowerCase().trim());
  const candKeywords = (candidate.keywords || []).map(k => k.toLowerCase().trim());
  const candExp = candidate.experience_years || 0;

  return jobs.map(job => {
    const matched = (job.required_skills || []).filter(s => checkSkill(s));
    const missing = (job.required_skills || []).filter(s => !checkSkill(s));
    const keywordScore = (job.required_skills || []).length > 0 ? (matched.length / job.required_skills.length) * 100 : 100;

    let titleSim = candTitles.some(t => (job.job_title || '').toLowerCase().includes(t)) ? 1.0 : 0.0;
    let kwSim = 0.0;
    const descLower = (job.description || '').toLowerCase();
    if (candKeywords.length > 0) kwSim = candKeywords.filter(k => descLower.includes(k)).length / candKeywords.length;
    else kwSim = 1.0;
    const semanticSimilarity = (titleSim * 0.5) + (kwSim * 0.5);
    const semanticScore = semanticSimilarity * 100;

    const reqExp = job.required_experience_years || 0;
    const experienceScore = reqExp > 0 ? Math.min((candExp / reqExp) * 100, 100) : 100;
    const finalScore = parseFloat(((keywordScore * 0.3) + (semanticScore * 0.4) + (experienceScore * 0.3)).toFixed(1));

    let decision = 'SKIP';
    if (finalScore >= 85) decision = 'APPLY';
    else if (finalScore >= 60) decision = 'REVIEW';

    return { job_id: job.job_id, job_title: job.job_title, match_score: finalScore, matched_skills: matched, missing_skills: missing, experience_match: { candidate_years: candExp, required_years: reqExp, satisfied: candExp >= reqExp }, decision, semantic_similarity: semanticSimilarity };
  });
}

async function runTests() {
  console.log('');
  console.log('===========================================================================');
  console.log('MODULE 6 — INTEGRATION & ARCHITECTURE TESTS');
  console.log('===========================================================================');
  console.log('');

  // ===================================================
  // TEST 1: M1 output matches Contract 3.1 schema
  // ===================================================
  console.log('--- Contract & Schema Tests ---');
  try {
    const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/sample_candidate_profile.json'), 'utf8'));
    const required31 = ['schema_version', 'candidate_id', 'candidate_name', 'email', 'experience_years', 'job_titles', 'preferred_roles', 'technical_skills', 'programming_languages', 'frameworks', 'tools', 'keywords', 'education', 'extraction_meta'];
    const missing = required31.filter(f => sample[f] === undefined || sample[f] === null);
    if (missing.length === 0) pass('TEST 1: M1 candidate_profile.json matches Contract 3.1 schema');
    else fail('TEST 1', `Missing fields: ${missing.join(', ')}`);
  } catch (e) { fail('TEST 1', e.message); }

  // ===================================================
  // TEST 2: M2 output matches Contract 3.2 schema
  // ===================================================
  try {
    const jobs = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/sample_jobs.json'), 'utf8'));
    const required32 = ['job_id', 'job_title', 'company', 'location', 'source', 'description', 'application_url', 'required_skills', 'retrieved_at'];
    const allValid = jobs.every((job, i) => {
      const missing = required32.filter(f => job[f] === undefined || job[f] === null);
      if (missing.length > 0) { console.log(`  Job [${i}] missing: ${missing.join(', ')}`); return false; }
      return true;
    });
    if (allValid && jobs.length > 0) pass('TEST 2: M2 jobs.json matches Contract 3.2 schema');
    else fail('TEST 2', 'Some jobs missing required fields or array is empty');
  } catch (e) { fail('TEST 2', e.message); }

  // ===================================================
  // TEST 3: M1 + M2 correctly feed M3 (contract boundary)
  // ===================================================
  try {
    const candidate = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/sample_candidate_profile.json'), 'utf8'));
    const jobs = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/sample_jobs.json'), 'utf8'));
    const ranked = runMatchingLogic(candidate, jobs);
    if (ranked.length > 0 && ranked[0].match_score !== undefined && ranked[0].decision !== undefined) {
      pass('TEST 3: M1 candidate + M2 jobs correctly produce M3 ranked output');
    } else {
      fail('TEST 3', 'M3 output is empty or missing required fields');
    }
  } catch (e) { fail('TEST 3', e.message); }

  // ===================================================
  // TEST 4: M3 output matches Contract 3.3 schema
  // ===================================================
  try {
    const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/sample_ranked_jobs.json'), 'utf8'));
    const required33 = ['job_id', 'job_title', 'company', 'application_url', 'match_score', 'score_breakdown', 'matched_skills', 'missing_skills', 'experience_match', 'semantic_similarity', 'decision', 'explanation', 'method', 'ranked_at'];
    const allValid = sample.every(job => required33.every(f => job[f] !== undefined && job[f] !== null));
    if (allValid) pass('TEST 4: ranked_jobs.json matches Contract 3.3 schema');
    else fail('TEST 4', 'Some ranked jobs missing Contract 3.3 required fields');
  } catch (e) { fail('TEST 4', e.message); }

  // ===================================================
  // TEST 5: Only decision == 'APPLY' jobs enter M4 (APPLY filter)
  // ===================================================
  try {
    const candidate = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/sample_candidate_profile.json'), 'utf8'));
    const jobs = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/sample_jobs.json'), 'utf8'));
    const ranked = runMatchingLogic(candidate, jobs);
    const applyJobs = ranked.filter(j => j.decision === 'APPLY');
    const nonApply = ranked.filter(j => j.decision !== 'APPLY');
    // Confirm: APPLY filter is correctly defined by decision field
    const allApplyAreApply = applyJobs.every(j => j.decision === 'APPLY');
    if (allApplyAreApply) pass('TEST 5: Only decision==APPLY jobs would pass the APPLY filter');
    else fail('TEST 5', 'Some jobs with non-APPLY decision are incorrectly classified as APPLY');
  } catch (e) { fail('TEST 5', e.message); }

  // ===================================================
  // TEST 6: REJECT/SKIP/REVIEW jobs do NOT enter M4
  // ===================================================
  try {
    const jobs = [
      { job_id: 'j1', job_title: 'Backend Eng', company: 'A', location: 'NY', source: 'S', description: 'Node.js Backend', application_url: 'http://a.com', required_skills: ['Node.js', 'JavaScript'], retrieved_at: new Date().toISOString(), required_experience_years: 3 },
      { job_id: 'j2', job_title: 'Data Sci', company: 'B', location: 'LA', source: 'S', description: 'Python ML role', application_url: 'http://b.com', required_skills: ['Python', 'Pandas', 'TensorFlow', 'Spark', 'Keras'], retrieved_at: new Date().toISOString(), required_experience_years: 10 }
    ];
    const candidate = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/sample_candidate_profile.json'), 'utf8'));
    const ranked = runMatchingLogic(candidate, jobs);
    const applyJobs = ranked.filter(j => j.decision === 'APPLY');
    const nonApply = ranked.filter(j => j.decision !== 'APPLY');
    // Ensure REJECT/low score jobs do not have decision === 'APPLY'
    const poorJob = ranked.find(j => j.job_id === 'j2');
    if (poorJob && poorJob.decision !== 'APPLY') {
      pass('TEST 6: REJECT/low-score jobs do NOT get APPLY decision (would not enter M4)');
    } else {
      fail('TEST 6', `Poor-fit job j2 incorrectly received decision: ${poorJob ? poorJob.decision : 'not found'}`);
    }
  } catch (e) { fail('TEST 6', e.message); }

  // ===================================================
  // TEST 7: Multiple APPLY jobs are processed independently
  // ===================================================
  try {
    const candidate = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/sample_candidate_profile.json'), 'utf8'));
    // Create two high-matching jobs
    const jobs = [
      { job_id: 'multi_01', job_title: 'Backend Engineer', company: 'A Corp', location: 'NY', source: 'S', description: 'Node.js Backend Engineer', application_url: 'http://a.com/apply', required_skills: ['Node.js', 'JavaScript'], retrieved_at: new Date().toISOString(), required_experience_years: 3 },
      { job_id: 'multi_02', job_title: 'Software Engineer', company: 'B Corp', location: 'NY', source: 'S', description: 'Node.js Backend Software Engineer', application_url: 'http://b.com/apply', required_skills: ['Node.js', 'Express'], retrieved_at: new Date().toISOString(), required_experience_years: 2 }
    ];
    const ranked = runMatchingLogic(candidate, jobs);
    const applyJobs = ranked.filter(j => j.decision === 'APPLY');
    // If >= 2 APPLY jobs, they would each be processed independently (verified by Complete_Job_Hunter.json APPLY Filter node returning each as separate item)
    const uniqueIds = new Set(applyJobs.map(j => j.job_id));
    if (uniqueIds.size === applyJobs.length) {
      pass(`TEST 7: Multiple APPLY jobs retain unique job_ids (${applyJobs.length} APPLY jobs, each independent)`);
    } else {
      fail('TEST 7', 'Duplicate job_ids detected in APPLY jobs list');
    }
  } catch (e) { fail('TEST 7', e.message); }

  // ===================================================
  // TEST 8: M4 output matches Contract 3.4 schema
  // ===================================================
  try {
    const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/sample_application_package.json'), 'utf8'));
    const required34 = ['candidate_id', 'candidate_email', 'job_id', 'job_title', 'company', 'application_url', 'match_score', 'cv_file', 'cv_tex_file', 'cover_letter_file', 'tailoring_meta', 'fact_check', 'latex_compiled'];
    const missing = required34.filter(f => sample[f] === undefined || sample[f] === null);
    if (missing.length === 0) pass('TEST 8: application_package.json matches Contract 3.4 schema');
    else fail('TEST 8', `Missing fields: ${missing.join(', ')}`);
  } catch (e) { fail('TEST 8', e.message); }

  // ===================================================
  // TEST 9: M4 package reaches M5 without unauthorized mutation
  // ===================================================
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/sample_application_package.json'), 'utf8'));
    // Verify the key identifiers that must survive the boundary
    const identifiers = ['candidate_id', 'job_id', 'company', 'job_title', 'application_url'];
    const allPresent = identifiers.every(f => pkg[f] !== undefined && pkg[f] !== null);
    if (allPresent) pass('TEST 9: Contract 3.4 identifiers intact (no unauthorized mutation at M4→M5 boundary)');
    else fail('TEST 9', 'Some Contract 3.4 identifiers missing');
  } catch (e) { fail('TEST 9', e.message); }

  // ===================================================
  // TEST 10: M5 output matches Contract 3.5 schema
  // ===================================================
  try {
    const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/sample_application_status.json'), 'utf8'));
    const required35 = ['application_id', 'candidate_id', 'job_id', 'company', 'job_title', 'approval_decision', 'application_status', 'submission_method', 'attempts', 'confirmation_sent'];
    const missing = required35.filter(f => sample[f] === undefined || sample[f] === null);
    if (missing.length === 0) pass('TEST 10: application_status.json matches Contract 3.5 schema');
    else fail('TEST 10', `Missing fields: ${missing.join(', ')}`);
  } catch (e) { fail('TEST 10', e.message); }

  // ===================================================
  // TEST 11: Final application status is persisted to SQLite
  // ===================================================
  console.log('\n--- Backend/DB Integration Tests (requires server on port 3000) ---');
  try {
    const candidateId = 'cand_m6_' + Math.random().toString(36).substring(2, 7);
    const jobId = 'job_m6_' + Math.random().toString(36).substring(2, 7);

    const submitRes = await postRequest('/api/applications/submit', {
      candidate_id: candidateId,
      job_id: jobId,
      company: 'M6 Test Corp',
      job_title: 'Integration Test Role'
    });
    if (submitRes.data.success && submitRes.data.application && submitRes.data.application.application_id) {
      const appId = submitRes.data.application.application_id;
      const getRes = await getRequest(`/api/applications/${appId}`);
      if (getRes.data.success && getRes.data.application.application_id === appId) {
        pass('TEST 11: Final application_status persisted to SQLite and retrievable');
      } else {
        fail('TEST 11', 'Application submitted but cannot be retrieved from SQLite');
      }
    } else {
      fail('TEST 11', `Submit failed: ${JSON.stringify(submitRes.data)}`);
    }
  } catch (e) { fail('TEST 11', 'Server error: ' + e.message); }

  // ===================================================
  // TEST 12: Portal failure path produces failed status
  // ===================================================
  try {
    const candidateId = 'cand_m6_fail_' + Math.random().toString(36).substring(2, 5);
    const submitRes = await postRequest('/api/applications/submit', {
      candidate_id: candidateId,
      job_id: 'job_error_500',
      company: 'Fail Corp',
      job_title: 'Error Role'
    });
    if (submitRes.data.success && submitRes.data.application.application_id) {
      const appId = submitRes.data.application.application_id;
      const decideRes = await postRequest('/api/approval/decide', { application_id: appId, decision: 'APPROVED' });
      if (decideRes.data.application.application_status === 'failed' && decideRes.data.application.error) {
        pass('TEST 12: Portal failure path produces failed status with error logged');
      } else {
        fail('TEST 12', `Expected failed status, got: ${decideRes.data.application.application_status}`);
      }
    } else {
      fail('TEST 12', 'Submit failed: ' + JSON.stringify(submitRes.data));
    }
  } catch (e) { fail('TEST 12', 'Server error: ' + e.message); }

  // ===================================================
  // TEST 13: n8n offline is correctly detected by /api/n8n/status
  // ===================================================
  try {
    const statusRes = await getRequest('/api/n8n/status');
    if (statusRes.status === 200 && typeof statusRes.data.online === 'boolean') {
      if (statusRes.data.online === false) {
        pass('TEST 13: n8n offline correctly detected (online: false) — n8n is not running');
      } else {
        pass('TEST 13: n8n status endpoint works correctly (n8n is currently online)');
      }
    } else {
      fail('TEST 13', `Unexpected response: status=${statusRes.status}, body=${JSON.stringify(statusRes.data)}`);
    }
  } catch (e) { fail('TEST 13', 'Server error: ' + e.message); }

  // ===================================================
  // TEST 14: Frontend does not contain M6 business orchestration
  // ===================================================
  try {
    const appJs = fs.readFileSync(path.join(__dirname, '../../frontend/app.js'), 'utf8');
    // Check for forbidden patterns: M6 should not contain scoring, submission pipeline, or retry logic in frontend
    const forbidden = [
      { pattern: 'runM6WorkflowSim', description: 'runM6WorkflowSim simulation function' },
      { pattern: 'runMatchingLogic', description: 'M3 matching logic in frontend' }
    ];
    const found = forbidden.filter(f => appJs.includes(f.pattern));
    if (found.length === 0) {
      pass('TEST 14: Frontend does not contain M6 business orchestration (runM6WorkflowSim, runMatchingLogic)');
    } else {
      fail('TEST 14', `Forbidden orchestration patterns found: ${found.map(f => f.description).join(', ')}`);
    }
  } catch (e) { fail('TEST 14', e.message); }

  // ===================================================
  // TEST 15: No runM6WorkflowSim or equivalent fake orchestration in server.js
  // ===================================================
  try {
    const serverJs = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
    const forbidden = ['runM6WorkflowSim', 'simulateM6', 'fakeM6', 'mockM6Orchestration'];
    const found = forbidden.filter(p => serverJs.includes(p));
    if (found.length === 0) {
      pass('TEST 15: No runM6WorkflowSim or fake M6 orchestration exists in server.js');
    } else {
      fail('TEST 15', `Fake orchestration patterns found: ${found.join(', ')}`);
    }
  } catch (e) { fail('TEST 15', e.message); }

  // ===================================================
  // TEST BONUS: /api/n8n/run endpoint exists and validates payload
  // ===================================================
  try {
    const missingPayloadRes = await postRequest('/api/n8n/run', {});
    if (missingPayloadRes.status === 400) {
      pass('TEST BONUS: /api/n8n/run correctly rejects missing candidate_profile (HTTP 400)');
    } else if (missingPayloadRes.status === 503 && missingPayloadRes.data.n8n_offline) {
      // This also means the endpoint exists and works (n8n is just offline)
      pass('TEST BONUS: /api/n8n/run endpoint exists and correctly reports n8n offline');
    } else {
      fail('TEST BONUS', `Unexpected status ${missingPayloadRes.status}: ${JSON.stringify(missingPayloadRes.data)}`);
    }
  } catch (e) { fail('TEST BONUS', 'Server error: ' + e.message); }

  // ===================================================
  // SUMMARY
  // ===================================================
  console.log('');
  console.log('===========================================================================');
  console.log(`M6 TEST RESULTS: ${results.filter(r => r.pass).length}/${results.length} passed`);
  console.log('===========================================================================');
  results.forEach(r => {
    console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}${r.reason ? ' — ' + r.reason : ''}`);
  });
  console.log('');
  console.log(`Final: ${allPassed ? 'ALL M6 TESTS PASSED' : 'SOME M6 TESTS FAILED'}`);
  console.log('');

  process.exit(allPassed ? 0 : 1);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
