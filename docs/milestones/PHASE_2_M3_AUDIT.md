# Module 3 Verification Audit - Matching & Ranking

This report documents the verification audit of **Module 3: Matching & Ranking** against the Project Brief and Phase 2 requirements.

---

## 1. Matching Approach Verification

We audited the scoring calculations in the M3 workflow nodes:

### Component 1: Keyword Score ($S_{\text{keyword}}$)
- **Input**: Candidate skills (`technical_skills`, `programming_languages`, `frameworks`, `tools`) and Job `required_skills`.
- **Calculation**: Computes intersection using synonym mappings. Score is:
  $$S_{\text{keyword}} = \frac{\text{matched\_skills.length}}{\text{required\_skills.length}} \times 100$$
  If `required_skills` is empty, defaults to `100`.
- **Output Range**: `[0, 100]`.
- **Location**: Performed in n8n Node `03 - Calculate Skill Match`.

### Component 2: Semantic Score ($S_{\text{semantic}}$)
- **Input**: Candidate `preferred_roles`/`job_titles` and `keywords`; Job `job_title` and `description`.
- **Calculation**:
  - $T_{\text{similarity}} = 1.0$ if the job title includes any candidate preferred role or past title; $0.0$ otherwise.
  - $K_{\text{similarity}} = \text{fraction of candidate keywords present in the job description}$.
  - $S_{\text{semantic}} = (T_{\text{similarity}} \times 0.5 + K_{\text{similarity}} \times 0.5) \times 100$.
- **Output Range**: `[0, 100]`.
- **Location**: Performed in n8n Node `04 - Calculate Semantic Match`.

### Component 3: Experience Score ($S_{\text{experience}}$)
- **Input**: Candidate `experience_years` and Job `required_experience_years`.
- **Calculation**:
  $$S_{\text{experience}} = \min\left(\frac{\text{candidate\_years}}{\text{required\_years}} \times 100, 100\right)$$
  If `required_years` is 0, defaults to `100`.
- **Output Range**: `[0, 100]`.
- **Location**: Performed in n8n Node `05 - Calculate Experience Match`.

---

## 2. Semantic Similarity Audit (Critical Classification)

> [!WARNING]
> **NOT TRUE SEMANTIC SIMILARITY**
> The current implementation uses Jaccard keyword overlap and substring comparisons to match titles and description text. It does NOT invoke embeddings APIs (like Gemini Embeddings) or compute vector cosine similarity. It functions as a **String Overlap Proxy**.

---

## 3. Synonym Handling Audit

- **Definition**: Synonyms are defined locally inside Node `03 - Calculate Skill Match`.
- **Casing & Normalization**: Inputs are converted to lowercase and trimmed before comparison, making checks case-insensitive.
- **Scope**: Synonym mapping affects the **keyword score only**. It does not affect the semantic string overlap proxy.
- **Test Case Verified**: `js` successfully matched against candidate programming language `JavaScript`, and `postgres` matched candidate tech skill `PostgreSQL`.

---

## 4. Scoring Formula & Manual Verification

The final score is computed as:
$$\text{Match Score} = (S_{\text{keyword}} \times 0.3) + (S_{\text{semantic}} \times 0.4) + (S_{\text{experience}} \times 0.3)$$

All division-by-zero checks are handled safely.

### Manual Verification of Test Cases:

#### Scenario A: Excellent Match
- **Input candidate**: 5 yrs exp, JavaScript/TypeScript skills, Backend title, Node.js keywords.
- **Input Job**: Backend Engineer, Node.js/JavaScript required, 3 yrs exp required.
- **Component Scores**:
  - $S_{\text{keyword}} = 100$
  - $S_{\text{semantic}} = 100$ (title and keyword matched)
  - $S_{\text{experience}} = 100$ (5 > 3)
- **Expected Score**: `(100*0.3) + (100*0.4) + (100*0.3) = 100.0`
- **Actual Score**: `100.0`
- **Result**: **PASS**

#### Scenario B: Poor Match
- **Input Job**: Data Scientist, Python/Pandas, 8 yrs exp required.
- **Component Scores**:
  - $S_{\text{keyword}} = 0.0$ (no skills match)
  - $S_{\text{semantic}} = 0.0$ (no title or description keywords match)
  - $S_{\text{experience}} = (5 / 8) * 100 = 62.5$
- **Expected Score**: `(0*0.3) + (0*0.4) + (62.5*0.3) = 18.75 (rounded to 18.8)`
- **Actual Score**: `18.8`
- **Result**: **PASS**

---

## 5. Weight Justification

> [!NOTE]
> **These are design weights, not empirically optimized weights.** No statistical cross-validation was run on large datasets to optimize these coefficients. They represent structured logical assumptions.

---

## 6. Matching Dimensions Verification

- **Skills, Programming Languages, Frameworks, Tools**: Evaluated in Keyword score.
- **Job Title & Keywords**: Evaluated in Semantic score.
- **Experience Years**: Evaluated in Experience score.
- **Education**: **Not explicitly weighted in the score**. It is preserved in the contract metadata fields but has a weight of 0% in final scoring.

---

## 7. Explanations & Ranking

- **Explanations**: Generated dynamically. Matches match results. No hardcoded or fabricated statements exist.
- **Ranking**: Confirmed descending score sorting.
- **Ties**: Resolved deterministically using alphabetical comparison of `job_id`. Verified in test case 2.

---

## 8. Contract 3.3 Compliance

We checked the structure against `data/samples/sample_ranked_jobs.json`:

| Field Name | Type | Requirement | Status |
| :--- | :--- | :--- | :--- |
| `match_score` | Number | Required | **PASS** |
| `score_breakdown` | Object | Required | **PASS** |
| `matched_skills` | Array<String>| Required | **PASS** |
| `missing_skills` | Array<String>| Required | **PASS** |
| `experience_match`| Object | Required | **PASS** |
| `decision` | String | Required | **PASS** |
| `explanation` | String | Required | **PASS** |
| `method` | String | Required | **PASS** (`"hybrid"`) |
| `ranked_at` | String | Required | **PASS** |

No undocumented fields were added.

---

## 9. n8n Architecture Alignment

- **Express**: Contains zero scoring business logic.
- **n8n M3**: Visually decomposes calculations across 9 distinct sequential nodes. It is not hidden in a single black-box block.

---

## 10. Final Decision

🟢 **M3 READY FOR M4**

### Justification:
- Deploys a deterministic, multi-dimensional scorer matching the visual 9-node workflow.
- Features explainable output fields complying exactly with Contract 3.3.
- Implements deterministic alphabetical tie-breaking and synonym parsing.
