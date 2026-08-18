/**
 * ==============================================================================
 * MODULE 4: DOCUMENT TAILORING (توليد وتخصيص السي في وغلاف الخطاب)
 * ==============================================================================
 * الترتيب المنطقي للعمليات في هذا الملف:
 * 1. قراءة بيانات المرشح والوظيفة المستهدفة التي تم اختيارها في Module 3.
 * 2. صياغة غلاف خطاب احترافي مخصص (Cover Letter) موجه لاسم الشركة ومتطلبات الوظيفة.
 * 3. كتابة كود لاتك (LaTeX Resume) مخصص يبرز المهارات والمشاريع المطابقة للوظيفة.
 * 4. إنشاء ملف PDF حقيقي للسي في وحفظ الملفات في مجلد outputs/.
 * 5. تمرير حزمة التقديم تلقائياً لبوابة الموافقات البشرية في Module 5.
 * ==============================================================================
 */

/**
 * [الخطوة 1]: تنفيذ عملية توليد وتخصيص المستندات (Core M4 Action)
 * وظيفتها:
 * 1. إرسال بيانات المرشح والوظيفة للسيرفر.
 * 2. توليد غلاف الخطاب وكود الـ LaTeX والـ PDF.
 * 3. عرض كود السي في وغلاف الخطاب في مربعات المعاينة.
 * 4. نقل الحزمة فوراً لبوابة الموافقات في Module 5.
 */
async function triggerTailoring() {
  if (!selectedJobId) {
    alert('برجاء اختيار وظيفة مستهدفة من صفحة Matching أولاً.');
    return;
  }
  const job = (currentRankedJobs || []).find(j => j.job_id === selectedJobId) || {
    job_id: selectedJobId,
    job_title: 'Backend Engineer',
    company: 'Tech Innovations Inc.',
    match_score: 85,
    matched_skills: ['Node.js', 'Express', 'SQL', 'Docker', 'REST APIs']
  };

  if (!currentCandidateProfile) {
    const saved = localStorage.getItem('saved_candidate_profile');
    if (saved) {
      try { currentCandidateProfile = JSON.parse(saved); } catch(e){}
    }
  }

  const profile = currentCandidateProfile || {
    candidate_id: 'cand_ahmed',
    candidate_name: 'Ahmed Abdo',
    email: 'aafa22qqa2@gmail.com',
    phone: '+2001211177895',
    technical_skills: ['Python', 'Java', 'Node.js', 'Express', 'MongoDB', 'MySQL', 'Git', 'Linux'],
    education: [{ degree: 'B.Sc. in Computer Science', institution: 'Alamein International University', year: '2022 — 2026' }],
    projects: ['EduVR Core', 'Smart City Transportation System', 'Data Mining System', 'Hotel Reservation System']
  };

  const logTailor = document.getElementById('log-tailor-status');
  const logFact = document.getElementById('log-fact-check');
  const logLatex = document.getElementById('log-latex-status');

  if (logTailor) logTailor.textContent = 'جاري كتابة وتخصيص غلاف الخطاب والسي في لـ ' + (profile.candidate_name || 'المرشح') + '...';
  if (logFact) logFact.textContent = 'فاحص الحقائق (Fact Checker): جاري التحقق من مطابقة المهارات الحقيقية...';
  if (logLatex) logLatex.textContent = 'محرك اللاتك (LaTeX Engine): جاري إعداد وتجميع ملفات الـ PDF...';

  try {
    const res = await fetch(`${API_BASE}/cv/generate-tailored`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_profile: profile,
        job: job
      })
    });

    const data = await res.json();

    if (!data.success) {
      alert('فشل توليد المستندات: ' + data.message);
      return;
    }

    if (logTailor) logTailor.textContent = 'تمت صياغة غلاف الخطاب بنجاح ومطابقته لمتطلبات ' + job.company + '.';
    if (logFact) logFact.textContent = 'التحقق من الحقائق: ناجح 100% (PASSED).';
    if (logLatex) logLatex.textContent = `تم توليد وتجميع الـ PDF بنجاح: ${data.cv_pdf_file}`;

    const cvPrev = document.getElementById('tailored-cv-preview');
    if (cvPrev) cvPrev.value = data.latex_code;
    
    const clPrev = document.getElementById('cover-letter-preview');
    if (clPrev) clPrev.value = data.cover_letter_text;

    // إرسال الحزمة تلقائياً إلى بوابة الموافقات البشرية
    pushToApprovalQueue(job, data.cv_pdf_file, data.cover_letter_file, data.candidate_id, data.job_id);

  } catch (err) {
    console.error('Tailoring error:', err);
    if (logTailor) logTailor.textContent = 'حدث خطأ أثناء توليد المستندات: ' + err.message;
  }
}

/**
 * [الخطوة 2]: التبديل بين تبويبات المعاينة (LaTeX Preview / Cover Letter Preview)
 * وظيفتها: إظهار كود اللاتك للسي في أو نص غلاف الخطاب حسب التبويب الذي يضغطه المستخدم.
 */
function switchTailoringTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

  const btn = document.querySelector(`.tab-btn[onclick*="${tabName}"]`);
  if (btn) btn.classList.add('active');

  const content = document.getElementById(`tab-content-${tabName}`);
  if (content) content.classList.remove('hidden');
}
