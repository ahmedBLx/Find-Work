/**
 * ==============================================================================
 * MODULE 3: MATCHING & RANKING (محرك المطابقة والتقييم الذكي)
 * ==============================================================================
 * الترتيب المنطقي للعمليات في هذا الملف:
 * 1. قراءة مهارات المرشح وقائمة الوظائف المجلوبة.
 * 2. إرسال البيانات لخوارزمية المطابقة الهجينة (Hybrid: المهارات + الدور الوظيفي + سنوات الخبرة).
 * 3. ترتيب الوظائف تنازلياً حسب الـ Match Score وتحديد القرار (APPLY / REVIEW / SKIP).
 * 4. عرض تفاصيل التوافق والمهارات الناقصة في نافذة منبثقة (Breakdown).
 * 5. تمكين المستخدم من اختيار وظيفة للبدء في تخصيص السي في لها في Module 4.
 * ==============================================================================
 */

/**
 * [الخطوة 1]: حساب ومطابقة سكور التوافق لجميع الوظائف (Core M3 Action)
 * وظيفتها: إرسال بروفايل المرشح والوظائف لمحرك التقييم واستلام قائمة مرتبة بنسب التوافق.
 */
async function recalculateMatchScores() {
  if (!currentCandidateProfile) {
    const saved = localStorage.getItem('saved_candidate_profile');
    if (saved) {
      currentCandidateProfile = JSON.parse(saved);
    } else {
      const pRes = await fetch('/data/samples/sample_candidate_profile.json');
      if (pRes.ok) currentCandidateProfile = await pRes.json();
    }
  }

  if (!currentRetrievedJobs || currentRetrievedJobs.length === 0) {
    const tbody = document.querySelector('#ranked-jobs-table tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center">لا توجد وظائف لتقييمها. برجاء إجراء البحث أولاً من موديول Job Discovery.</td></tr>`;
    return;
  }

  const method = document.getElementById('match-scoring-method')
    ? document.getElementById('match-scoring-method').value
    : 'hybrid';

  try {
    const res = await fetch(`${API_BASE}/match/rank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_profile: currentCandidateProfile,
        jobs: currentRetrievedJobs,
        method
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      console.error('M3 ranking error:', data.message);
      return;
    }

    currentRankedJobs = data.ranked_jobs;
    populateRankedTable(currentRankedJobs);
  } catch (err) {
    console.error('M3 ranking network error:', err);
  }
}

/**
 * [الخطوة 2]: عرض الوظائف المرتبة ونسب التوافق في الجدول
 * وظيفتها: رسم صفوف جدول الترتيب مع إظهار النسبة المئوية وشارة القرار (APPLY بالأخضر، REVIEW بالأصفر، SKIP بالأحمر).
 */
function populateRankedTable(ranked) {
  const tbody = document.querySelector('#ranked-jobs-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (ranked.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">لا توجد وظائف مرتبة.</td></tr>`;
    return;
  }

  ranked.forEach((job, index) => {
    let decClass = 'reject';
    if (job.decision === 'APPLY') decClass = 'apply';
    else if (job.decision === 'REVIEW') decClass = 'review';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${job.company}</td>
      <td><strong>${job.job_title}</strong></td>
      <td><strong>${job.match_score}%</strong></td>
      <td><span class="decision-badge ${decClass}">${job.decision}</span></td>
      <td>${(job.matched_skills || []).join(', ')}</td>
      <td>
        <button class="btn btn-secondary" onclick="showMatchDetails('${job.job_id}')">تفاصيل السكور</button>
        <button class="btn btn-primary" onclick="selectJobForTailoring('${job.job_id}')">اختيار وتخصيص</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * [الخطوة 3]: عرض نافذة تفاصيل الحساب والمهارات المتطابقة والناقصة
 * وظيفتها: فتح صندوق يشرح بالتفصيل كيف تم حساب السكور وما هي المهارات المفقودة.
 */
function showMatchDetails(jobId) {
  const job = currentRankedJobs.find(j => j.job_id === jobId);
  if (!job) return;

  const decEl = document.getElementById('match-detail-decision');
  if (decEl) {
    decEl.className = `decision-badge ${job.decision.toLowerCase()}`;
    decEl.textContent = job.decision;
  }
  const scoreEl = document.getElementById('match-detail-score');
  if (scoreEl) scoreEl.textContent = `${job.match_score}%`;
  
  const expEl = document.getElementById('match-detail-explanation');
  if (expEl) expEl.textContent = job.explanation;
  
  const skillsEl = document.getElementById('match-detail-skills');
  if (skillsEl) skillsEl.innerHTML = (job.matched_skills || []).map(s => `<span class="badge green">${s}</span>`).join(' ') || 'None';
  
  const missEl = document.getElementById('match-detail-missing');
  if (missEl) missEl.innerHTML = (job.missing_skills || []).map(s => `<span class="badge red">${s}</span>`).join(' ') || 'None';

  const panel = document.getElementById('matching-details-panel');
  if (panel) panel.classList.remove('hidden');
}

/**
 * [الخطوة 4]: اختيار وظيفة محددة والانتقال لمرحلة التخصيص (Module 4)
 * وظيفتها: تثبيت الوظيفة كـ Target Job ونقل المستخدم لصفحة توليد السي في وغلاف الخطاب.
 */
function selectJobForTailoring(jobId) {
  selectedJobId = jobId;
  const job = currentRankedJobs.find(j => j.job_id === jobId);
  if (!job) return;

  const card = document.getElementById('tailoring-job-card');
  if (card) {
    card.innerHTML = `
      <h3>${job.job_title}</h3>
      <p><strong>الشركة:</strong> ${job.company}</p>
      <p><strong>الموقع:</strong> ${job.location}</p>
      <p><strong>نسبة التوافق:</strong> ${job.match_score}%</p>
      <span class="decision-badge ${job.decision.toLowerCase()}">${job.decision}</span>
    `;
  }

  showView('cv-tailoring');
}
