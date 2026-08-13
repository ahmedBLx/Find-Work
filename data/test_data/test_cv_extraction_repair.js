// Test suite for Module 1 AI Extraction, JSON Parsing, and Contract Validation Repair Loop

const validateContract = (data) => {
  const required = [
    'schema_version', 'candidate_id', 'candidate_name', 'email', 'experience_years',
    'job_titles', 'preferred_roles', 'technical_skills', 'programming_languages',
    'frameworks', 'tools', 'keywords', 'education', 'extraction_meta'
  ];
  const errors = [];
  required.forEach(f => {
    if (data[f] === undefined || data[f] === null) {
      errors.push(`Missing field: ${f}`);
    }
  });
  return { valid: errors.length === 0, errors };
};

const runM1ExtractionLoop = (mockLlmResponses) => {
  let retryCount = 0;
  let currentResponse = null;
  let parsedJson = null;
  let errorMsg = null;
  
  while (retryCount < 3) {
    currentResponse = mockLlmResponses[retryCount];
    
    // Simulate JSON parsing
    try {
      parsedJson = JSON.parse(currentResponse);
      errorMsg = null;
    } catch (e) {
      errorMsg = 'Invalid JSON: ' + e.message;
      parsedJson = null;
    }
    
    // If JSON parsing passed, run Schema validation
    if (parsedJson) {
      const validation = validateContract(parsedJson);
      if (validation.valid) {
        return { success: true, attempts: retryCount + 1, data: parsedJson, error: null };
      } else {
        errorMsg = 'Schema validation errors: ' + validation.errors.join(', ');
      }
    }
    
    console.log(`[Attempt ${retryCount + 1}] Failed with error: "${errorMsg}". Preparing repair prompt...`);
    retryCount++;
  }
  
  return { success: false, attempts: retryCount, data: null, error: errorMsg };
};

// Scenario A: Malformed JSON on attempt 1, Schema violation on attempt 2, success on attempt 3!
const mockResponsesScenarioA = [
  "This is not valid JSON string", // Attempt 1: Parse error
  JSON.stringify({ schema_version: "1.0", candidate_id: "cand_123" }), // Attempt 2: Schema validation error (missing fields)
  JSON.stringify({ // Attempt 3: Valid JSON and Schema compliant
    schema_version: "1.0",
    candidate_id: "cand_123",
    candidate_name: "Jane Doe",
    email: "jane@example.com",
    experience_years: 5.0,
    job_titles: ["Software Engineer"],
    preferred_roles: ["Backend Developer"],
    technical_skills: ["Node.js"],
    programming_languages: ["JavaScript"],
    frameworks: ["Express"],
    tools: ["Git"],
    keywords: ["Backend Engineer"],
    education: [],
    extraction_meta: { model: "gemini-1.5-flash", prompt_version: "1.0", extracted_at: new Date().toISOString(), confidence: 1.0 }
  })
];

console.log('--- START MODULE 1 REPAIR LOOP SIMULATION ---');
console.log('\nRunning Scenario A (Validation-Repair-Retry Loop test):');
const result = runM1ExtractionLoop(mockResponsesScenarioA);
console.log('\nFinal Run Result:');
console.log(`Success: ${result.success}`);
console.log(`Total Attempts: ${result.attempts}`);
console.log(`Data Compliant: ${result.success ? 'Yes (All contract fields populated)' : 'No'}`);
console.log(`Error Status: ${result.error}`);
