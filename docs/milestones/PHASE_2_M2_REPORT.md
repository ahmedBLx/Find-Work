# Phase 2 Module 2 Report - Job Discovery Complete

This report documents the completion of **Module 2: Job Discovery** as an independent, fully functional standalone module.

---

## 1. What was Implemented

We completed the complete implementation of Module 2, ensuring all job discovery, source query, response handling, normalization, deduplication, and contract validation logic reside within n8n.
- **Two Independent Source Adapters**: Configured connections to Source A (`GlobalJobs API` via `/api/mock/source-a`) and Source B (`TechCareers API` via `/api/mock/source-b`).
- **13-Node Visual Workflow**: Conformed exactly to the user-specified 13-node structure, avoiding hidden black boxes in n8n.
- **Priority Deduplication Engine**: Replaced the overly aggressive `company + title` check with a robust 3-stage validation priority:
  1. `source + sourceJobId` (exact identifier check)
  2. `normalized URL` (same job across different aggregators)
  3. Fallback: `company + title + location` (exact same job role at the same branch, preserving different office locations).
- **Contract Schema Validation**: Merged outputs are validated against Contract 3.2 `jobs.json` before emitting the final payload.
- **Error and Recovery Management**: If one source fails (returns 500 or timeout), M2 captures the error safely, continues execution, and merges jobs from the remaining operational source.

---

## 2. Important n8n Nodes (Module 2)

The workflow [`module_2_job_discovery.json`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/workflows/module_2_job_discovery.json) implements exactly the 13 required nodes:
1. **`01 - Receive Search Criteria`**: Receives search parameters (`query`, `location`, `page`).
2. **`02 - Prepare Source A Request`**: Sets parameters for Source A (`query`, `location`).
3. **`03 - Query Source A`**: GET request to `/api/mock/source-a` (Configured with Ignore Errors).
4. **`04 - Handle Source A Response`**: Isolates parsing errors and returns empty array on failure.
5. **`05 - Normalize Source A Jobs`**: Formats Source A parameters into Contract 3.2 schema.
6. **`06 - Prepare Source B Request`**: Sets parameters for Source B (`q`, `loc`).
7. **`07 - Query Source B`**: GET request to `/api/mock/source-b` (Configured with Ignore Errors).
8. **`08 - Handle Source B Response`**: Isolates parsing errors and returns empty array on failure.
9. **`09 - Normalize Source B Jobs`**: Formats Source B parameters into Contract 3.2 schema.
10. **`10 - Combine Results`**: Combines normalized jobs from both sources.
11. **`11 - Deduplicate Jobs`**: Eliminates duplicates based on URL, Job ID, and fallback keys.
12. **`12 - Validate jobs.json Contract`**: Posts the combined payload to the contract checker.
13. **`13 - Return Final Jobs`**: Validates result and outputs the final JSON payload.

---

## 3. Two Source Adapters & Normalization Strategy

We query two independent mock sources with different API schemas:

| Property | Source A (`GlobalJobs API`) | Source B (`TechCareers API`) | Normalized Output (`jobs.json`) |
| :--- | :--- | :--- | :--- |
| **Job Identifier** | `id` (e.g. `job_a_01`) | `id` (e.g. `job_b_01`) | `job_id` (prefixed with `src_a_` or `src_b_`) |
| **Title** | `title` | `jobTitle` | `job_title` |
| **Company** | `company` | `companyName` | `company` |
| **Location** | `loc` | `locationInfo` | `location` |
| **Description** | `desc` | `jobDescription` | `description` |
| **URL** | `url` | `jobUrl` | `application_url` |
| **Skills** | `skills_required` (comma string) | `skills` (string array) | `required_skills` (string array) |
| **Experience** | `experience_req_years` (number) | `experienceYears` (number) | `required_experience_years` (number) |
| **Timestamp** | `posted` | `retrieved` | `retrieved_at` |

---

## 4. Priority Deduplication & Pagination Strategy

- **Deduplication Priority**:
  1. **Source Job ID**: Checks if `source|job_id` has been encountered.
  2. **Normalized URL**: Trims protocols (`http://` vs `https://`) and trailing slashes.
  3. **Fallback Key**: Normalizes case and whitespace for `${company}|${title}|${location}`. It preserves the same job at different locations (e.g., Cairo vs London) as separate entries.
- **Pagination**: Capped at limit checks inside request nodes. Exposes `page` offset variables.
- **Rate-limit / Errors**: Ignored HTTP errors allow partial results if one source goes down.

---

## 5. Standalone Tests & Actual Results

We executed the job discovery test suite in [`test_job_discovery.js`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/data/test_data/test_job_discovery.js) covering the 10 deduplication test cases:

| Test Case | Description | Expected Count | Actual Count | Result |
| :--- | :--- | :--- | :--- | :--- |
| **1. Same ID** | Exact same source + sourceJobId | 1 | 1 | ✅ **PASS** |
| **2. Diff ID** | Same source + different sourceJobId | 2 | 2 | ✅ **PASS** |
| **3. Diff Source** | Different sources + different ID (same URL) | 1 | 1 | ✅ **PASS** |
| **4. URL Format** | Same URL with trailing slash / protocol differences | 1 | 1 | ✅ **PASS** |
| **5. Diff Location** | Same company + same title + different location | 2 | 2 | ✅ **PASS** |
| **6. Same Location** | Same company + same title + same location (fallback) | 1 | 1 | ✅ **PASS** |
| **7. Diff Company** | Different companies + same title | 2 | 2 | ✅ **PASS** |
| **8. Case Diff** | Case differences in title/company/location | 1 | 1 | ✅ **PASS** |
| **9. Missing ID** | Empty/missing sourceJobId (falls back to URL) | 1 | 1 | ✅ **PASS** |
| **10. Diff Jobs** | Genuinely different jobs | 2 | 2 | ✅ **PASS** |

---

## 6. Gaps, Mocking & Limitations

- External APIs are mocked in the Express layer. Production keys for LinkedIn/Indeed API require official OAuth registration.

---

## 7. Standalone Affirmation

We confirm that **Module 2 is 100% standalone** and independent. No matching (M3), tailoring (M4), or application (M5) features have been started or modified.

---

## 8. Final Decision

🟢 **M2 READY FOR M3 (MATCHING & RANKING)**
