// Test Suite for Module 1 Validation Logic (mimicking n8n IF nodes)

const validationLogic = (jsonInput) => {
  const errors = [];
  
  // 1. Validate File Exists
  const exists = !!jsonInput.tempFilePath;
  if (!exists) {
    return { valid: false, stage: 'Validate File Exists', error: 'File validation failed: File does not exist.' };
  }

  // 2. Validate Extension
  const extensionCheck = /^.*\.(pdf|docx|txt)$/i.test(jsonInput.filename);
  if (!extensionCheck) {
    return { valid: false, stage: 'Validate Extension', error: 'File validation failed: Invalid extension. Supported: .pdf, .docx, .txt.' };
  }

  // 3. Validate MIME Type
  const mimeCheck = /^(application\/pdf|text\/plain|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/octet-stream)$/i.test(jsonInput.mimeType);
  if (!mimeCheck) {
    return { valid: false, stage: 'Validate MIME', error: 'File validation failed: Invalid MIME type.' };
  }

  // 4. Validate File Size
  const sizeCheck = jsonInput.size <= 5242880;
  if (!sizeCheck) {
    return { valid: false, stage: 'Validate File Size', error: 'File validation failed: File size exceeds 5MB limit.' };
  }

  return { valid: true, stage: 'All Checks Passed', error: null };
};

const testCases = [
  {
    name: '1. PDF accepted',
    input: { filename: 'cv.pdf', size: 102400, mimeType: 'application/pdf', tempFilePath: 'outputs/cv_pdf.pdf' },
    expected: { valid: true }
  },
  {
    name: '2. DOCX accepted',
    input: { filename: 'cv.docx', size: 204800, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', tempFilePath: 'outputs/cv_docx.docx' },
    expected: { valid: true }
  },
  {
    name: '3. TXT accepted',
    input: { filename: 'cv.txt', size: 5000, mimeType: 'text/plain', tempFilePath: 'outputs/cv_txt.txt' },
    expected: { valid: true }
  },
  {
    name: '4. TEX rejected',
    input: { filename: 'cv.tex', size: 12000, mimeType: 'application/x-tex', tempFilePath: 'outputs/cv_tex.tex' },
    expected: { valid: false, error: 'Invalid extension' }
  },
  {
    name: '5. Unsupported extension rejected',
    input: { filename: 'cv.png', size: 54000, mimeType: 'image/png', tempFilePath: 'outputs/cv_png.png' },
    expected: { valid: false, error: 'Invalid extension' }
  },
  {
    name: '6. Invalid MIME rejected',
    input: { filename: 'cv.pdf', size: 65000, mimeType: 'image/jpeg', tempFilePath: 'outputs/cv_pdf.pdf' },
    expected: { valid: false, error: 'Invalid MIME type' }
  },
  {
    name: '7. >5MB rejected',
    input: { filename: 'cv.pdf', size: 6000000, mimeType: 'application/pdf', tempFilePath: 'outputs/cv_pdf.pdf' },
    expected: { valid: false, error: 'File size exceeds 5MB limit' }
  },
  {
    name: '8. Missing file rejected',
    input: { filename: 'cv.pdf', size: 0, mimeType: '', tempFilePath: null },
    expected: { valid: false, error: 'File does not exist' }
  }
];

console.log('--- START MODULE 1 VALIDATION TESTING ---');
let allPassed = true;

testCases.forEach(tc => {
  const actual = validationLogic(tc.input);
  const pass = actual.valid === tc.expected.valid && (!tc.expected.error || actual.error.includes(tc.expected.error));
  if (!pass) allPassed = false;
  
  console.log(`\nTest Case: ${tc.name}`);
  console.log(`Input: ${JSON.stringify(tc.input)}`);
  console.log(`Expected Valid: ${tc.expected.valid}${tc.expected.error ? ` (Err: ${tc.expected.error})` : ''}`);
  console.log(`Actual Valid: ${actual.valid}${actual.error ? ` (Err: ${actual.error})` : ''}`);
  console.log(`Result: ${pass ? '✅ PASS' : '❌ FAIL'}`);
});

console.log('\n----------------------------------------');
console.log(`Overall Status: ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
console.log('----------------------------------------');
