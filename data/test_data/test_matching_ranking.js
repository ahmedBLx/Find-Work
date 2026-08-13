// Test Suite for Module 3 - Matching & Ranking Scorer

const synonyms = {
  'js': ['javascript', 'js', 'typescript', 'ts'],
  'javascript': ['javascript', 'js', 'typescript', 'ts'],
  'typescript': ['javascript', 'js', 'typescript', 'ts'],
  'ts': ['javascript', 'js', 'typescript', 'ts'],
  'postgres': ['postgresql', 'postgres', 'sql'],
  'postgresql': ['postgresql', 'postgres', 'sql'],
  'sql': ['sql', 'postgresql', 'postgres', 'sqlite', 'mysql']
};

function runMatchingLogic(candidate, jobs) {
  const candSkills = [
    ...(candidate.technical_skills || []),
    ...(candidate.programming_languages || []),
    ...(candidate.frameworks || []),
    ...(candidate.tools || [])
  ].map(s => s.toLowerCase().trim());

  function checkSkillMatch(skill) {
    const sLower = skill.toLowerCase().trim();
    if (candSkills.includes(sLower)) return true;
    for (const key in synonyms) {
      if (synonyms[key].includes(sLower) && synonyms[key].some(syn => candSkills.includes(syn))) {
        return true;
      }
    }
    return false;
  }

  const candTitles = [
    ...(candidate.preferred_roles || []),
    ...(candidate.job_titles || [])
  ].map(t => t.toLowerCase().trim());
  
  const candKeywords = (candidate.keywords || []).map(k => k.toLowerCase().trim());
  const candExp = candidate.experience_years || 0;

  const scored = jobs.map(job => {
    // 1. Calculate Skill match
    const matched = [];
    const missing = [];
    (job.required_skills || []).forEach(s => {
      if (checkSkillMatch(s)) matched.push(s);
      else missing.push(s);
    });
    const keywordScore = job.required_skills && job.required_skills.length > 0
      ? (matched.length / job.required_skills.length) * 100
      : 100;

    // 2. Calculate Semantic match (Title + Keywords)
    let titleSim = 0.0;
    const jobTitleLower = (job.job_title || '').toLowerCase();
    const isTitleMatch = candTitles.some(title => jobTitleLower.includes(title));
    if (isTitleMatch) titleSim = 1.0;

    let kwSim = 0.0;
    const jobDescLower = (job.description || '').toLowerCase();
    if (candKeywords.length > 0) {
      const matchedKw = candKeywords.filter(kw => jobDescLower.includes(kw));
      kwSim = matchedKw.length / candKeywords.length;
    } else {
      kwSim = 1.0;
    }
    const semanticSimilarity = (titleSim * 0.5) + (kwSim * 0.5);
    const semanticScore = semanticSimilarity * 100;

    // 3. Calculate Experience match
    const reqExp = job.required_experience_years || 0;
    const satisfied = candExp >= reqExp;
    const experienceScore = reqExp > 0 ? Math.min((candExp / reqExp) * 100, 100) : 100;

    // 4. Aggregate Match Score
    const wKeyword = 0.3;
    const wSemantic = 0.4;
    const wExperience = 0.3;
    const finalScore = parseFloat(((keywordScore * wKeyword) + (semanticScore * wSemantic) + (experienceScore * wExperience)).toFixed(1));

    let decision = 'SKIP';
    if (finalScore >= 85) decision = 'APPLY';
    else if (finalScore >= 60) decision = 'REVIEW';

    return {
      job_id: job.job_id,
      job_title: job.job_title,
      match_score: finalScore,
      matched_skills: matched,
      missing_skills: missing,
      experience_match: {
        candidate_years: candExp,
        required_years: reqExp,
        satisfied: satisfied
      },
      decision: decision
    };
  });

  // Sort descending by score, deterministic tie-breaking on job_id
  scored.sort((a, b) => {
    if (b.match_score !== a.match_score) {
      return b.match_score - a.match_score;
    }
    return a.job_id.localeCompare(b.job_id);
  });

  return scored;
}

// Verification Test Cases
const baseCandidate = {
  candidate_id: "cand_01",
  experience_years: 5.0,
  technical_skills: ["Node.js", "Express", "PostgreSQL"],
  programming_languages: ["JavaScript", "TypeScript"],
  frameworks: ["Express"],
  tools: ["Git"],
  preferred_roles: ["Backend Engineer"],
  job_titles: ["Software Engineer"],
  keywords: ["Node.js", "Backend"]
};

const jobExcellent = { job_id: "job_01", job_title: "Backend Engineer", description: "Node.js Backend role", required_skills: ["Node.js", "JavaScript"], required_experience_years: 3 };
const jobPoor = { job_id: "job_02", job_title: "Data Scientist", description: "Python PyTorch machine learning", required_skills: ["Python", "Pandas"], required_experience_years: 8 };
const jobTie1 = { job_id: "job_03", job_title: "Backend SWE", description: "Backend Node.js Developer", required_skills: ["Node.js", "JavaScript"], required_experience_years: 5 };
const jobTie2 = { job_id: "job_04", job_title: "Backend SWE", description: "Backend Node.js Developer", required_skills: ["Node.js", "JavaScript"], required_experience_years: 5 };

console.log('--- START MODULE 3 MATCHING & RANKING SCORER TESTS ---');
let allPassed = true;

// Test 1: Excellent Match vs Poor Match ordering
let res = runMatchingLogic(baseCandidate, [jobPoor, jobExcellent]);
console.log('\nTest Case 1: Match Ranking Order');
console.log(`Job #1 ID: ${res[0].job_id} (Expected: job_01)`);
console.log(`Job #1 Score: ${res[0].match_score}`);
console.log(`Job #2 ID: ${res[1].job_id} (Expected: job_02)`);
console.log(`Job #2 Score: ${res[1].match_score}`);
let pass = res[0].job_id === "job_01" && res[0].match_score > res[1].match_score;
if (!pass) allPassed = false;
console.log(`PASS/FAIL: ${pass ? 'PASS' : 'FAIL'}`);

// Test 2: Deterministic Tie Breaking
res = runMatchingLogic(baseCandidate, [jobTie2, jobTie1]);
console.log('\nTest Case 2: Deterministic Tie-Breaker (Alphabetical ID)');
console.log(`Job #1 ID: ${res[0].job_id} (Expected: job_03)`);
console.log(`Job #2 ID: ${res[1].job_id} (Expected: job_04)`);
pass = res[0].job_id === "job_03" && res[1].job_id === "job_04";
if (!pass) allPassed = false;
console.log(`PASS/FAIL: ${pass ? 'PASS' : 'FAIL'}`);

// Test 3: Synonyms Check
const jobSynonym = { job_id: "job_05", job_title: "JS Developer", description: "We use JS and Postgres", required_skills: ["js", "postgres"], required_experience_years: 1 };
res = runMatchingLogic(baseCandidate, [jobSynonym]);
console.log('\nTest Case 3: Synonyms Mapping Check');
console.log(`Matched Skills: ${JSON.stringify(res[0].matched_skills)} (Expected both matched via synonyms)`);
console.log(`Score: ${res[0].match_score}`);
pass = res[0].matched_skills.length === 2;
if (!pass) allPassed = false;
console.log(`PASS/FAIL: ${pass ? 'PASS' : 'FAIL'}`);

console.log('\n------------------------------------------------');
console.log(`Final Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
console.log('------------------------------------------------');
process.exit(allPassed ? 0 : 1);
