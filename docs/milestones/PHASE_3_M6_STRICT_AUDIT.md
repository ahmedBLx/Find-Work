# Phase 3 — M6 Strict Audit Report

This document reports the findings of a strict audit of the current Job Hunter Agent M6 implementation against the requirements for a fully real, non-simulated n8n-orchestrated pipeline.

---

## 1. Audit Table

| Requirement | Code File / Workflow Inspected | Status | Finding & Evidence |
|---|---|---|---|
| **No M6 Simulation** | `server.js` | **PASS** | Checked `server.js` for `runM6WorkflowSim`, `simulateM6`, `fakeM6`. None found. Programmatic E2E simulation is not present. |
| **No M5 Simulation** | `server.js` (lines 544-655) | **FAIL / BLOCKER** | Checked `server.js`. Found `runM5WorkflowSim()` which dynamically reads `workflows/module_5_application_tracking.json` and programmatically fakes duplicate checking, register pending status, wait, decides, timeout, and mock submissions in JS. |
| **Orchestration Logic inside Express** | `server.js` | **FAIL / BLOCKER** | Express contains M5 orchestration logic via `runM5WorkflowSim()`. |
| **Orchestration Logic inside Frontend** | `frontend/app.js` | **PASS** | Checked `app.js`. `runE2EPipeline()` only collects data, POSTs to `/api/n8n/run`, and passes the results to `renderPipelineResults()`. The frontend contains no orchestration logic or state machines. |
| **Direct M3 Scoring Logic in Frontend** | `frontend/app.js` | **PASS** | Checked `app.js`. Standalone matching uses `recalculateMatchScores()`, which makes a POST fetch to backend `/api/match/rank`. The frontend does not calculate scores locally. |
| **Direct M5 State Transitions in Frontend** | `frontend/app.js` | **PASS** | Checked `app.js`. The frontend does not initiate state updates or handle database state changes. It only collects user decisions and requests updates via backend routes `/api/approval/decide`. |
| **Direct M5 State Transitions in Backend** | `server.js` | **FAIL / BLOCKER** | Backend `/api/applications/submit` and `/api/approval/decide` directly change SQLite records to `submitted`, `failed`, `skipped_human_rejection`, `skipped_timeout`, or `skipped_duplicate` using simulated Javascript rather than calling n8n. |
| **APPLY Filtering outside n8n** | `workflows/Complete_Job_Hunter.json` | **PASS** | Node 04 in `Complete_Job_Hunter.json` performs `ranked_jobs.filter(j => j.decision === 'APPLY')` correctly in the n8n orchestrator. |
| **Duplicate Checking outside n8n** | `server.js` | **FAIL / BLOCKER** | While `/api/applications/check-duplicate` is a simple SQLite query wrapper, the business logic deciding duplicate state (`skipped_duplicate` vs `pending_approval`) is faked inside `runM5WorkflowSim('intake')`. |
| **Timeout Decisions outside n8n** | `server.js` | **FAIL / BLOCKER** | The background timeout checker daemon in `server.js` (lines 708-725) directly updates application database records to `skipped_timeout` and writes error logs, bypassing the n8n workflow engine. |
| **Direct Portal Submission outside n8n** | `server.js` | **FAIL / BLOCKER** | The backend `/api/applications/submit` directly returns the simulated intake result of `runM5WorkflowSim` which mocks the submission outcome, bypassing n8n. |
| **Fake/Simulated Workflow Execution** | `server.js` | **FAIL / BLOCKER** | `runM5WorkflowSim()` dynamically runs n8n JSON nodes in Node.js instead of letting n8n run them. |
| **Manual Trigger Nodes in Workflows** | `workflows/module_3_matching_ranking.json`<br>`workflows/module_5_application_tracking.json` | **FAIL / BLOCKER** | Both Module 3 and Module 5 workflows utilize `manualTrigger` nodes at their entry points, making them unreachable by HTTP webhooks. |
| **ExecuteWorkflow Nodes (non-functional)** | Workflows | **PASS** | No broken/fake ExecuteWorkflow nodes are used. |
| **Hardcoded Business Decisions** | `server.js` | **FAIL / BLOCKER** | M5 business decisions are hardcoded inside `runM5WorkflowSim()`. |
| **Database Concurrency Protection** | `database.js` | **PASS** | Checked `database.js`. UNIQUE index `idx_candidate_job` is created and SQLite UNIQUE constraint is active on `(candidate_id, job_id)`. |

---

## 2. Audit Conclusion & Blockers Identified

1. **Express Server Simulation Blocker**: The Express backend contains `runM5WorkflowSim()` which fakes the M5 workflow.
2. **Stateless Webhooks Missing Blocker**: `module_3_matching_ranking.json` and `module_5_application_tracking.json` are using `manualTrigger` nodes and cannot be called via real HTTP POST webhooks.
3. **M5 Decides & Timeout Bypass Blocker**: The backend decides duplicate status, timeout state, human rejection state, and portal submission outcome in JS instead of calling n8n.
