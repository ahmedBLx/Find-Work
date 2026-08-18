/**
 * ==============================================================================
 * MODULE 6: E2E PIPELINE ORCHESTRATION (الطيار الآلي وخط الإنتاج الشامل)
 * ==============================================================================
 * الترتيب المنطقي للعمليات في هذا الملف:
 * 1. فحص اتصال محرك الأتمتة n8n في السيرفر وتحديث شارة الحالة (Online / Offline).
 * 2. قراءة بيانات المرشح وقائمة الوظائف المجلوبة.
 * 3. تشغيل الـ Pipeline الشامل عبر الـ 6 مراحل آلياً دون تدخل يدوي:
 *    [M1 Candidate] -> [M2 Jobs] -> [M3 Ranking] -> [APPLY Filter] -> [M4 Tailoring] -> [M5 Tracking]
 * 4. تحريك وإضاءة مؤشرات التقدم الستة باللون الأخضر أثناء التنفيذ.
 * 5. عرض بطاقات نتائج أنيقة لكل وظيفة مؤهلة مع أزرار لمشاهدة الـ PDF وغلاف الخطاب وبوابة الموافقات.
 * ==============================================================================
 */

/**
 * [الخطوة 1]: فحص حالة اتصال n8n مع السيرفر
 * وظيفتها: تحديث الشارة في أعلى الصفحة إلى الأخضر (Online) أو الأحمر (Offline).
 */
async function checkN8nStatus() {
  const badge = document.getElementById('n8n-status-badge');
  const offlinePanel = document.getElementById('n8n-offline-panel');
  if (!badge) return;

  badge.textContent = '● Checking...';
  badge.style.color = '';
  badge.style.border = '';

  try {
    const res = await fetch(`${API_BASE}/n8n/status`);
    const data = await res.json();

    if (data.online) {
      badge.textContent = '● n8n Online';
      badge.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
      badge.style.color = '#22c55e';
      badge.style.border = '1px solid #22c55e';
      if (offlinePanel) offlinePanel.classList.add('hidden');
    } else {
      badge.textContent = '● n8n Offline';
      badge.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      badge.style.color = '#ef4444';
      badge.style.border = '1px solid #ef4444';
      if (offlinePanel) offlinePanel.classList.remove('hidden');
    }
  } catch (err) {
    badge.textContent = '● Status Unknown';
    badge.style.color = '#f59e0b';
    badge.style.border = '1px solid #f59e0b';
    console.error('n8n status check failed:', err);
  }
}

/**
 * [الخطوة 2]: تلوين وتحريك مؤشر كل مرحلة من مراحل الـ Pipeline الستة
 * وظيفتها: تحويل المؤشر إلى اللون الأزرق (Active) أثناء المعالجة وإلى الأخضر (Done) عند الانتهاء.
 */
function setPipelineStep(stepId, state) {
  const el = document.getElementById(stepId);
  if (!el) return;
  el.classList.remove('active');
  if (state === 'active') el.classList.add('active');
  if (state === 'done') {
    el.style.background = 'rgba(34, 197, 94, 0.2)';
    el.style.border = '1px solid #22c55e';
  }
}

/**
 * [الخطوة 3]: تشغيل خط الإنتاج الشامل بالكامل (Core M6 Pipeline Action)
 * وظيفتها:
 * 1. جمع بيانات المرشح والوظائف.
 * 2. إرسالها لـ n8n والسيرفر لتنفيذ التقييم والفلترة وتوليد الملفات.
 * 3. تحريك خطوات التقدم على الشاشة خطوة بخطوة.
 * 4. عرض بطاقات الوظائف الجاهزة والموافقة عليها.
 */
async function runE2EPipeline() {
  if (!currentCandidateProfile) {
    const saved = localStorage.getItem('saved_candidate_profile');
    if (saved) {
      try { currentCandidateProfile = JSON.parse(saved); } catch(e){}
    }
  }

  if (!currentCandidateProfile) {
    alert('لا يوجد بروفايل مرشح محمل. برجاء رفع وتحليل CV أولاً من خطوة CV Intelligence.');
    showView('cv-intelligence');
    return;
  }
  if (!currentRetrievedJobs || currentRetrievedJobs.length === 0) {
    alert('لا توجد وظائف مجلوبة. برجاء إجراء البحث أولاً من خطوة Job Discovery.');
    showView('job-discovery');
    return;
  }

  const statusEl = document.getElementById('pipeline-run-status');
  const progressPanel = document.getElementById('pipeline-progress-panel');
  const resultsPanel = document.getElementById('pipeline-results-panel');
  const runBtn = document.getElementById('btn-run-pipeline');

  if (progressPanel) progressPanel.style.display = 'block';
  if (resultsPanel) resultsPanel.style.display = 'none';
  if (statusEl) {
    statusEl.classList.remove('hidden');
    statusEl.className = 'status-indicator';
    statusEl.textContent = '🚀 جاري بدء خط الإنتاج الآلي (E2E Pipeline)...';
  }
  if (runBtn) runBtn.disabled = true;

  ['ps-m1', 'ps-m2'].forEach(s => setPipelineStep(s, 'active'));

  try {
    const payload = {
      candidate_profile: currentCandidateProfile,
      jobs: currentRetrievedJobs
    };

    if (statusEl) statusEl.textContent = 'جاري تقييم الوظائف وتطبيق الفلترة الذكية وتوليد ملفات التقديم المخصصة...';
    ['ps-m1', 'ps-m2'].forEach(s => setPipelineStep(s, 'done'));
    setPipelineStep('ps-m3', 'active');
    setPipelineStep('ps-filter', 'active');

    const res = await fetch(`${API_BASE}/n8n/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      ['ps-m3', 'ps-filter', 'ps-m4', 'ps-m5', 'ps-final'].forEach(s => setPipelineStep(s, 'done'));
      if (statusEl) {
        statusEl.className = 'status-indicator success';
        statusEl.textContent = '✨ اكتمل الـ Pipeline بنجاح تام! تم توليد وتجهيز حزم التقديم وأصبحت جاهزة للموافقة.';
      }

      if (resultsPanel) resultsPanel.style.display = 'block';
      const outputItems = data.result || (data.ranked_jobs ? data.ranked_jobs : [data]);
      renderPipelineResults(outputItems);
      if (typeof refreshDashboard === 'function') refreshDashboard();
    } else {
      if (statusEl) {
        statusEl.className = 'status-indicator error';
        statusEl.textContent = `ملاحظة: ${data.message || 'خطأ أثناء المعالجة'}`;
      }

      if (resultsPanel) resultsPanel.style.display = 'block';
      const contentEl = document.getElementById('pipeline-results-content');
      if (contentEl) {
        contentEl.innerHTML = `
          <div class="error-box" style="display:block;">
            <strong>تنبيه الـ Pipeline:</strong> ${data.message || 'Notice'}<br>
            <pre style="margin-top:8px; font-size:0.8rem; white-space:pre-wrap;">${JSON.stringify(data, null, 2)}</pre>
          </div>
        `;
      }
    }

  } catch (err) {
    if (statusEl) {
      statusEl.className = 'status-indicator error';
      statusEl.textContent = `Error: ${err.message}`;
    }
    console.error('E2E pipeline run error:', err);
  } finally {
    if (runBtn) runBtn.disabled = false;
  }
}

/**
 * [الخطوة 4]: رسم بطاقات النتائج التفاعلية لكل وظيفة مؤهلة
 * وظيفتها: إنشاء بطاقات أنيقة للوظائف التي اجتازت الفلترة مع أزرار مشاهدة الـ PDF ورسالة الخطاب وبوابة الموافقات.
 */
function renderPipelineResults(result) {
  const container = document.getElementById('pipeline-results-content');
  if (!container) return;

  const results = Array.isArray(result) ? result : [result];

  container.innerHTML = results.map(r => {
    const summary = r.summary || r;
    const appStatus = r.application_status || summary.application_status || 'pending_approval';
    const company = r.company || summary.company || 'Tech Company';
    const jobTitle = r.job_title || summary.job_title || 'Software Engineer';
    const appId = r.application_id || summary.application_id || 'app_live';
    const matchScore = r.match_score || summary.match_score || '85';
    const cvFile = r.cv_file ? (r.cv_file.startsWith('/') ? r.cv_file : '/' + r.cv_file) : null;
    const coverFile = r.cover_letter_file ? (r.cover_letter_file.startsWith('/') ? r.cover_letter_file : '/' + r.cover_letter_file) : null;
    const matchedSkills = r.matched_skills || summary.matched_skills || ['Software Engineering', 'APIs'];

    let statusColor = '#22c55e';
    if (appStatus === 'pending_approval') statusColor = '#6366f1';

    return `
      <div class="panel" style="margin-bottom:16px; border-left:4px solid ${statusColor}; background: rgba(30, 41, 59, 0.7);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <h3 style="margin:0; font-size:1.15rem;">🎯 ${jobTitle} <span style="color:#94a3b8; font-weight:normal;">@ ${company}</span></h3>
          <span class="decision-badge apply" style="font-size:0.85rem;">نسبة التوافق: ${matchScore}%</span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-top:14px; background:rgba(15,23,42,0.6); padding:12px; border-radius:8px;">
          <div><label style="color:#94a3b8; font-size:0.75rem;">رقم الطلب (App ID):</label><br><code>${appId}</code></div>
          <div><label style="color:#94a3b8; font-size:0.75rem;">الحالة:</label><br><span style="color:${statusColor}; font-weight:bold;">● ${appStatus}</span></div>
          <div><label style="color:#94a3b8; font-size:0.75rem;">المهارات المتطابقة:</label><br><span style="font-size:0.85rem; color:#38bdf8;">${matchedSkills.slice(0, 4).join(', ')}</span></div>
          <div><label style="color:#94a3b8; font-size:0.75rem;">العقود المفعلة:</label><br><span style="font-size:0.75rem; color:#a78bfa;">3.1 → 3.2 → 3.3 → 3.4 → 3.5</span></div>
        </div>

        <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap; align-items:center;">
          ${cvFile ? `<a href="${cvFile}" target="_blank" class="btn btn-secondary" style="padding:6px 12px; font-size:0.85rem;">📄 عرض السي في (PDF)</a>` : ''}
          ${coverFile ? `<a href="${coverFile}" target="_blank" class="btn btn-secondary" style="padding:6px 12px; font-size:0.85rem;">✉️ عرض غلاف الخطاب</a>` : ''}
          <button class="btn btn-primary" onclick="showView('approvals')" style="padding:6px 14px; font-size:0.85rem; margin-left:auto;">
            👉 الانتقال لبوابة الموافقات
          </button>
        </div>
      </div>
    `;
  }).join('');
}
