require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure required directories exist
const outputsDir = path.join(__dirname, 'outputs');
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}

// Static Files Serving
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/outputs', express.static(outputsDir));

/* ========================================================================= */
/* MODULAR ROUTES MOUNTING (M1 to M6)                                        */
/* ========================================================================= */
// Module 1: CV Intelligence & Extraction
app.use('/api/cv', require('./routes/m1_cv_intelligence'));

// Module 2: Job Discovery (Live & Mock Feeds)
app.use('/api', require('./routes/m2_job_discovery'));
app.use('/api/jobs', require('./routes/m2_job_discovery'));

// Module 3: Matching & Ranking Engine
app.use('/api/match', require('./routes/m3_matching_ranking'));

// Module 4: Contextual Document Tailoring (LaTeX, PDF, Cover Letter)
app.use('/api/documents', require('./routes/m4_document_tailoring'));
app.use('/api/cv', require('./routes/m4_document_tailoring'));

// Module 5: Application Tracking, Database Persistence & Human Approvals
app.use('/api', require('./routes/m5_application_tracking'));

// Module 6: End-to-End Autonomous Pipeline & n8n Orchestrator
app.use('/api/n8n', require('./routes/m6_e2e_pipeline'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ========================================================================= */
/* START SERVER ENTRYPOINT                                                   */
/* ========================================================================= */
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Job Hunter Agent Backend running on: http://localhost:${PORT}`);
  console.log(`Modular Architecture active across Modules 1 to 6`);
  console.log(`=======================================================`);
});

module.exports = app;
