/**
 * ==============================================================================
 * DASHBOARD & APP INITIALIZATION (الداشبورد والإحصائيات العامة)
 * ==============================================================================
 * الترتيب المنطقي للعمليات في هذا الملف:
 * 1. تحديث عدادات وإحصائيات الداشبورد (إجمالي الوظائف، المقبولة، المرفوضة، المعلقة).
 * 2. تحميل البروفايل المحفوظ تلقائياً عند فتح الصفحة.
 * 3. تفعيل مناطق السحب والإفلات (Drag & Drop) لملفات الـ CV.
 * ==============================================================================
 */

/**
 * [الخطوة 1]: جلب وتحديث أرقام وإحصائيات الداشبورد العامة من السيرفر
 */
async function refreshDashboard() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    const data = await res.json();
    if (data.success) {
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setVal('stat-total-jobs', data.stats.total_jobs);
      setVal('stat-retrieved-jobs', data.stats.jobs_retrieved);
      setVal('stat-apply-count', data.stats.apply_count);
      setVal('stat-review-count', data.stats.review_count);
      setVal('stat-reject-count', data.stats.reject_count);
      setVal('stat-submitted-count', data.stats.submitted_count);
      setVal('stat-failed-count', data.stats.failed_count);
      setVal('stat-pending-count', data.stats.pending_count);
      setVal('stat-duplicate-blocked', data.stats.duplicate_blocked);
    }
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
  }
}

/**
 * [الخطوة 2]: تحميل بيانات المرشح الافتراضية أو المحفوظة سابقاً عند بدء التطبيق
 */
async function loadSampleData() {
  try {
    if (typeof getSavedCandidateProfiles === 'function') getSavedCandidateProfiles();
    const saved = localStorage.getItem('saved_candidate_profile');
    if (saved) {
      currentCandidateProfile = JSON.parse(saved);
    } else if (savedCandidateProfilesList && savedCandidateProfilesList.length > 0) {
      currentCandidateProfile = savedCandidateProfilesList[0];
    }
    if (currentCandidateProfile) {
      const jsonEl = document.getElementById('cv-profile-json-preview');
      if (jsonEl) jsonEl.value = JSON.stringify(currentCandidateProfile, null, 2);
      const statusEl = document.getElementById('cv-extraction-status');
      if (statusEl) {
        statusEl.className = 'status-indicator success';
        statusEl.textContent = `Status: تم تحميل البروفايل (${currentCandidateProfile.candidate_name || 'جاهز للبحث'})`;
      }
      if (typeof syncJobDiscoveryWithCandidateProfile === 'function') syncJobDiscoveryWithCandidateProfile();
    }
  } catch (err) {
    console.warn('Could not load initial profile:', err);
  }
}

/**
 * [الخطوة 3]: تهيئة مستمعات الأحداث (Event Listeners) عند اكتمال تحميل الصفحة
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. تحديث إحصائيات الداشبورد
  refreshDashboard();
  
  // 2. إعداد منطقة سحب وإفلات الـ CV
  const uploadArea = document.getElementById('cv-upload-area');
  const fileInput = document.getElementById('cv-file-input');
  
  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#6366f1';
    });
    
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.15)';
    });
    
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        handleFileSelect();
      }
    });
  }

  // 3. تحميل بيانات المرشح الجاهزة
  loadSampleData();
});
