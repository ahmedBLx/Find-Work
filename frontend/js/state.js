/**
 * ==============================================================================
 * GLOBAL STATE & VIEW ROUTER (إدارة الحالة والتنقل بين الصفحات)
 * ==============================================================================
 * وظيفة هذا الملف:
 * 1. تعريف عنوان السيرفر الأساسي (API_BASE).
 * 2. الاحتفاظ بالمتغيرات العامة المشتركة بين جميع الموديولات في الذاكرة.
 * 3. دالة التنقل (showView) لفتح التبويب المختار في القائمة الجانبية وتحديث محتواه.
 * ==============================================================================
 */

// عنوان السيرفر الأساسي
const API_BASE = 'http://localhost:3000/api';

// المتغيرات العامة المشتركة بين جميع الموديولات
let currentCandidateProfile = null;   // بروفايل المرشح المختار حالياً
let currentRetrievedJobs = [];         // الوظائف المجلوبة من البحث الحي
let currentRankedJobs = [];            // الوظائف بعد تقييم التوافق وترتيب السكور
let selectedJobId = null;              // الوظيفة المستهدفة المختارة لتخصيص السي في
let activeApprovalAppId = null;        // الطلب النشط المنتظر للموافقة البشرية
let approvalTimerInterval = null;      // مؤقت الـ 120 ثانية للموافقة
let savedCandidateProfilesList = [];   // قائمة جميع المرشحين المحفوظين

/**
 * دالة التنقل وإظهار الصفحة المختارة من القائمة الجانبية
 * @param {string} viewName - اسم القسم المطلوب إظهاره (dashboard, cv-intelligence, job-discovery, matching-ranking, cv-tailoring, approvals, tracking, pipeline)
 */
function showView(viewName) {
  // 1. إخفاء جميع الأقسام
  document.querySelectorAll('.view-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // 2. إظهار القسم المستهدف
  const targetSection = document.getElementById(`view-${viewName}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }
  
  // 3. تحديث الرابط النشط في القائمة الجانبية
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  const activeLink = document.querySelector(`.nav-link[href="#${viewName}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }

  // 4. تحديث البيانات التلقائية الخاصة بالقسم المعروض
  if (viewName === 'dashboard') {
    if (typeof refreshDashboard === 'function') refreshDashboard();
  } else if (viewName === 'job-discovery') {
    if (typeof syncJobDiscoveryWithCandidateProfile === 'function') syncJobDiscoveryWithCandidateProfile();
  } else if (viewName === 'tracking') {
    if (typeof loadTrackingLogs === 'function') loadTrackingLogs();
  } else if (viewName === 'approvals') {
    if (typeof checkPendingApprovals === 'function') checkPendingApprovals();
  } else if (viewName === 'pipeline') {
    if (typeof checkN8nStatus === 'function') checkN8nStatus();
  } else if (viewName === 'matching-ranking') {
    if (!currentRetrievedJobs || currentRetrievedJobs.length === 0) {
      if (typeof triggerJobDiscovery === 'function') {
        triggerJobDiscovery().then(() => {
          if (typeof recalculateMatchScores === 'function') recalculateMatchScores();
        });
      }
    } else {
      if (typeof recalculateMatchScores === 'function') recalculateMatchScores();
    }
  }
}
