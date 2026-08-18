/**
 * ==============================================================================
 * MODULE 5: APPROVALS GATE & TRACKING (بوابة الموافقات البشرية وتتبع الطلبات)
 * ==============================================================================
 * الترتيب المنطقي للعمليات في هذا الملف:
 * 1. استلام حزم التقديم المجهزة من Module 4 وتسجيلها بحالة (pending_approval).
 * 2. عرض تفاصيل الطلب مع روابط مباشرة لمعاينة الـ PDF وغلاف الخطاب.
 * 3. تشغيل عداد تنازلي مدته دقيقتان (120 ثانية) لطلب موافقة المستخدم البشري.
 * 4. عند ضغط "Approve": يتم إرسال الطلب لمحرك التقديم وتحديث الحالة إلى (submitted).
 * 5. عند ضغط "Reject": يتم رفض الطلب وتحديث الحالة إلى (rejected).
 * 6. عرض سجل العمليات والتايم لاين (Timeline Flow) لكل طلب تم تقديمه.
 * ==============================================================================
 */

/**
 * [الخطوة 1]: إضافة طلب تقديم جديد إلى طابور الموافقات في قاعدة البيانات
 * وظيفتها: حفظ الطلب في قاعدة البيانات بحالة pending_approval وفتح صفحة الموافقات فوراً.
 */
async function pushToApprovalQueue(job, cv_file, cover_letter_file, cand_id, job_id) {
  const finalCandId = cand_id || 'cand_' + Math.random().toString(36).substr(2, 6);
  const finalJobId = job_id || (job.job_id || 'job_1') + '_' + Math.random().toString(36).substr(2, 4);
  const finalCvFile = cv_file || `outputs/${finalCandId}_${finalJobId}_tailored.pdf`;
  const finalLetterFile = cover_letter_file || `outputs/${finalCandId}_${finalJobId}_cover_letter.txt`;

  const appPayload = {
    candidate_id: finalCandId,
    job_id: finalJobId,
    company: job.company || 'Tech Company',
    job_title: job.job_title || 'Software Engineer',
    cv_file: finalCvFile,
    cover_letter_file: finalLetterFile
  };

  try {
    const res = await fetch(`${API_BASE}/applications/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appPayload)
    });
    const data = await res.json();
    if (data.success) {
      activeApprovalAppId = data.application ? data.application.application_id : null;
      if (typeof refreshDashboard === 'function') refreshDashboard();
      showView('approvals');
    } else {
      console.warn('Initiate tracking note:', data.message);
      showView('approvals');
    }
  } catch (err) {
    console.error('Error initiating tracking:', err);
  }
}

/**
 * [الخطوة 2]: فحص الطلبات المعلقة التي تنتظر موافقة المستخدم
 * وظيفتها: جلب الطلبات من السيرفر وعرض أول طلب معلق في بطاقة الموافقة وبدء العداد التنازلي.
 */
async function checkPendingApprovals() {
  try {
    const res = await fetch(`${API_BASE}/applications`);
    const data = await res.json();
    if (data.success) {
      const pending = data.applications.find(a => a.approval_decision === 'PENDING');
      if (pending) {
        activeApprovalAppId = pending.application_id;
        const titleEl = document.getElementById('approval-job-title');
        if (titleEl) titleEl.textContent = pending.job_title;
        
        const compEl = document.getElementById('approval-company');
        if (compEl) compEl.textContent = pending.company;
        
        const scoreEl = document.getElementById('approval-score');
        if (scoreEl) scoreEl.textContent = `App ID: ${pending.application_id}`;
        
        // ربط أزرار المعاينة بملفات الـ PDF والـ Cover Letter الحقيقية
        const cvPath = pending.cv_file ? (pending.cv_file.startsWith('/') ? pending.cv_file : '/' + pending.cv_file) : `/outputs/${pending.candidate_id}_${pending.job_id}_tailored.pdf`;
        const letterPath = pending.cover_letter_file ? (pending.cover_letter_file.startsWith('/') ? pending.cover_letter_file : '/' + pending.cover_letter_file) : `/outputs/${pending.candidate_id}_${pending.job_id}_cover_letter.txt`;
        
        const resumeLink = document.getElementById('approval-resume-link');
        if (resumeLink) {
          resumeLink.href = cvPath;
          resumeLink.target = '_blank';
        }
        const letterLink = document.getElementById('approval-letter-link');
        if (letterLink) {
          letterLink.href = letterPath;
          letterLink.target = '_blank';
        }

        const noAppPanel = document.getElementById('no-approvals-panel');
        if (noAppPanel) noAppPanel.classList.add('hidden');
        
        const card = document.getElementById('approval-card');
        if (card) card.classList.remove('hidden');

        startApprovalTimer();
      } else {
        const noAppPanel = document.getElementById('no-approvals-panel');
        if (noAppPanel) noAppPanel.classList.remove('hidden');
        
        const card = document.getElementById('approval-card');
        if (card) card.classList.add('hidden');
        
        stopApprovalTimer();
      }
    }
  } catch (e) {
    console.error('Error checking approvals:', e);
  }
}

/**
 * [الخطوة 3]: تشغيل العداد التنازلي لمدة 120 ثانية (Approval Timeout)
 * وظيفتها: تحديث عداد الثواني على الشاشة كل ثانية، وإلغاء الطلب إذا انتهت المدة دون رد.
 */
function startApprovalTimer() {
  stopApprovalTimer();
  let timeRemaining = 120;
  const display = document.getElementById('approval-timer');

  approvalTimerInterval = setInterval(() => {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    if (display) display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    if (timeRemaining <= 0) {
      clearInterval(approvalTimerInterval);
      handleApprovalTimeout();
    }
    timeRemaining--;
  }, 1000);
}

/**
 * [الخطوة 4]: إيقاف العداد التنازلي
 */
function stopApprovalTimer() {
  if (approvalTimerInterval) {
    clearInterval(approvalTimerInterval);
  }
}

/**
 * [الخطوة 5]: التعامل مع انتهاء مهلة الموافقة (Timeout Exceeded)
 */
async function handleApprovalTimeout() {
  if (!activeApprovalAppId) return;
  alert('انتهت مهلة الـ 120 ثانية المحددة للموافقة!');
  showView('tracking');
}

/**
 * [الخطوة 6]: إرسال قرار الموافقة أو الرفض (Approve / Reject Action)
 * وظيفتها: إرسال القرار للسيرفر ونقله لبوابة التقديم، ثم تحويل المستخدم لصفحة التتبع.
 */
async function submitApproval(decision) {
  if (!activeApprovalAppId) return;
  stopApprovalTimer();

  try {
    const res = await fetch(`${API_BASE}/approval/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: activeApprovalAppId, decision })
    });
    const data = await res.json();
    
    if (data.success) {
      if (decision === 'APPROVED') {
        alert('تمت الموافقة بنجاح (APPROVED)! واكتمل تقديم الطلب.');
      } else {
        alert('تم رفض الطلب (REJECTED).');
      }
      showView('tracking');
    } else {
      alert('خطأ: ' + data.message);
    }
  } catch (err) {
    alert('حدث خطأ أثناء حفظ القرار: ' + err.message);
  }
}

/**
 * [الخطوة 7]: جلب وعرض جميع الطلبات في جدول التتبع العام (Tracking Logs)
 */
async function loadTrackingLogs() {
  try {
    const res = await fetch(`${API_BASE}/applications`);
    const data = await res.json();
    if (data.success) {
      populateTrackingTable(data.applications);
    }
  } catch (e) {
    console.error('Error fetching logs:', e);
  }
}

/**
 * [الخطوة 8]: رسم جدول التتبع وإظهار حالات كل وظيفة تم التقديم عليها
 */
function populateTrackingTable(apps) {
  const tbody = document.querySelector('#tracking-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (apps.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center">لا توجد طلبات مسجلة بعد.</td></tr>`;
    return;
  }

  apps.forEach(app => {
    let statClass = 'pending';
    if (app.application_status === 'submitted') statClass = 'success';
    else if (app.application_status === 'failed' || app.application_status === 'rejected') statClass = 'failed';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${app.application_id}</code></td>
      <td><strong>${app.job_title}</strong></td>
      <td>${app.company}</td>
      <td>${app.submission_method}</td>
      <td>${app.attempts}</td>
      <td><span class="status-badge ${statClass}">● ${app.application_status}</span></td>
      <td>${app.error ? `<code>${app.error.stage || 'error'}</code>` : 'null'}</td>
      <td>${app.submitted_at ? new Date(app.submitted_at).toLocaleTimeString() : 'Pending'}</td>
      <td><button class="btn btn-secondary" onclick="viewTimeline('${app.application_id}')">التايم لاين</button></td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * [الخطوة 9]: عرض الخط الزمني (Timeline Flow) المفصل لطلب محدد
 */
async function viewTimeline(appId) {
  try {
    const res = await fetch(`${API_BASE}/applications/${appId}`);
    const data = await res.json();
    if (data.success) {
      const container = document.getElementById('timeline-flow');
      if (!container) return;
      container.innerHTML = '';
      
      (data.logs || []).forEach(log => {
        let logClass = 'pending';
        if (log.status === 'submitted' || log.status === 'success') logClass = 'success';
        else if (log.status === 'failed' || log.status === 'skipped_duplicate') logClass = 'failed';

        const div = document.createElement('div');
        div.className = `timeline-item ${logClass}`;
        div.innerHTML = `
          <span class="timeline-time">${new Date(log.timestamp).toLocaleString()}</span>
          <span class="timeline-stage">${log.stage.toUpperCase()} - <strong>${log.status.toUpperCase()}</strong></span>
          <p class="timeline-detail">${log.details || ''}</p>
        `;
        container.appendChild(div);
      });

      const panel = document.getElementById('timeline-details-panel');
      if (panel) panel.classList.remove('hidden');
    }
  } catch (e) {
    console.error('Error viewing timeline:', e);
  }
}
