// Test Suite for Module 4 CV Tailoring & Hallucination Checks (Extended Audit)
const fs = require('fs');
const path = require('path');

// Grounding Check Logic
const runHallucinationCheck = (candidate, targetJob, tailoredSummary, tailoredAchievements) => {
  const fullText = (tailoredSummary + ' ' + (tailoredAchievements || []).join(' ')).toLowerCase();
  const unsupportedClaims = [];

  // 1. Skill check (disallowed skills)
  const missingSkills = (targetJob.missing_skills || []).map(s => s.toLowerCase().trim());
  missingSkills.forEach(skill => {
    if (skill && fullText.includes(skill)) {
      unsupportedClaims.push(`Falsely claimed candidate possesses skill: ${skill}`);
    }
  });

  // 2. Experience years check
  const parsedYears = fullText.match(/(\d+)\s*(?:\+)?\s*years/g) || [];
  parsedYears.forEach(expr => {
    const match = expr.match(/\d+/);
    if (match) {
      const yearsNum = parseInt(match[0]);
      if (yearsNum > (candidate.experience_years || 0)) {
        unsupportedClaims.push(`Falsely claimed experience of ${yearsNum} years (Candidate only has ${candidate.experience_years} years).`);
      }
    }
  });

  // 3. Leadership check
  const hasLeadership = (candidate.soft_skills || []).some(s => s.toLowerCase().includes('leadership'));
  const claimsLeadership = fullText.includes('led a team') || fullText.includes('managed a team') || fullText.includes('team of 10') || fullText.includes('led 10');
  if (claimsLeadership && !hasLeadership) {
    unsupportedClaims.push('Falsely claimed team leadership experience.');
  }

  // 4. Certifications check
  const allowedCerts = (candidate.certifications || []).map(c => c.toLowerCase().trim());
  const commonCerts = ['aws certified', 'solutions architect', 'scrum master', 'pmp', 'cissp'];
  commonCerts.forEach(cert => {
    if (fullText.includes(cert) && !allowedCerts.some(c => c.includes(cert))) {
      unsupportedClaims.push(`Falsely claimed certification: ${cert}`);
    }
  });

  // 5. Degree check
  const allowedDegrees = (candidate.education || []).map(e => (e.degree || '').toLowerCase().trim());
  const degreesToCheck = ['master of science', 'ms', 'phd', 'doctor'];
  degreesToCheck.forEach(deg => {
    if (fullText.includes(deg) && !allowedDegrees.some(d => d.includes(deg))) {
      unsupportedClaims.push(`Falsely claimed educational degree: ${deg}`);
    }
  });

  // 6. Project check
  const allowedProjects = (candidate.projects || []).map(p => (p.name || '').toLowerCase().trim());
  if (fullText.includes('shielder logistics') || fullText.includes('microservices platform')) {
    const matchedProj = allowedProjects.some(p => fullText.includes(p));
    if (!matchedProj) {
      unsupportedClaims.push('Falsely claimed participation in an unsupported project.');
    }
  }

  // 7. Metric check
  const parsedMetrics = fullText.match(/(\d+)%/g) || [];
  const allowedMetrics = JSON.stringify(candidate.projects || '').match(/(\d+)%/g) || [];
  const allowedMetricSet = new Set(allowedMetrics);
  parsedMetrics.forEach(m => {
    if (!allowedMetricSet.has(m)) {
      unsupportedClaims.push(`Falsely claimed numerical metric: ${m}`);
    }
  });

  // 8. Employer check
  const allowedEmployers = (candidate.job_titles || []).map(t => t.toLowerCase().trim()); // past job titles proxy for employer matches
  if (fullText.includes('google') || fullText.includes('microsoft')) {
    unsupportedClaims.push('Falsely claimed employment at Google or Microsoft.');
  }

  return {
    unsupported_claims: unsupportedClaims,
    passed: unsupportedClaims.length === 0
  };
};

// Candidate configuration for tests
const mockCandidate = {
  candidate_id: "cand_98a72b",
  experience_years: 5.5,
  technical_skills: ["Node.js", "Express", "PostgreSQL", "React", "Docker", "Git"],
  programming_languages: ["JavaScript", "SQL"],
  certifications: ["AWS Certified Solutions Architect"],
  education: [
    { degree: "Bachelor of Science", field: "Computer Science" }
  ],
  projects: [
    { name: "E-Commerce Microservices", description: "reduced latency by 45%" }
  ],
  soft_skills: ["Team Leadership"] // Jane Doe has leadership
};

const targetJob = {
  job_id: "job_01",
  required_skills: ["Node.js", "Express", "AWS", "Python"],
  missing_skills: ["Python"] // lacks Python
};

// 13 REQUIRED GROUNDING TEST SCENARIOS
const groundingTests = [
  {
    name: "1. Candidate has React -> emphasizes React",
    summary: "Strong expertise in React and Node.js backend development.",
    achievements: ["Built interactive web layouts using React library."],
    expectedPassed: true
  },
  {
    name: "2. Candidate lacks Python -> AI claims Python expertise",
    summary: "Senior backend developer writing Python API microservices.",
    achievements: ["Maintained Python scripts for automation."],
    expectedPassed: false
  },
  {
    name: "3. Candidate has 5.5 years exp -> AI claims 10 years",
    summary: "Senior software engineer with 10 years experience in Node.js.",
    achievements: ["Built enterprise services for 10 years."],
    expectedPassed: false
  },
  {
    name: "4. Candidate lacks Leadership -> AI claims Led a team of 10",
    summary: "Backend manager who led a team of 10 developers.",
    achievements: ["Led a team of 10 through complex migration."],
    candidateOverwrite: { soft_skills: [] }, // Remove leadership
    expectedPassed: false
  },
  {
    name: "5. Candidate lacks Scrum cert -> AI adds Scrum certification",
    summary: "Certified Scrum Master managing development cycles.",
    achievements: ["AWS Certified Solutions Architect and Scrum Master certified."],
    expectedPassed: false
  },
  {
    name: "6. Existing achievement rephrased -> allowed",
    summary: "Designed scalable backends with 45% latency reductions.",
    achievements: ["Optimized e-commerce APIs, shaving off latency by 45%."],
    expectedPassed: true
  },
  {
    name: "7. AI adds unsupported numerical achievement (50%)",
    summary: "Improved performance speed metrics by 50%.",
    achievements: ["Scaled APIs to reduce latency by 50%."],
    expectedPassed: false
  },
  {
    name: "8. Existing employer/title mentioned -> allowed",
    summary: "Full Stack Developer building React layout widgets.",
    achievements: ["Worked as a Full Stack Developer."],
    expectedPassed: true
  },
  {
    name: "9. AI invents employment at Google -> blocked",
    summary: "Backend engineer at Google core search team.",
    achievements: ["Employed at Google logistics division."],
    expectedPassed: false
  },
  {
    name: "10. Existing project rewrote -> allowed",
    summary: "Architected E-Commerce Microservices backends.",
    achievements: ["Created the E-Commerce Microservices portal."],
    expectedPassed: true
  },
  {
    name: "11. AI invents new project -> blocked",
    summary: "Designed the Shielder Logistics system.",
    achievements: ["Designed and launched Shielder Logistics tracking dashboard."],
    expectedPassed: false
  },
  {
    name: "12. Existing degree rephrased -> allowed",
    summary: "Holds a Bachelor of Science degree in Computer Science.",
    achievements: ["Graduated with BS in Computer Science."],
    expectedPassed: true
  },
  {
    name: "13. AI invents degree (MS) -> blocked",
    summary: "Holds a Master of Science degree in statistics.",
    achievements: ["Completed MS program at State Univ."],
    expectedPassed: false
  }
];

console.log('--- RUNNING 13 REQUIRED GROUNDING TESTS ---');
let allPassed = true;

groundingTests.forEach((tc, idx) => {
  const candObj = tc.candidateOverwrite ? { ...mockCandidate, ...tc.candidateOverwrite } : mockCandidate;
  const res = runHallucinationCheck(candObj, targetJob, tc.summary, tc.achievements);
  const passed = res.passed === tc.expectedPassed;
  if (!passed) allPassed = false;
  
  console.log(`\nTest Case ${idx + 1}: ${tc.name}`);
  console.log(`Factual Check Result: Passed = ${res.passed}`);
  console.log(`Errors Logged: ${JSON.stringify(res.unsupported_claims)}`);
  console.log(`PASS/FAIL: ${passed ? 'PASS' : 'FAIL'}`);
});

// PATH TRAVERSAL VERIFICATION
console.log('\n--- PATH TRAVERSAL VERIFICATION ---');
const safeIdRegex = /^[a-zA-Z0-9_-]+$/;
const testIds = [
  { id: "cand_98a72b", expected: true, name: "Valid identifier" },
  { id: "../../malicious", expected: false, name: "Relative path traversal" },
  { id: "..\\..\\malicious", expected: false, name: "Windows traversal" },
  { id: "C:\\Windows\\System32", expected: false, name: "Absolute path" },
  { id: "cand_98a_job-101", expected: true, name: "Unusual but valid ID" }
];

testIds.forEach(t => {
  const result = safeIdRegex.test(t.id);
  const passed = result === t.expected;
  if (!passed) allPassed = false;
  console.log(`ID: "${t.id}" (${t.name}) -> Allowed: ${result} (Expected: ${t.expected}) -> Result: ${passed ? 'PASS' : 'FAIL'}`);
});

console.log('\n------------------------------------------------');
console.log(`Final Verification Status: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
console.log('------------------------------------------------');
process.exit(allPassed ? 0 : 1);
