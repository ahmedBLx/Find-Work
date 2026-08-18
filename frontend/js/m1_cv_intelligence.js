/**
 * ==============================================================================
 * MODULE 1: CV INTELLIGENCE (استخراج ومعالجة بيانات السيرة الذاتية)
 * ==============================================================================
 * الترتيب المنطقي للعمليات في هذا الملف:
 * 1. المستخدم يختار أو يسحب ملف الـ CV (PDF / DOCX / TXT).
 * 2. يتم إرسال الملف للسيرفر لقراءته واستخراج البيانات الذكية (الاسم، المهارات، التعليم).
 * 3. يتم عرض البيانات في المحرر ويمكن حفظها في قائمة المرشحين.
 * 4. يتم مزامنة المرشح المختار مع باقي الموديولات تلقائياً.
 * ==============================================================================
 */

// متغير يحفظ الملف المرفوع حالياً في الذاكرة
let selectedFile = null;

/**
 * [الخطوة 1]: جلب قائمة المرشحين المحفوظين من الذاكرة المحلية (localStorage)
 * وظيفتها: قراءة البروفايلات المحفوظة سابقاً لعرضها في القائمة المنسدلة.
 */
function getSavedCandidateProfiles() {
  const saved = localStorage.getItem('saved_candidate_profiles_list');
  if (saved) {
    try {
      savedCandidateProfilesList = JSON.parse(saved);
    } catch(e) {
      savedCandidateProfilesList = [];
    }
  }
  if (!Array.isArray(savedCandidateProfilesList) || savedCandidateProfilesList.length === 0) {
    const defaultProfile = {
      candidate_id: 'cand_ahmed',
      candidate_name: 'Ahmed Abdo',
      email: 'aafa22qqa2@gmail.com',
      phone: '+2001211177895',
      technical_skills: ['Python', 'Java', 'Node.js', 'Express', 'MongoDB', 'MySQL', 'Git', 'Linux'],
      education: [{ degree: 'B.Sc. in Computer Science', institution: 'Alamein International University', year: '2022 — 2026' }],
      projects: ['EduVR Core', 'Smart City Transportation System', 'Data Mining System', 'Hotel Reservation System'],
      seniority_level: 'Student / Entry-Level'
    };
    savedCandidateProfilesList = [defaultProfile];
    localStorage.setItem('saved_candidate_profiles_list', JSON.stringify(savedCandidateProfilesList));
  }
  return savedCandidateProfilesList;
}

/**
 * [الخطوة 2]: حفظ بيانات مرشح جديد في القائمة
 * وظيفتها: إضافة البروفايل المستخرج إلى قائمة المرشحين وتحديث القائمة المنسدلة فوراً.
 */
function saveCandidateProfileToList(profile) {
  if (!profile) return;
  getSavedCandidateProfiles();
  const candName = profile.candidate_name || 'Candidate';
  const existingIdx = savedCandidateProfilesList.findIndex(p => (p.candidate_name || '').toLowerCase().trim() === candName.toLowerCase().trim());
  if (existingIdx >= 0) {
    savedCandidateProfilesList[existingIdx] = profile;
  } else {
    savedCandidateProfilesList.unshift(profile);
  }
  localStorage.setItem('saved_candidate_profiles_list', JSON.stringify(savedCandidateProfilesList));
  localStorage.setItem('saved_candidate_profile', JSON.stringify(profile));
  currentCandidateProfile = profile;
  renderCandidateProfileSelector();
  syncJobDiscoveryWithCandidateProfile();
}

/**
 * [الخطوة 3]: بناء وتحديث القائمة المنسدلة للمرشحين في واجهة المستخدم
 * وظيفتها: ملء الـ Dropdown بأسماء المرشحين والمهارات الخاصة بهم.
 */
function renderCandidateProfileSelector() {
  const selector = document.getElementById('candidate-profile-selector');
  if (!selector) return;
  const profiles = getSavedCandidateProfiles();
  const currentName = currentCandidateProfile ? currentCandidateProfile.candidate_name : (profiles[0] ? profiles[0].candidate_name : '');
  
  selector.innerHTML = '';
  profiles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.candidate_id || p.candidate_name;
    const skillsPreview = (p.technical_skills || p.programming_languages || []).slice(0, 3).join(', ');
    opt.textContent = `👤 ${p.candidate_name || 'Candidate'} — [${skillsPreview || 'Skills'}]`;
    if (p.candidate_name === currentName) {
      opt.selected = true;
    }
    selector.appendChild(opt);
  });
}

/**
 * [الخطوة 4]: استجابة عند اختيار مرشح مختلف من القائمة المنسدلة
 * وظيفتها: تفعيل بيانات المرشح المختار ونقلها فوراً لموديول البحث عن الوظائف.
 */
function onCandidateProfileSelected(selectedId) {
  const profiles = getSavedCandidateProfiles();
  const found = profiles.find(p => (p.candidate_id === selectedId) || (p.candidate_name === selectedId));
  if (found) {
    currentCandidateProfile = found;
    localStorage.setItem('saved_candidate_profile', JSON.stringify(found));
    syncJobDiscoveryWithCandidateProfile();
  }
}

/**
 * [الخطوة 5]: التعامل مع اختيار أو سحب وإفلات ملف الـ CV
 * وظيفتها: قراءة اسم وحجم الملف المرفوع وعرضه للمستخدم في صندوق الرفع.
 */
function handleFileSelect() {
  const fileInput = document.getElementById('cv-file-input');
  const fileInfo = document.getElementById('uploaded-file-info');
  if (fileInput.files.length > 0) {
    selectedFile = fileInput.files[0];
    fileInfo.textContent = `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`;
    document.getElementById('cv-error-box').classList.add('hidden');
  }
}

/**
 * [الخطوة 6]: رفع الملف وتحليله واستخراج البيانات الذكية (Core M1 Action)
 * وظيفتها:
 * 1. رفع الملف إلى السيرفر.
 * 2. استخراج النص وتنظيفه.
 * 3. استخراج البيانات المنظمة (الاسم، الإيميل، المهارات، المشاريع، الشهادات).
 * 4. عرض النتيجة في صندوق المعاينة وحفظها.
 */
async function uploadAndParseCV() {
  if (!selectedFile) {
    showCVError('برجاء اختيار أو سحب ملف CV أولاً.');
    return;
  }

  const formData = new FormData();
  formData.append('cv_file', selectedFile);

  const statusBox = document.getElementById('cv-extraction-status');
  statusBox.className = 'status-indicator';
  statusBox.textContent = 'Status: جاري رفع وقراءة ملف الـ CV...';

  try {
    // 1. رفع الملف للسيرفر
    const res = await fetch(`${API_BASE}/cv/upload`, {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    if (!res.ok || !data.success) {
      showCVError(data.message || 'حدث خطأ أثناء رفع الملف.');
      statusBox.className = 'status-indicator error';
      statusBox.textContent = 'Status: فشل الرفع';
      return;
    }

    // 2. تحليل النص واستخراج البيانات
    statusBox.textContent = 'Status: جاري استخراج المهارات والمعلومات الذكية...';
    const parseRes = await fetch(`${API_BASE}/cv/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempFilePath: data.tempFilePath })
    });
    
    const parseData = await parseRes.json();
    if (!parseRes.ok || !parseData.success) {
      showCVError(parseData.message || 'حدث خطأ أثناء معالجة الملف.');
      statusBox.className = 'status-indicator error';
      statusBox.textContent = 'Status: فشل التحليل';
      return;
    }

    // 3. عرض النص الخام المستخرج
    document.getElementById('cv-clean-text-preview').value = parseData.parsed_text || '';
    
    // 4. عرض الـ JSON المنظم وحفظ المرشح
    if (parseData.candidate_profile) {
      currentCandidateProfile = parseData.candidate_profile;
      document.getElementById('cv-profile-json-preview').value = JSON.stringify(currentCandidateProfile, null, 2);
      statusBox.className = 'status-indicator success';
      statusBox.textContent = 'Status: تم استخراج البروفايل ومطابقة العقد 3.1 بنجاح.';
      saveCandidateProfileToList(currentCandidateProfile);
    } else {
      showCVError('لم يتم العثور على بروفايل مهيكل.');
      statusBox.className = 'status-indicator error';
      statusBox.textContent = 'Status: خطأ في البنية';
    }
  } catch (err) {
    showCVError(err.message);
    statusBox.className = 'status-indicator error';
    statusBox.textContent = 'Status: خطأ';
  }
}

/**
 * [الخطوة 7]: إظهار رسالة خطأ واضحة للمستخدم
 */
function showCVError(msg) {
  const errBox = document.getElementById('cv-error-box');
  errBox.textContent = `Error: ${msg}`;
  errBox.classList.remove('hidden');
}

/**
 * [الخطوة 8]: حفظ التعديلات اليدوية على بيانات الـ JSON
 * وظيفتها: إذا عدل المستخدم أي نص أو مهارة في صندوق الـ JSON يدوياً، يتم حفظه بضغطة زر.
 */
function saveExtractedProfile() {
  try {
    const rawJSON = document.getElementById('cv-profile-json-preview').value;
    currentCandidateProfile = JSON.parse(rawJSON);
    saveCandidateProfileToList(currentCandidateProfile);
    alert(`تم حفظ بروفايل المرشح بنجاح! (${currentCandidateProfile.candidate_name || 'Profile'}) - جاهز للبحث عن الوظائف.`);
  } catch (e) {
    alert('صيغة JSON غير صحيحة: ' + e.message);
  }
}
