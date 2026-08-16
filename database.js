const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.db');

// Ensure db connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    // Create applications table
    db.run(`
      CREATE TABLE IF NOT EXISTS applications (
        application_id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        company TEXT NOT NULL,
        job_title TEXT NOT NULL,
        approval_decision TEXT NOT NULL,
        application_status TEXT NOT NULL,
        submission_method TEXT NOT NULL,
        submitted_at TEXT,
        attempts INTEGER DEFAULT 0,
        confirmation_sent INTEGER DEFAULT 0,
        error_code TEXT,
        error_message TEXT,
        error_stage TEXT,
        created_at TEXT NOT NULL
      )
    `);

    // Clean up duplicate combinations before adding the unique index constraint
    db.run(`
      DELETE FROM applications 
      WHERE rowid NOT IN (
        SELECT MAX(rowid) 
        FROM applications 
        GROUP BY candidate_id, job_id
      )
    `);

    // Create unique index constraint
    db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_job ON applications (candidate_id, job_id)
    `);

    // Create logs table for timeline history
    db.run(`
      CREATE TABLE IF NOT EXISTS application_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        details TEXT,
        FOREIGN KEY (application_id) REFERENCES applications (application_id)
      )
    `);
    
    console.log('Database tables and UNIQUE constraints verified/created successfully.');
  });
}

// Helpers wrapped in Promises for async/await usage
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  initDb,
  
  // Save or update application
  saveApplication: async (app) => {
    const existing = await getQuery('SELECT 1 FROM applications WHERE application_id = ?', [app.application_id]);
    const now = new Date().toISOString();
    
    if (existing) {
      await runQuery(`
        UPDATE applications SET
          candidate_id = ?,
          job_id = ?,
          company = ?,
          job_title = ?,
          approval_decision = ?,
          application_status = ?,
          submission_method = ?,
          submitted_at = ?,
          attempts = ?,
          confirmation_sent = ?,
          error_code = ?,
          error_message = ?,
          error_stage = ?
        WHERE application_id = ?
      `, [
        app.candidate_id,
        app.job_id,
        app.company,
        app.job_title,
        app.approval_decision,
        app.application_status,
        app.submission_method,
        app.submitted_at,
        app.attempts,
        app.confirmation_sent ? 1 : 0,
        app.error ? app.error.code : (app.error_code || null),
        app.error ? app.error.message : (app.error_message || null),
        app.error ? app.error.stage : (app.error_stage || null),
        app.application_id
      ]);
    } else {
      await runQuery(`
        INSERT INTO applications (
          application_id, candidate_id, job_id, company, job_title,
          approval_decision, application_status, submission_method,
          submitted_at, attempts, confirmation_sent, error_code,
          error_message, error_stage, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        app.application_id,
        app.candidate_id,
        app.job_id,
        app.company,
        app.job_title,
        app.approval_decision,
        app.application_status,
        app.submission_method,
        app.submitted_at,
        app.attempts || 0,
        app.confirmation_sent ? 1 : 0,
        app.error ? app.error.code : (app.error_code || null),
        app.error ? app.error.message : (app.error_message || null),
        app.error ? app.error.stage : (app.error_stage || null),
        now
      ]);
    }
  },

  // Check duplicate application
  checkDuplicate: async (candidate_id, job_id) => {
    const row = await getQuery(
      'SELECT application_id FROM applications WHERE candidate_id = ? AND job_id = ? AND application_status = "submitted"',
      [candidate_id, job_id]
    );
    return !!row;
  },

  // Add a history log entry
  addLog: async (application_id, stage, status, details = '') => {
    const now = new Date().toISOString();
    await runQuery(`
      INSERT INTO application_logs (application_id, timestamp, stage, status, details)
      VALUES (?, ?, ?, ?, ?)
    `, [application_id, now, stage, status, details]);
  },

  // Get application by ID
  getApplication: async (application_id) => {
    const row = await getQuery('SELECT * FROM applications WHERE application_id = ?', [application_id]);
    if (!row) return null;
    
    // Map back to JSON contract format
    return {
      application_id: row.application_id,
      candidate_id: row.candidate_id,
      job_id: row.job_id,
      company: row.company,
      job_title: row.job_title,
      approval_decision: row.approval_decision,
      application_status: row.application_status,
      submission_method: row.submission_method,
      submitted_at: row.submitted_at,
      attempts: row.attempts,
      confirmation_sent: row.confirmation_sent === 1,
      error: row.error_code ? {
        code: row.error_code,
        message: row.error_message,
        stage: row.error_stage
      } : null,
      created_at: row.created_at
    };
  },

  // Get all applications
  getApplications: async () => {
    const rows = await allQuery('SELECT * FROM applications ORDER BY created_at DESC');
    return rows.map(row => ({
      application_id: row.application_id,
      candidate_id: row.candidate_id,
      job_id: row.job_id,
      company: row.company,
      job_title: row.job_title,
      approval_decision: row.approval_decision,
      application_status: row.application_status,
      submission_method: row.submission_method,
      submitted_at: row.submitted_at,
      attempts: row.attempts,
      confirmation_sent: row.confirmation_sent === 1,
      error: row.error_code ? {
        code: row.error_code,
        message: row.error_message,
        stage: row.error_stage
      } : null,
      created_at: row.created_at
    }));
  },

  // Get logs for an application
  getApplicationLogs: async (application_id) => {
    return await allQuery('SELECT * FROM application_logs WHERE application_id = ? ORDER BY id ASC', [application_id]);
  },

  // Get stats
  getStats: async () => {
    const totalJobsRow = await getQuery('SELECT COUNT(DISTINCT job_id) as count FROM applications');
    const totalRetrievedRow = await getQuery('SELECT COUNT(*) as count FROM applications');
    const applyCountRow = await getQuery('SELECT COUNT(*) as count FROM applications WHERE approval_decision = "APPROVED"');
    const reviewCountRow = await getQuery('SELECT COUNT(*) as count FROM applications WHERE approval_decision = "REVIEW"');
    const rejectCountRow = await getQuery('SELECT COUNT(*) as count FROM applications WHERE approval_decision = "REJECTED"');
    const submittedRow = await getQuery('SELECT COUNT(*) as count FROM applications WHERE application_status = "submitted"');
    const failedRow = await getQuery('SELECT COUNT(*) as count FROM applications WHERE application_status = "failed"');
    const pendingRow = await getQuery('SELECT COUNT(*) as count FROM applications WHERE application_status = "pending_approval"');
    const duplicateRow = await getQuery('SELECT COUNT(*) as count FROM applications WHERE application_status = "skipped_duplicate"');

    return {
      total_jobs: totalJobsRow ? totalJobsRow.count : 0,
      jobs_retrieved: totalRetrievedRow ? totalRetrievedRow.count : 0,
      apply_count: applyCountRow ? applyCountRow.count : 0,
      review_count: reviewCountRow ? reviewCountRow.count : 0,
      reject_count: rejectCountRow ? rejectCountRow.count : 0,
      submitted_count: submittedRow ? submittedRow.count : 0,
      failed_count: failedRow ? failedRow.count : 0,
      pending_count: pendingRow ? pendingRow.count : 0,
      duplicate_blocked: duplicateRow ? duplicateRow.count : 0
    };
  }
};
