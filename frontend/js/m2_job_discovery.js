/**
 * ==============================================================================
 * MODULE 2: JOB DISCOVERY (البحث الحي وجلب الوظائف الحقيقية)
 * ==============================================================================
 * الترتيب المنطقي للعمليات في هذا الملف:
 * 1. مزامنة كلمات البحث تلقائياً من مهارات المرشح المختار في Module 1.
 * 2. تمكين المستخدم من اختيار الدولة أو البحث عن وظائف Remotely.
 * 3. الاتصال بمحركات التوظيف الحية (LinkedIn / Indeed عبر RapidAPI JSearch و Remotive).
 * 4. تنظيف الوظائف وإزالة التكرارات وعرضها في جدول تفاعلي.
 * 5. تمرير الوظائف تلقائياً للموديول الثالث لحساب نسبة التوافق (Match Score).
 * ==============================================================================
 */

/**
 * [الخطوة 1]: تغيير خيار الموقع الجغرافي (مصر، الخليج، ريموتلي، أو مخصص)
 * وظيفتها: إظهار حقل إدخال يدوي عند اختيار "Custom" أو ضبط القيمة المحددة تلقائياً.
 */
function onLocationOptionChanged(val) {
  const customInput = document.getElementById('job-search-location');
  if (val === 'custom') {
    if (customInput) {
      customInput.style.display = 'block';
      customInput.value = '';
      customInput.focus();
    }
  } else {
    if (customInput) {
      customInput.style.display = 'none';
      customInput.value = val;
    }
  }
}

/**
 * [الخطوة 2]: مزامنة بطاقة المرشح وكلمات البحث مع البروفايل المحفوظ
 * وظيفتها: قراءة اسم المرشح ومهاراته من Module 1 وعرضها في بطاقة البحث وملء خانة الكلمات المفتاحية تلقائياً.
 */
function syncJobDiscoveryWithCandidateProfile() {
  renderCandidateProfileSelector();

  if (!currentCandidateProfile) {
    const profiles = getSavedCandidateProfiles();
    currentCandidateProfile = profiles[0];
  }

  const nameEl = document.getElementById('job-discovery-cand-name');
  const roleEl = document.getElementById('job-discovery-cand-role');
  const skillsEl = document.getElementById('job-discovery-cand-skills-text');
  const eduEl = document.getElementById('job-discovery-cand-edu-text');
  const termsInput = document.getElementById('job-search-terms');

  if (currentCandidateProfile) {
    const name = currentCandidateProfile.candidate_name || 'Candidate';
    const skills = currentCandidateProfile.technical_skills || currentCandidateProfile.programming_languages || [];
    const degree = (currentCandidateProfile.education && currentCandidateProfile.education[0]) ? currentCandidateProfile.education[0].degree : 'Computer Science';
    const institution = (currentCandidateProfile.education && currentCandidateProfile.education[0]) ? currentCandidateProfile.education[0].institution : 'University';
    const year = (currentCandidateProfile.education && currentCandidateProfile.education[0]) ? currentCandidateProfile.education[0].year : '';

    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = currentCandidateProfile.seniority_level || degree;
    if (skillsEl) skillsEl.textContent = `Extracted Skills: ${skills.join(', ')}`;
    if (eduEl) eduEl.textContent = `${institution} ${year ? '(' + year + ')' : ''}`;
    
    // وضع أعلى 4 مهارات تلقائياً في خانة البحث
    if (termsInput && skills.length > 0) {
      termsInput.value = skills.slice(0, 4).join(', ');
    }
  }
}

/**
 * [الخطوة 3]: الملء التلقائي لكلمات البحث عند ضغط زر "Auto-fill from Profile"
 * وظيفتها: استرجاع مهارات المرشح ووضعها في خانة البحث فوراً بضغطة زر.
 */
function autoFillKeywordsFromCandidate() {
  syncJobDiscoveryWithCandidateProfile();
  if (currentCandidateProfile) {
    const skills = currentCandidateProfile.technical_skills || currentCandidateProfile.programming_languages || ['Backend', 'Python', 'Node.js'];
    const termsInput = document.getElementById('job-search-terms');
    if (termsInput) {
      termsInput.value = skills.slice(0, 5).join(', ');
      alert(`تم ملء مهارات البحث تلقائياً من بروفايل (${currentCandidateProfile.candidate_name || 'المرشح'}): "${termsInput.value}"`);
    }
  } else {
    alert('برجاء رفع أو اختيار بروفايل مرشح من الخطوة الأولى أولاً.');
  }
}

/**
 * [الخطوة 4]: تنفيذ عملية البحث المباشر عن الوظائف (Core M2 Action)
 * وظيفتها:
 * 1. قراءة المهارات والموقع المختارين.
 * 2. إرسال طلب للسيرفر للبحث في LinkedIn / Indeed و Remotive.
 * 3. جلب الوظائف الحقيقية وتحديث العدادات.
 * 4. عرض الوظائف في الجدول وحساب السكور تلقائياً.
 */
async function triggerJobDiscovery() {
  const terms = document.getElementById('job-search-terms').value;
  const location = document.getElementById('job-search-location').value;
  const mode = document.getElementById('job-search-mode') ? document.getElementById('job-search-mode').value : 'live';

  const statusA = document.getElementById('source-a-status');
  const countA = document.getElementById('source-a-count');
  const statusB = document.getElementById('source-b-status');
  const countB = document.getElementById('source-b-count');
  const feedATitle = document.getElementById('feed-a-title');
  const feedBTitle = document.getElementById('feed-b-title');

  if (feedATitle) feedATitle.textContent = 'Feed 1: LinkedIn & Indeed (JSearch Live)';
  if (feedBTitle) feedBTitle.textContent = 'Feed 2: Remotive Public Feed';

  if (statusA) statusA.textContent = 'جاري جلب الوظائف الحية...';
  if (statusB) statusB.textContent = 'جاري جلب الوظائف الحية...';

  try {
    const res = await fetch(`${API_BASE}/jobs/live-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchTerm: terms,
        location: location,
        useMockFallback: mode === 'mock'
      })
    });

    const data = await res.json();
    if (!data.success) {
      alert('خطأ أثناء جلب الوظائف: ' + data.message);
      return;
    }

    if (statusA) statusA.textContent = 'Active (Live)';
    if (countA) countA.textContent = data.feed_a_count || 0;
    if (statusB) statusB.textContent = 'Active (Live)';
    if (countB) countB.textContent = data.feed_b_count || 0;

    currentRetrievedJobs = data.jobs || [];
    populateJobsTable(currentRetrievedJobs);

    // حساب نسبة التوافق لكل وظيفة مباشرة
    recalculateMatchScores();

  } catch (err) {
    console.error('Job Discovery Error:', err);
    alert('فشل الاتصال بمحركات الوظائف: ' + err.message);
  }
}

/**
 * [الخطوة 5]: رسم وعرض الوظائف المجلوبة في جدول البحث
 * وظيفتها: إنشاء صفوف الجدول مع عنوان الوظيفة، الشركة، الموقع، والمهارات المطلوبة.
 */
function populateJobsTable(jobs) {
  const tbody = document.querySelector('#jobs-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (jobs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">لم يتم العثور على وظائف مطابقة.</td></tr>`;
    return;
  }

  jobs.forEach(job => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${job.job_id}</td>
      <td><strong>${job.job_title}</strong></td>
      <td>${job.company}</td>
      <td>${job.location}</td>
      <td>${job.source}</td>
      <td>${(job.required_skills || []).join(', ')}</td>
      <td><button class="btn btn-secondary" onclick="showView('matching-ranking')">Match Score</button></td>
    `;
    tbody.appendChild(tr);
  });
}
