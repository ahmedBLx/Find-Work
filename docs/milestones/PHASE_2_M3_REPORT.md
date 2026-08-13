# Phase 2 Module 3 Report - Matching & Ranking Complete

This report documents the completion of **Module 3: Matching & Ranking** as an independent, fully functional standalone module.

---

## 1. What was Implemented

We completed the complete implementation of Module 3, ensuring all matching, scoring, ranking, explanation, and contract check logic reside in n8n.
- **Scoring Formulas**: Implemented a multi-dimensional scoring matrix checking Keyword Skill Overlap, Experience Year Satisfication, and Semantic role/keyword description overlap.
- **Explainable Scores**: Each ranked job is output with a complete score breakdown (`keyword_score`, `semantic_score`, `experience_score`), weight settings, matching skills, missing skills, and a human-readable explanation sentence.
- **Deterministic Ranking**: Sorts descending by `match_score`, and breaks ties alphabetically using the `job_id` property.
- **9-Node Visual n8n Workflow**: Disassembles features parsing, skills validation, semantic overlaps, experience checking, aggregation, decision mapping, ranking, and schema checks into visual nodes.
- **Synonyms Engine**: Evaluates overlapping terms (e.g. mapping `js` to `javascript`, `postgres` to `postgresql`) to improve keyword match accuracy.

---

## 2. Important n8n Nodes (Module 3)

The workflow [`module_3_matching_ranking.json`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/workflows/module_3_matching_ranking.json) maps 9 visual processing nodes:
1. **`01 - Receive Inputs`**: Trigger node taking candidate profile and jobs list.
2. **`02 - Parse Input Features`**: Asserts payload presence and outputs features.
3. **`03 - Calculate Skill Match`**: Resolves skill overlaps and maps synonyms.
4. **`04 - Calculate Semantic Match`**: Computes Jaccard text overlap on preferred roles and description keywords.
5. **`05 - Calculate Experience Match`**: Compares years of experience and checks satisfaction.
6. **`06 - Generate Decisions & Explanations`**: Computes weighted `match_score` (30/40/30) and decision status (`APPLY`/`REVIEW`/`SKIP`).
7. **`07 - Sort & Rank Jobs`**: Sorts jobs descending by score and resolves ties by job ID.
8. **`08 - Validate Contract`**: POST request to `/api/validate-contract` with schema `ranked_jobs`.
9. **`09 - Return Final Ranked Jobs`**: Confirms valid contract schema and returns payload.

---

## 3. Matching Strategy & Decision Matrix

### Scoring Approaches Investigated:

1. **Weighted Keyword Matching**: Evaluates intersection of candidate skills with job required skills. (High explainability, simple, but ignores non-keyword descriptions).
2. **TF-IDF Cosine Similarity**: Evaluates term-frequency vector overlaps. (Prone to noise, low explainability, complex to run natively in n8n).
3. **Semantic Embedding Similarity**: Calls embedding model APIs and computes vector dot product. (High semantic context, but acts as a black box and has high latency/costs).
4. **Hybrid Approach (Selected)**: Combines structured keyword checks (30%), experience years (30%), and descriptive Jaccard overlap (40%).

### Decision Matrix:

| Criterion | Weight | Keyword Match (A) | TF-IDF (B) | Embedding (C) | Hybrid Match (Selected) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Accuracy/Relevance** | 30% | 4.0 (1.20) | 4.0 (1.20) | 4.8 (1.44) | 4.7 (1.41) |
| **Explainability** | 25% | 5.0 (1.25) | 2.0 (0.50) | 1.5 (0.375) | 5.0 (1.25) |
| **Implementation Complexity** | 20% | 4.8 (0.96) | 3.0 (0.60) | 2.5 (0.50) | 4.5 (0.90) |
| **n8n Suitability** | 15% | 5.0 (0.75) | 2.5 (0.375) | 3.0 (0.45) | 4.8 (0.72) |
| **Cost / Latency** | 10% | 5.0 (0.50) | 4.0 (0.40) | 2.5 (0.25) | 4.8 (0.48) |
| **Weighted Total** | **100%** | **4.66** | **3.075** | **3.015** | **4.76** |

---

## 4. Scoring Formula & Weights Justification

Our hybrid matching formula computes:
$$\text{Match Score} = (S_{\text{keyword}} \times 0.3) + (S_{\text{semantic}} \times 0.4) + (S_{\text{experience}} \times 0.3)$$

### Weight Justifications:
- **Semantic Score ($S_{\text{semantic}}$ - 40%)**: Heaviest weight. Determines context relevance (e.g. matching preferred backend title with backend descriptions), preventing mismatches based on stray keywords.
- **Keyword Score ($S_{\text{keyword}}$ - 30%)**: Verifies strict core technical requirements (languages, frameworks) utilizing synonym mapping.
- **Experience Score ($S_{\text{experience}}$ - 30%)**: Validates career trajectory compliance (exceeding experience gives 100%; falling short scales down the score linearly).

---

## 5. Standalone Tests & Actual Results

We executed the scorer test suite in [`test_matching_ranking.js`](file:///c:/Users/HEllo/Desktop/AI%20Based%20Project/data/test_data/test_matching_ranking.js):

- **Test Case 1: Match Ranking Order**: Proves that an excellent match (`job_01` with score 100) ranks above a poor match (`job_02` with score 18.8). ✅ **PASS**
- **Test Case 2: Deterministic Tie-Breaker**: Proves that when scores are identical, jobs are sorted alphabetically by `job_id` (`job_03` before `job_04`). ✅ **PASS**
- **Test Case 3: Synonyms Mapping**: Proves that `js` and `postgres` correctly match against candidate skills `JavaScript` and `PostgreSQL`. ✅ **PASS**

---

## 6. Edge Cases Handled

- **Empty/Missing Job Experience**: Handled by defaulting `required_experience_years` to 0, which awards 100% experience match score.
- **Empty Job Skills**: Handled by giving 100% skill match (ignores checks when no skills are requested).
- **Same Score**: Handled by deterministic locale comparison sorting of job IDs.

---

## 7. Gaps & Limitations

- The semantic similarity uses Jaccard overlaps and keyword matching in descriptions. While highly explainable and fast, it does not evaluate deep textual semantics as a vector model would.

---

## 8. Standalone Affirmation

We confirm that **Module 3 is 100% standalone** and independent. No CV tailoring (M4) or submission tracking (M5) logic has been started or modified.

---

## 9. Final Decision

🟢 **M3 READY FOR M4 (CV TAILORING & DOCUMENTS)**
