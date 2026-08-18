const express = require('express');
const router = express.Router();
const db = require('../database');
const { validateContract } = require('../utils/contracts');
const { callN8nWebhook } = require('../utils/n8n_helper');

// GET /api/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    return res.status(200).json({ success: true, stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/applications
router.get('/applications', async (req, res) => {
  try {
    const apps = await db.getApplications();
    return res.status(200).json({ success: true, applications: apps });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/applications/:id
router.get('/applications/:id', async (req, res) => {
  try {
    const appInfo = await db.getApplication(req.params.id);
    if (!appInfo) return res.status(404).json({ success: false, message: 'Application not found' });
    const logs = await db.getLogs(req.params.id);
    return res.status(200).json({ success: true, application: appInfo, logs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/applications
router.post('/applications', async (req, res) => {
  try {
    const appPayload = req.body;
    const check = validateContract('application_status', appPayload);
    if (!check.valid) {
      return res.status(400).json({ success: false, message: 'Contract validation failed', errors: check.errors });
    }

    await db.saveApplication(appPayload);
    await db.addLog(
      appPayload.application_id,
      'db_persistence',
      appPayload.application_status,
      `State updated to: ${appPayload.application_status}`
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/applications/:id/log
router.post('/applications/:id/log', async (req, res) => {
  try {
    const { stage, status, details } = req.body;
    await db.addLog(req.params.id, stage, status, details);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/applications/check-duplicate
router.post('/applications/check-duplicate', async (req, res) => {
  try {
    const { candidate_id, job_id } = req.body;
    const isDuplicate = await db.checkDuplicate(candidate_id, job_id);
    return res.status(200).json({ success: true, duplicate: isDuplicate });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/approval/decide
router.post('/approval/decide', async (req, res) => {
  try {
    const { application_id, decision } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be APPROVED or REJECTED.' });
    }
    
    const appInfo = await db.getApplication(application_id);
    if (!appInfo) return res.status(404).json({ success: false, message: 'Application not found.' });

    if (appInfo.application_status === 'submitted' || appInfo.application_status === 'skipped_duplicate' || appInfo.application_status === 'skipped_timeout') {
      return res.status(400).json({ success: false, message: `Invalid state transition from current status: ${appInfo.application_status}` });
    }

    const n8nRes = await callN8nWebhook('m5-decide', { application_id, decision });
    const responseData = Array.isArray(n8nRes.data) ? n8nRes.data[0] : n8nRes.data;

    if (n8nRes.statusCode >= 200 && n8nRes.statusCode < 300) {
      const updatedApp = await db.getApplication(application_id);
      return res.status(200).json({ success: true, application: updatedApp || responseData });
    } else {
      // Fallback local decide update if n8n offline
      const newStatus = decision === 'APPROVED' ? 'submitted' : 'rejected';
      await db.updateApplicationStatus(application_id, newStatus, decision);
      await db.addLog(application_id, 'human_approval', newStatus, `Application was ${decision} by operator.`);
      const updatedApp = await db.getApplication(application_id);
      return res.status(200).json({ success: true, application: updatedApp });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/applications/submit
router.post('/applications/submit', async (req, res) => {
  try {
    const pkg = req.body;
    if (!pkg.candidate_id || !pkg.job_id) {
      return res.status(400).json({ success: false, message: 'candidate_id and job_id are required.' });
    }

    const isDuplicate = await db.checkDuplicate(pkg.candidate_id, pkg.job_id);
    if (isDuplicate) {
      return res.status(400).json({ success: false, message: 'Duplicate submission blocked by database UNIQUE constraint.' });
    }

    try {
      const n8nRes = await callN8nWebhook('m5-intake', pkg);
      const responseData = n8nRes.data ? (Array.isArray(n8nRes.data) ? n8nRes.data[0] : n8nRes.data) : null;

      if (n8nRes.statusCode >= 200 && n8nRes.statusCode < 300) {
        if (responseData && responseData.success === false) {
          const errMsg = responseData.message || '';
          if (errMsg.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ success: false, message: 'Duplicate submission blocked by database UNIQUE constraint.' });
          }
        }
        const app = responseData ? (responseData.application || responseData) : null;
        return res.status(200).json({ success: true, application: app });
      }
    } catch (n8nErr) {
      // Fallback local application submission
    }

    const application_id = 'app_' + Math.random().toString(36).substr(2, 6);
    const newApp = {
      application_id,
      candidate_id: pkg.candidate_id,
      job_id: pkg.job_id,
      company: pkg.company || 'Tech Company',
      job_title: pkg.job_title || 'Software Engineer',
      approval_decision: 'PENDING',
      application_status: 'pending_approval',
      submission_method: 'mock',
      attempts: 0,
      confirmation_sent: false,
      cv_file: pkg.cv_file || `outputs/${pkg.candidate_id}_${pkg.job_id}_tailored.pdf`,
      cover_letter_file: pkg.cover_letter_file || `outputs/${pkg.candidate_id}_${pkg.job_id}_cover_letter.txt`,
      created_at: new Date().toISOString()
    };

    await db.saveApplication(newApp);
    await db.addLog(application_id, 'intake', 'pending_approval', 'Application submitted to approval queue');

    return res.status(200).json({ success: true, application: newApp });

  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, message: 'Duplicate submission blocked by database UNIQUE constraint.' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Mock portal submission endpoints
router.post('/mock/submit', (req, res) => {
  const { job_id, candidate_id } = req.body;
  return res.status(200).json({
    success: true,
    application_id: 'app_' + Math.random().toString(36).substr(2, 9),
    submitted_at: new Date().toISOString()
  });
});

router.post('/mock/send-notification', (req, res) => {
  const { email, company, job_title } = req.body;
  console.log(`Mock Email Notification sent to ${email} for job ${job_title} at ${company}`);
  return res.status(200).json({ success: true, message: 'Notification queued successfully.' });
});

// Timeout ticker (120s)
setInterval(async () => {
  try {
    const apps = await db.getApplications();
    const now = Date.now();
    for (const app of apps) {
      if (app.application_status === 'pending_approval') {
        const createdTime = new Date(app.created_at || now).getTime();
        const elapsed = (now - createdTime) / 1000;
        if (elapsed >= 120) {
          console.log(`Application ${app.application_id} timed out. Triggering timeout...`);
          try {
            await callN8nWebhook('m5-timeout', { application_id: app.application_id });
          } catch(e) {
            await db.updateApplicationStatus(app.application_id, 'skipped_timeout', 'REJECTED');
            await db.addLog(app.application_id, 'approval', 'skipped_timeout', 'No response from human operator before timeout.');
          }
        }
      }
    }
  } catch (err) {
    console.error('Timeout check ticker error:', err);
  }
}, 5000);

module.exports = router;
