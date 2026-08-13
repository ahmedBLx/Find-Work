// Test Suite for Module 2 - Job Discovery (Priority-based Normalization & Deduplication)

const deduplicate = (jobs) => {
  const uniqueJobs = [];
  const seenSourceJobIds = new Set();
  const seenUrls = new Set();
  const seenFallbacks = new Set();

  jobs.forEach(job => {
    // 1. source + sourceJobId check
    const sourceJobKey = `${job.source}|${job.job_id}`;
    
    // 2. normalized URL check
    let urlKey = (job.application_url || '').toLowerCase().trim();
    urlKey = urlKey.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    
    // 3. Fallback: company + title + location check
    const company = (job.company || '').toLowerCase().trim();
    const title = (job.job_title || '').toLowerCase().trim();
    const location = (job.location || '').toLowerCase().trim();
    const fallbackKey = `${company}|${title}|${location}`;
    
    if (seenSourceJobIds.has(sourceJobKey)) return;
    if (urlKey && seenUrls.has(urlKey)) return;
    if (seenFallbacks.has(fallbackKey)) return;
    
    seenSourceJobIds.add(sourceJobKey);
    if (urlKey) seenUrls.add(urlKey);
    seenFallbacks.add(fallbackKey);
    uniqueJobs.push(job);
  });
  return uniqueJobs;
};

// Define 10 test scenarios mapping to user requests
const testCases = [
  {
    name: "1. Exact same source + sourceJobId -> duplicate",
    jobs: [
      { job_id: "job_001", source: "Source A", application_url: "https://g.co/a", company: "Google", job_title: "SWE", location: "Cairo" },
      { job_id: "job_001", source: "Source A", application_url: "https://g.co/b", company: "Google", job_title: "SWE", location: "Cairo" } // same job_id, different URL
    ],
    expectedCount: 1
  },
  {
    name: "2. Same source + different sourceJobId -> NOT duplicate",
    jobs: [
      { job_id: "job_001", source: "Source A", application_url: "https://g.co/a", company: "Google", job_title: "SWE", location: "Cairo" },
      { job_id: "job_002", source: "Source A", application_url: "https://g.co/b", company: "Google", job_title: "SWE", location: "London" } // different job_id, different location
    ],
    expectedCount: 2
  },
  {
    name: "3. Different sources + different sourceJobId -> NOT duplicate unless URL is identical",
    jobs: [
      { job_id: "job_001", source: "Source A", application_url: "https://g.co/a", company: "Google", job_title: "SWE", location: "Cairo" },
      { job_id: "job_001", source: "Source B", application_url: "https://g.co/a", company: "Google", job_title: "SWE", location: "Cairo" } // different source, same URL -> duplicate!
    ],
    expectedCount: 1
  },
  {
    name: "4. Same URL with different URL formatting -> duplicate",
    jobs: [
      { job_id: "job_001", source: "Source A", application_url: "https://g.co/apply/", company: "Google", job_title: "SWE", location: "Cairo" },
      { job_id: "job_002", source: "Source B", application_url: "http://g.co/apply", company: "Google", job_title: "SWE", location: "Cairo" } // trailing slash, http vs https -> duplicate!
    ],
    expectedCount: 1
  },
  {
    name: "5. Same company + same title + different location -> NOT duplicate",
    jobs: [
      { job_id: "job_001", source: "Source A", application_url: "https://g.co/a", company: "Google", job_title: "Software Engineer", location: "Cairo" },
      { job_id: "job_002", source: "Source B", application_url: "https://g.co/b", company: "Google", job_title: "Software Engineer", location: "London" } // London vs Cairo -> kept!
    ],
    expectedCount: 2
  },
  {
    name: "6. Same company + same title + same location -> duplicate only as fallback",
    jobs: [
      { job_id: "job_001", source: "Source A", application_url: "https://g.co/a", company: "Google", job_title: "SWE", location: "Cairo" },
      { job_id: "job_002", source: "Source B", application_url: "https://g.co/b", company: "Google", job_title: "SWE", location: "Cairo" } // same location -> duplicate fallback!
    ],
    expectedCount: 1
  },
  {
    name: "7. Different companies + same title -> NOT duplicate",
    jobs: [
      { job_id: "job_001", source: "Source A", application_url: "https://g.co/a", company: "Google", job_title: "SWE", location: "Cairo" },
      { job_id: "job_002", source: "Source B", application_url: "https://m.co/a", company: "Microsoft", job_title: "SWE", location: "Cairo" } // Different company -> kept!
    ],
    expectedCount: 2
  },
  {
    name: "8. Case differences in title/company/location -> consistent behavior",
    jobs: [
      { job_id: "job_001", source: "Source A", application_url: "https://g.co/a", company: "Google", job_title: "SWE", location: "Cairo" },
      { job_id: "job_002", source: "Source B", application_url: "https://g.co/b", company: "GOOGLE", job_title: "swe", location: "cairo" } // Casing difference -> duplicate fallback!
    ],
    expectedCount: 1
  },
  {
    name: "9. Empty/missing sourceJobId -> safely fall back to URL, then title/company/location",
    jobs: [
      { job_id: "", source: "Source A", application_url: "https://g.co/a", company: "Google", job_title: "SWE", location: "Cairo" },
      { job_id: null, source: "Source B", application_url: "https://g.co/a", company: "Google", job_title: "SWE", location: "Cairo" } // same URL, missing IDs -> duplicate!
    ],
    expectedCount: 1
  },
  {
    name: "10. Genuinely different jobs -> must not be removed",
    jobs: [
      { job_id: "job_001", source: "Source A", application_url: "https://g.co/a", company: "Google", job_title: "Data Scientist", location: "Cairo" },
      { job_id: "job_002", source: "Source B", application_url: "https://m.co/b", company: "Microsoft", job_title: "Program Manager", location: "Redmond" }
    ],
    expectedCount: 2
  }
];

console.log('--- START MODULE 2 PRIORITY DEDUPLICATION TESTS ---');
let allPassed = true;

testCases.forEach(tc => {
  const result = deduplicate(tc.jobs);
  const pass = result.length === tc.expectedCount;
  if (!pass) allPassed = false;
  
  console.log(`\nTest Case: ${tc.name}`);
  console.log(`Input Jobs Count: ${tc.jobs.length}`);
  console.log(`Expected Unique Count: ${tc.expectedCount}`);
  console.log(`Actual Unique Count: ${result.length}`);
  console.log(`PASS/FAIL: ${pass ? 'PASS' : 'FAIL'}`);
});

console.log('\n------------------------------------------------');
console.log(`Final Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
console.log('------------------------------------------------');
process.exit(allPassed ? 0 : 1);
