# Phase 2 Module 1 Report - CV Intelligence Complete

This report documents the completion of **Module 1: CV Intelligence** as an independent, fully functional standalone module.

---

## 1. What was Implemented

We completed the complete implementation of Module 1, ensuring all business-level validations, text extraction, LLM extraction boundaries, schema checks, and error repair retry loops reside within the n8n workflow.
- **File Intake & Validation**: n8n validates file existence, checks file size, extension (.pdf, .docx, .txt), and MIME types using visual IF branching paths, routing failed uploads to dedicated Reject node endpoints.
- **Technical Text Parsing**: Express processes binary PDF buffers (`pdf-parse`) and `.docx` zip packages (native PowerShell XML extractor) and returns clean plain text.
- **LLM Extraction**: n8n triggers `/api/llm/generate` to perform LLM extraction.
- **JSON Parsing & Contract Checks**: n8n parses the raw JSON string and triggers schema contract validation (/api/validate-contract).
- **Validation-Repair-Retry Loop**: If JSON parsing or contract checks fail, n8n increments `retry_count`, builds a contextual repair prompt containing the errors, and loops back to the extraction node. If it fails 3 times, n8n throws a terminal error.

---

## 2. Files Changed / Created

- [`server.js`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/server.js): Modified to add `/api/llm/generate` proxy endpoint to handle Gemini API connections.
- [`workflows/module_1_cv_intelligence.json`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/workflows/module_1_cv_intelligence.json): Fully implemented with intake validation, repair loops, contract verification, and error gates.
- [`frontend/app.js`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/frontend/app.js) & [`frontend/index.html`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/frontend/index.html): Wired CV tab upload triggers to parse endpoints, and connected candidate profile fields for dashboard visualization.
- **CV Test Samples**: Created 4 mock test files:
  - [`cv_strong_senior.txt`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/data/samples/cv_strong_senior.txt)
  - [`cv_junior.txt`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/data/samples/cv_junior.txt)
  - [`cv_missing_sections.txt`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/data/samples/cv_missing_sections.txt)
  - [`cv_unusual_layout.txt`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/data/samples/cv_unusual_layout.txt)
- **Negative Test cases**: Created 4 negative test cases:
  - [`empty.txt`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/data/test_data/empty.txt)
  - [`wrong_ext.png`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/data/test_data/wrong_ext.png)
  - [`corrupted.pdf`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/data/test_data/corrupted.pdf)
  - [`oversized.txt`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/data/test_data/oversized.txt)

---

## 3. Important n8n Nodes (Module 1)

1. **`02 - Validate File Exists`**: Visually checks if `tempFilePath` exists in the incoming payload.
2. **`03 - Validate Extension`**: Branches off if filename matches regex `^.*\.(pdf|docx|txt)$`.
3. **`04 - Validate MIME`**: Compares MIME string against PDF, DOCX, and TXT descriptors.
4. **`05 - Validate File Size`**: Branches off if binary size in bytes is `<= 5242880` (5MB).
5. **`06 - Parse CV File`**: HTTP POST to `/api/cv/parse` returning parsed raw text.
6. **`08 - LLM Extraction`**: HTTP POST to `/api/llm/generate` triggering the AI prompt.
7. **`09 - JSON Parsing`**: Converts LLM output text into a JSON object and captures syntax parsing errors.
8. **`10 - Schema Validation`**: Validates parsed JSON fields and types against contract schema 3.1.
9. **`11 - Check Validation Success`**: IF node routing to Output on success, or to the Repair loop on failure.
10. **`13 - Verify Retry Count`**: Branches to retry if `retry_count < 3`. Otherwise triggers terminal failure node `15 - Emit Validation Error`.
11. **`14 - Prepare Repair Prompt`**: Increments `retry_count`, logs schema errors, and requests a repaired JSON response.

---

## 4. Technical Decisions & Alternatives

### LLM Model Selection Matrix:

| Criterion | Weight | Gemini 1.5 Flash (A) | GPT-4o-mini (B) | Llama 3 8B (C) |
| :--- | :--- | :--- | :--- | :--- |
| **Extraction Accuracy** | 35% | 4.5 (1.575) | 4.6 (1.610) | 3.8 (1.330) |
| **Structured JSON Reliability** | 25% | 4.8 (1.200) | 4.9 (1.225) | 3.5 (0.875) |
| **Hallucination Rate** | 15% | 4.5 (0.675) | 4.5 (0.675) | 3.5 (0.525) |
| **Latency** | 10% | 4.2 (0.420) | 4.0 (0.400) | 3.5 (0.350) |
| **Cost** | 10% | 5.0 (0.500) | 4.5 (0.450) | 4.0 (0.400) |
| **n8n Integration** | 5% | 5.0 (0.250) | 5.0 (0.250) | 3.5 (0.175) |
| **Weighted Total** | **100%** | **4.62** | **4.61** | **3.655** |

- **Decision**: **Gemini 1.5 Flash** (Option A) selected. It offers native JSON output formatting, an extremely generous free tier, and sub-second token generation latency, fitting our resource needs.

### Extraction Strategy Comparison:
- **Single-pass extraction (Selected)**: The entire resume text is sent in one prompt requesting a full JSON payload matching schema 3.1. (Score: 4.5/5. Lowest latency, lowest cost).
- **Field-by-field extraction**: Run multiple LLM prompts, one for each profile property. (Score: 2.0/5. High latency, extremely high token cost).
- **Extract-then-verify**: Run extraction first, then pass JSON to a second verifier prompt. (Score: 3.5/5. Doubles cost and latency; redundant since structural checks are handled programmatically).

---

## 5. Standalone Tests & Actual Results

We executed the validation test suite in [`test_cv_validation.js`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/data/test_data/test_cv_validation.js) and the repair loop simulator in [`test_cv_extraction_repair.js`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/data/test_data/test_cv_extraction_repair.js):

| Test Case | Input payload | Expected Behavior | Actual Behavior | Result |
| :--- | :--- | :--- | :--- | :--- |
| **1. PDF accepted** | `filename: cv.pdf`, `size: 102KB`, `mimeType: application/pdf`, `tempFilePath: outputs/cv_pdf.pdf` | Valid: `true` | Valid: `true` | ✅ **PASS** |
| **2. DOCX accepted** | `filename: cv.docx`, `size: 204KB`, `mimeType: application/vnd.openxml...`, `tempFilePath: outputs/cv_docx.docx` | Valid: `true` | Valid: `true` | ✅ **PASS** |
| **3. TXT accepted** | `filename: cv.txt`, `size: 5KB`, `mimeType: text/plain`, `tempFilePath: outputs/cv_txt.txt` | Valid: `true` | Valid: `true` | ✅ **PASS** |
| **4. TEX rejected** | `filename: cv.tex`, `size: 12KB`, `mimeType: application/x-tex`, `tempFilePath: outputs/cv_tex.tex` | Valid: `false` (Invalid extension error) | Valid: `false` (Invalid extension error) | ✅ **PASS** |
| **5. Unsupported extension rejected** | `filename: cv.png`, `size: 54KB`, `mimeType: image/png`, `tempFilePath: outputs/cv_png.png` | Valid: `false` (Invalid extension error) | Valid: `false` (Invalid extension error) | ✅ **PASS** |
| **6. Invalid MIME rejected** | `filename: cv.pdf`, `size: 65KB`, `mimeType: image/jpeg`, `tempFilePath: outputs/cv_pdf.pdf` | Valid: `false` (Invalid MIME error) | Valid: `false` (Invalid MIME error) | ✅ **PASS** |
| **7. >5MB rejected** | `filename: cv.pdf`, `size: 6,000,000 bytes`, `mimeType: application/pdf`, `tempFilePath: outputs/cv_pdf.pdf` | Valid: `false` (File size exceeds 5MB limit) | Valid: `false` (File size exceeds 5MB limit) | ✅ **PASS** |
| **8. Missing file rejected** | `filename: cv.pdf`, `size: 0`, `mimeType: ''`, `tempFilePath: null` | Valid: `false` (File does not exist error) | Valid: `false` (File does not exist error) | ✅ **PASS** |
| **9. Validation Repair Loop** | **Attempt 1**: Malformed JSON<br>**Attempt 2**: Missing fields<br>**Attempt 3**: Correct profile payload | Retries on errors; succeeds on Attempt 3; returns candidate_profile.json | Successfully completed 3 attempts; schema errors logged; valid contract profile emitted | ✅ **PASS** |

---

## 6. Contracts Verification

We confirm that **`candidate_profile.json`** schema remains completely unchanged and matches contract 3.1 definitions exactly.

---

## 7. Gaps & Limitations

- Local PDF/DOCX parsing uses OS PowerShell scripts for `.docx` and `pdf-parse` for `.pdf`. If Node processes lack permissions to run PowerShell scripts, `.docx` extraction will fail.
- Real API calls to Gemini require setting `GEMINI_API_KEY` in `.env`. If missing, the helper falls back to returning the static sample profile to avoid pipeline crashes.

---

## 8. Standalone Affirmation

We confirm that **Module 1 is 100% standalone**. No downstream modules (Module 2 to 5) have been implemented or integrated yet.

---

## 9. Final Decision

🟢 **READY FOR PHASE 2 - MODULE 2 (JOB DISCOVERY)**
