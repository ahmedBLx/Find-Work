// Regression Tests for Module 5 - Application & Tracking (Backend & DB Integration)
const http = require('http');

function postRequest(path, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: body });
        }
      });
    });
    
    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

function getRequest(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET'
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(body) }));
    });
    req.on('error', (e) => reject(e));
    req.end();
  });
}

async function runRegressionTests() {
  console.log('--- START MODULE 5 REGRESSION TESTS ---');
  let allPassed = true;

  const candidateId = 'cand_reg_' + Math.random().toString(36).substring(2, 6);
  const jobId = 'job_reg_' + Math.random().toString(36).substring(2, 6);

  const payload = {
    candidate_id: candidateId,
    job_id: jobId,
    company: "Audit Corp",
    job_title: "Security Auditor"
  };

  // Test 1: New application submit registers pending_approval
  console.log('\nTest 1: Submit New Application registers pending_approval');
  const res1 = await postRequest('/api/applications/submit', payload);
  console.log('Status Code:', res1.statusCode);
  console.log('Response Success:', res1.data.success);
  console.log('App Status:', res1.data.application.application_status);
  let pass = res1.statusCode === 200 && res1.data.success && res1.data.application.application_status === 'pending_approval';
  if (!pass) allPassed = false;
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);

  const appId = res1.data.application.application_id;

  // Test 2: Double submission check blocks duplicate
  console.log('\nTest 2: Double submission triggers Duplicate prevention');
  const res2 = await postRequest('/api/applications/submit', payload);
  console.log('Status Code:', res2.statusCode);
  console.log('Response Message:', res2.data.message);
  pass = res2.statusCode === 400 && res2.data.success === false && res2.data.message.includes('UNIQUE constraint');
  if (!pass) allPassed = false;
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);

  // Test 3: Human decision APPROVED transitions to submitted
  console.log('\nTest 3: Human Approved Decision transition');
  const res3 = await postRequest('/api/approval/decide', { application_id: appId, decision: 'APPROVED' });
  console.log('Status Code:', res3.statusCode);
  console.log('App Status:', res3.data.application.application_status);
  console.log('Confirmation Sent:', res3.data.application.confirmation_sent);
  pass = res3.statusCode === 200 && res3.data.application.application_status === 'submitted' && res3.data.application.confirmation_sent === true;
  if (!pass) allPassed = false;
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);

  // Test 4: Human decision REJECTED transitions to skipped_human_rejection
  console.log('\nTest 4: Human Rejected Decision transition');
  const otherJobId = 'job_other_' + Math.random().toString(36).substring(2, 6);
  const resIntake = await postRequest('/api/applications/submit', { ...payload, job_id: otherJobId });
  const otherAppId = resIntake.data.application.application_id;

  const res4 = await postRequest('/api/approval/decide', { application_id: otherAppId, decision: 'REJECTED' });
  console.log('Status Code:', res4.statusCode);
  console.log('App Status:', res4.data.application.application_status);
  pass = res4.statusCode === 200 && res4.data.application.application_status === 'skipped_human_rejection';
  if (!pass) allPassed = false;
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);

  // Test 5: Portal Upload Failure returns failed status
  console.log('\nTest 5: Target Portal failure returns failed status');
  const failJobId = 'job_error_500';
  const resFailIntake = await postRequest('/api/applications/submit', { ...payload, job_id: failJobId });
  const failAppId = resFailIntake.data.application.application_id;

  const res5 = await postRequest('/api/approval/decide', { application_id: failAppId, decision: 'APPROVED' });
  console.log('Status Code:', res5.statusCode);
  console.log('App Status:', res5.data.application.application_status);
  console.log('Error Logged:', res5.data.application.error);
  pass = res5.statusCode === 200 && res5.data.application.application_status === 'failed' && res5.data.application.error.code === 'SUBMISSION_FAILED';
  if (!pass) allPassed = false;
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);

  // Test 6: Human Decision Timeout (enforced by backend daemon checker)
  console.log('\nTest 6: Human Decision Timeout check (background daemon)');
  const timeoutJobId = 'job_timeout_' + Math.random().toString(36).substring(2, 6);
  const resTimeoutIntake = await postRequest('/api/applications/submit', { ...payload, job_id: timeoutJobId });
  const timeoutAppId = resTimeoutIntake.data.application.application_id;

  // Let's modify the database row directly to backdate it
  const db = require('../../database.js');
  const dbPromise = new Promise((resolve, reject) => {
    db.db.run("UPDATE applications SET created_at = ? WHERE application_id = ?", [
      new Date(Date.now() - 150000).toISOString(), // 150 seconds ago
      timeoutAppId
    ], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  await dbPromise;
  console.log('Backdated application in database to 150 seconds ago.');
  console.log('Waiting 6 seconds for background timeout checker to process...');
  await new Promise(r => setTimeout(r, 6000));

  // Query updated status
  const res6 = await getRequest(`/api/applications/${timeoutAppId}`);
  console.log('Status Code:', res6.statusCode);
  console.log('App Status:', res6.data.application.application_status);
  console.log('Decision Status:', res6.data.application.approval_decision);
  pass = res6.statusCode === 200 && res6.data.application.application_status === 'skipped_timeout' && res6.data.application.approval_decision === 'REJECTED';
  if (!pass) allPassed = false;
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);

  console.log('\n------------------------------------------------');
  console.log(`Final Regression Status: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('------------------------------------------------');
  process.exit(allPassed ? 0 : 1);
}

runRegressionTests();
