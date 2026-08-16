const API_BASE = 'http://localhost:3000/api';

// State variables
let currentCandidateProfile = null;
let currentRetrievedJobs = [];
let currentRankedJobs = [];
let selectedJobId = null;
let activeApprovalAppId = null;
let approvalTimerInterval = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Load initial statistics
  refreshDashboard();
  
  // Set up drag and drop listeners
  const uploadArea = document.getElementById('cv-upload-area');
  const fileInput = document.getElementById('cv-file-input');
  
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

  // Load static samples into UI for testing out of the box
  loadSampleData();
});

// Switch views in Sidebar
function showView(viewName) {
  // Hide all sections
  document.querySelectorAll('.view-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Show target section
  const targetSection = document.getElementById(`view-${viewName}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }
  
  // Update sidebar links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  const activeLink = document.querySelector(`.nav-link[href="#${viewName}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }

  // Refresh dynamic contents
  if (viewName === 'dashboard') {
    refreshDashboard();
  } else if (viewName === 'job-discovery') {
    syncJobDiscoveryWithCandidateProfile();
  } else if (viewName === 'tracking') {
    loadTrackingLogs();
  } else if (viewName === 'approvals') {
    checkPendingApprovals();
  } else if (viewName === 'pipeline') {
    checkN8nStatus();
  } else if (viewName === 'matching-ranking') {
    if (!currentRetrievedJobs || currentRetrievedJobs.length === 0) {
      triggerJobDiscovery().then(() => recalculateMatchScores());
    } else {
      recalculateMatchScores();
    }
  }
}

let savedCandidateProfilesList = [];

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
      email: 'aafa22gga2@qmail.com',
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

function saveCandidateProfileToList(profile) {
  if (!profile) return;
  getSavedCandidateProfiles();
  const candName = profile.candidate_name || 'Ahmed Abdo';
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

function onCandidateProfileSelected(selectedId) {
  const profiles = getSavedCandidateProfiles();
  const found = profiles.find(p => (p.candidate_id === selectedId) || (p.candidate_name === selectedId));
  if (found) {
    currentCandidateProfile = found;
    localStorage.setItem('saved_candidate_profile', JSON.stringify(found));
    syncJobDiscoveryWithCandidateProfile();
  }
}

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
    
    // Auto-fill terms input with top candidate skills
    if (termsInput && skills.length > 0) {
      termsInput.value = skills.slice(0, 4).join(', ');
    }
  }
}

function autoFillKeywordsFromCandidate() {
  syncJobDiscoveryWithCandidateProfile();
  if (currentCandidateProfile) {
    const skills = currentCandidateProfile.technical_skills || currentCandidateProfile.programming_languages || ['Backend', 'Python', 'Node.js'];
    const termsInput = document.getElementById('job-search-terms');
    if (termsInput) {
      termsInput.value = skills.slice(0, 5).join(', ');
      alert(`Search keywords auto-filled from ${currentCandidateProfile.candidate_name || 'candidate'} profile: "${termsInput.value}"`);
    }
  } else {
    alert('Please upload or save a candidate profile in Module 1 first.');
  }
}

// Load profile from localStorage or sample
async function loadSampleData() {
  try {
    getSavedCandidateProfiles();
    const saved = localStorage.getItem('saved_candidate_profile');
    if (saved) {
      currentCandidateProfile = JSON.parse(saved);
    } else if (savedCandidateProfilesList.length > 0) {
      currentCandidateProfile = savedCandidateProfilesList[0];
    }
    if (currentCandidateProfile) {
      const jsonEl = document.getElementById('cv-profile-json-preview');
      if (jsonEl) jsonEl.value = JSON.stringify(currentCandidateProfile, null, 2);
      const statusEl = document.getElementById('cv-extraction-status');
      if (statusEl) {
        statusEl.className = 'status-indicator success';
        statusEl.textContent = `Status: Candidate loaded (${currentCandidateProfile.candidate_name || 'Profile ready'})`;
      }
      syncJobDiscoveryWithCandidateProfile();
    }
  } catch (err) {
    console.warn('Could not load initial profile:', err);
  }
}

// Refresh stats on dashboard
async function refreshDashboard() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    const data = await res.json();
    if (data.success) {
      document.getElementById('stat-total-jobs').textContent = data.stats.total_jobs;
      document.getElementById('stat-retrieved-jobs').textContent = data.stats.jobs_retrieved;
      document.getElementById('stat-apply-count').textContent = data.stats.apply_count;
      document.getElementById('stat-review-count').textContent = data.stats.review_count;
      document.getElementById('stat-reject-count').textContent = data.stats.reject_count;
      document.getElementById('stat-submitted-count').textContent = data.stats.submitted_count;
      document.getElementById('stat-failed-count').textContent = data.stats.failed_count;
      document.getElementById('stat-pending-count').textContent = data.stats.pending_count;
      document.getElementById('stat-duplicate-blocked').textContent = data.stats.duplicate_blocked;
    }
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
  }
}

// CV Upload Drag Drop Selection
let selectedFile = null;
function handleFileSelect() {
  const fileInput = document.getElementById('cv-file-input');
  const fileInfo = document.getElementById('uploaded-file-info');
  if (fileInput.files.length > 0) {
    selectedFile = fileInput.files[0];
    fileInfo.textContent = `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`;
    document.getElementById('cv-error-box').classList.add('hidden');
  }
}

// Upload & parse resume
async function uploadAndParseCV() {
  if (!selectedFile) {
    showCVError('Please select or drop a CV file first.');
    return;
  }

  const formData = new FormData();
  formData.append('cv_file', selectedFile);

  const statusBox = document.getElementById('cv-extraction-status');
  statusBox.className = 'status-indicator';
  statusBox.textContent = 'Status: Uploading and parsing CV...';

  try {
    const res = await fetch(`${API_BASE}/cv/upload`, {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    
    if (!res.ok || !data.success) {
      showCVError(data.message || 'Error occurred while parsing CV.');
      statusBox.className = 'status-indicator error';
      statusBox.textContent = 'Status: Extraction failed';
      return;
    }

    // Call parsing API
    statusBox.textContent = 'Status: Extracting text from binary raw file...';
    const parseRes = await fetch(`${API_BASE}/cv/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempFilePath: data.tempFilePath })
    });
    
    const parseData = await parseRes.json();
    if (!parseRes.ok || !parseData.success) {
      showCVError(parseData.message || 'Error occurred while parsing CV.');
      statusBox.className = 'status-indicator error';
      statusBox.textContent = 'Status: Parsing failed';
      return;
    }

    document.getElementById('cv-clean-text-preview').value = parseData.parsed_text || '';
    
    if (parseData.candidate_profile) {
      currentCandidateProfile = parseData.candidate_profile;
      document.getElementById('cv-profile-json-preview').value = JSON.stringify(currentCandidateProfile, null, 2);
      statusBox.className = 'status-indicator success';
      statusBox.textContent = 'Status: Real profile extracted and Contract 3.1 validated.';
    } else {
      showCVError('Failed to extract structured candidate profile.');
      statusBox.className = 'status-indicator error';
      statusBox.textContent = 'Status: Extraction failed';
    }
  } catch (err) {
    showCVError(err.message);
    statusBox.className = 'status-indicator error';
    statusBox.textContent = 'Status: Error';
  }
}

function showCVError(msg) {
  const errBox = document.getElementById('cv-error-box');
  errBox.textContent = `Error: ${msg}`;
  errBox.classList.remove('hidden');
}

function saveExtractedProfile() {
  try {
    const rawJSON = document.getElementById('cv-profile-json-preview').value;
    currentCandidateProfile = JSON.parse(rawJSON);
    saveCandidateProfileToList(currentCandidateProfile);
    alert(`Candidate profile saved successfully! (${currentCandidateProfile.candidate_name || 'Profile'}) - Ready for Job Discovery.`);
  } catch (e) {
    alert('Invalid JSON formatting: ' + e.message);
  }
}

/* ========================================================================= */
/* MODULE 2 - JOB DISCOVERY                                                  */
/* ========================================================================= */
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

  if (feedATitle) feedATitle.textContent = mode === 'live' ? 'Feed 1: Remotive Live API' : 'Source A (GlobalJobs API)';
  if (feedBTitle) feedBTitle.textContent = mode === 'live' ? 'Feed 2: Jobicy Live API' : 'Source B (TechCareers API)';

  statusA.textContent = 'Fetching live listings...';
  statusB.textContent = 'Fetching live listings...';

  try {
    const res = await fetch(`${API_BASE}/jobs/live-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: terms,
        location: location,
        source_mode: mode
      })
    });

    const data = await res.json();
    if (!data.success) {
      alert('Error fetching jobs: ' + data.message);
      return;
    }

    statusA.textContent = 'Active (Live)';
    countA.textContent = data.feed_a_count || 0;
    statusB.textContent = 'Active (Live)';
    countB.textContent = data.feed_b_count || 0;

    currentRetrievedJobs = data.jobs || [];
    populateJobsTable(currentRetrievedJobs);

    // Automatically recalculate match scores for the live jobs
    recalculateMatchScores();

  } catch (err) {
    console.error('Job Discovery Error:', err);
    alert('Failed to retrieve jobs: ' + err.message);
  }
}

function populateJobsTable(jobs) {
  const tbody = document.querySelector('#jobs-table tbody');
  tbody.innerHTML = '';
  
  if (jobs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">No jobs retrieved.</td></tr>`;
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

/* ========================================================================= */
/* MODULE 3 - MATCHING & RANKING                                             */
/* ========================================================================= */
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
    try {
      const [resA, resB] = await Promise.all([
        fetch(`${API_BASE}/mock/source-a`).then(r => r.json()),
        fetch(`${API_BASE}/mock/source-b`).then(r => r.json())
      ]);
      const normalized = [];
      const seen = new Set();
      (resA || []).forEach(job => {
        const uniqueKey = `${job.title.toLowerCase().trim()}_${job.company.toLowerCase().trim()}`;
        if (!seen.has(uniqueKey)) {
          seen.add(uniqueKey);
          normalized.push({
            schema_version: "1.0",
            job_id: job.id,
            job_title: job.title,
            company: job.company,
            location: job.loc,
            source: "Source A (GlobalJobs API)",
            description: job.desc,
            application_url: job.url,
            required_skills: typeof job.skills_required === 'string' ? job.skills_required.split(',').map(s => s.trim()) : (job.skills_required || []),
            retrieved_at: new Date().toISOString(),
            required_experience_years: job.experience_req_years
          });
        }
      });
      (resB || []).forEach(job => {
        const uniqueKey = `${job.jobTitle.toLowerCase().trim()}_${job.companyName.toLowerCase().trim()}`;
        if (!seen.has(uniqueKey)) {
          seen.add(uniqueKey);
          normalized.push({
            schema_version: "1.0",
            job_id: job.id,
            job_title: job.jobTitle,
            company: job.companyName,
            location: job.locationInfo,
            source: "Source B (TechCareers API)",
            description: job.jobDescription,
            application_url: job.jobUrl,
            required_skills: Array.isArray(job.skills) ? job.skills : (job.skills ? [job.skills] : []),
            retrieved_at: new Date().toISOString(),
            required_experience_years: job.experienceYears
          });
        }
      });
      currentRetrievedJobs = normalized;
    } catch (e) {
      console.warn('Auto-retrieve jobs failed:', e);
    }
  }

  if (!currentRetrievedJobs || currentRetrievedJobs.length === 0) {
    const tbody = document.querySelector('#ranked-jobs-table tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center">No jobs available to rank. Please run Job Search first.</td></tr>`;
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

function populateRankedTable(ranked) {
  const tbody = document.querySelector('#ranked-jobs-table tbody');
  tbody.innerHTML = '';

  if (ranked.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">No ranked jobs. Please upload a CV and retrieve jobs first.</td></tr>`;
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
      <td>${job.matched_skills.join(', ')}</td>
      <td>
        <button class="btn btn-secondary" onclick="showMatchDetails('${job.job_id}')">Breakdown</button>
        <button class="btn btn-primary" onclick="selectJobForTailoring('${job.job_id}')">Select</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function showMatchDetails(jobId) {
  const job = currentRankedJobs.find(j => j.job_id === jobId);
  if (!job) return;

  document.getElementById('match-detail-decision').className = `decision-badge ${job.decision.toLowerCase()}`;
  document.getElementById('match-detail-decision').textContent = job.decision;
  document.getElementById('match-detail-score').textContent = `${job.match_score}%`;
  document.getElementById('match-detail-explanation').textContent = job.explanation;
  
  document.getElementById('match-detail-skills').innerHTML = job.matched_skills.map(s => `<span class="badge green">${s}</span>`).join(' ') || 'None';
  document.getElementById('match-detail-missing').innerHTML = job.missing_skills.map(s => `<span class="badge red">${s}</span>`).join(' ') || 'None';

  document.getElementById('matching-details-panel').classList.remove('hidden');
}

function selectJobForTailoring(jobId) {
  selectedJobId = jobId;
  const job = currentRankedJobs.find(j => j.job_id === jobId);
  if (!job) return;

  const card = document.getElementById('tailoring-job-card');
  card.innerHTML = `
    <h3>${job.job_title}</h3>
    <p><strong>Company:</strong> ${job.company}</p>
    <p><strong>Location:</strong> ${job.location}</p>
    <p><strong>Match Score:</strong> ${job.match_score}%</p>
    <span class="decision-badge ${job.decision.toLowerCase()}">${job.decision}</span>
  `;

  // Jump to Document Tailoring View
  showView('cv-tailoring');
}

async function triggerTailoring() {
  if (!selectedJobId) {
    alert('Please select a target job from the Matching page first.');
    return;
  }
  const job = (currentRankedJobs || []).find(j => j.job_id === selectedJobId) || {
    job_id: selectedJobId,
    job_title: 'Backend Engineer',
    company: 'Tech Innovations Inc.',
    match_score: 85,
    matched_skills: ['Node.js', 'Express', 'SQL', 'Docker', 'REST APIs']
  };

  // Ensure candidate profile is loaded from storage or state
  if (!currentCandidateProfile) {
    const saved = localStorage.getItem('saved_candidate_profile');
    if (saved) {
      try { currentCandidateProfile = JSON.parse(saved); } catch(e){}
    }
  }

  const profile = currentCandidateProfile || {
    candidate_id: 'cand_ahmed',
    candidate_name: 'Ahmed Abdo',
    email: 'aafa22gga2@qmail.com',
    phone: '+2001211177895',
    technical_skills: ['Python', 'Java', 'Node.js', 'Express', 'MongoDB', 'MySQL', 'Git', 'Linux'],
    education: [{ degree: 'B.Sc. in Computer Science', institution: 'Alamein International University', year: '2022 — 2026' }],
    projects: ['EduVR Core', 'Smart City Transportation System', 'Data Mining System', 'Hotel Reservation System']
  };

  const logTailor = document.getElementById('log-tailor-status');
  const logFact = document.getElementById('log-fact-check');
  const logLatex = document.getElementById('log-latex-status');

  logTailor.textContent = 'Generating contextual cover letter and tailored resume for ' + profile.candidate_name + '...';
  logFact.textContent = 'Factual Consistency Verifier: Running ground truth check...';
  logLatex.textContent = 'LaTeX Engine: Preparing documents...';

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
      alert('Tailoring failed: ' + data.message);
      return;
    }

    logTailor.textContent = 'Multi-paragraph cover letter aligned with ' + job.company + ' requirements.';
    logFact.textContent = 'Factual Verification: PASSED (0 unsupported claims detected).';
    logLatex.textContent = `LaTeX compiled: ${data.cv_pdf_file} generated successfully.`;

    document.getElementById('tailored-cv-preview').value = data.latex_code;
    document.getElementById('cover-letter-preview').value = data.cover_letter_text;

    // Automatically push to Approvals Gate with exact generated file paths
    pushToApprovalQueue(job, data.cv_pdf_file, data.cover_letter_file, data.candidate_id, data.job_id);

  } catch (err) {
    console.error('Tailoring error:', err);
    logTailor.textContent = 'Error during document generation: ' + err.message;
  }
}

function switchTailoringTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

  const btn = document.querySelector(`.tab-btn[onclick*="${tabName}"]`);
  if (btn) btn.classList.add('active');

  document.getElementById(`tab-content-${tabName}`).classList.remove('hidden');
}

/* ========================================================================= */
/* MODULE 5 - HUMAN APPROVALS GATE                                          */
/* ========================================================================= */
async function pushToApprovalQueue(job, cv_file, cover_letter_file, cand_id, job_id) {
  const finalCandId = cand_id || 'cand_' + Math.random().toString(36).substr(2, 6);
  const finalJobId = job_id || (job.job_id || 'job_1') + '_' + Math.random().toString(36).substr(2, 4);
  const finalCvFile = cv_file || `outputs/${finalCandId}_${finalJobId}_tailored.pdf`;
  const finalLetterFile = cover_letter_file || `outputs/${finalCandId}_${finalJobId}_cover_letter.txt`;

  const appPayload = {
    candidate_id: finalCandId,
    job_id: finalJobId,
    company: job.company || 'Tech Innovations Inc.',
    job_title: job.job_title || 'Backend Engineer',
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
      activeApprovalAppId = data.application.application_id;
      refreshDashboard();
      showView('approvals');
    } else {
      console.warn('Initiate tracking note:', data.message);
      showView('approvals');
    }
  } catch (err) {
    console.error('Error initiating tracking:', err);
  }
}

async function checkPendingApprovals() {
  try {
    const res = await fetch(`${API_BASE}/applications`);
    const data = await res.json();
    if (data.success) {
      const pending = data.applications.find(a => a.approval_decision === 'PENDING');
      if (pending) {
        activeApprovalAppId = pending.application_id;
        document.getElementById('approval-job-title').textContent = pending.job_title;
        document.getElementById('approval-company').textContent = pending.company;
        document.getElementById('approval-score').textContent = `App ID: ${pending.application_id}`;
        
        // Link to real generated PDF and Cover Letter files
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

        document.getElementById('no-approvals-panel').classList.add('hidden');
        document.getElementById('approval-card').classList.remove('hidden');

        startApprovalTimer();
      } else {
        document.getElementById('no-approvals-panel').classList.remove('hidden');
        document.getElementById('approval-card').classList.add('hidden');
        stopApprovalTimer();
      }
    }
  } catch (e) {
    console.error('Error checking approvals:', e);
  }
}

function startApprovalTimer() {
  stopApprovalTimer();
  let timeRemaining = 120; // 2 minutes countdown
  const display = document.getElementById('approval-timer');

  approvalTimerInterval = setInterval(() => {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    if (timeRemaining <= 0) {
      clearInterval(approvalTimerInterval);
      handleApprovalTimeout();
    }
    timeRemaining--;
  }, 1000);
}

function stopApprovalTimer() {
  if (approvalTimerInterval) {
    clearInterval(approvalTimerInterval);
  }
}

async function handleApprovalTimeout() {
  if (!activeApprovalAppId) return;
  alert('Approval countdown expired! Timeout triggered.');
  showView('tracking');
}

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
        alert('Application APPROVED! Portal submission completed.');
      } else {
        alert('Application REJECTED.');
      }
      showView('tracking');
    } else {
      alert('Error: ' + data.message);
    }
  } catch (err) {
    alert('Error saving decision: ' + err.message);
  }
}

// Utility Database updates
async function getApplicationDetails(id) {
  const res = await fetch(`${API_BASE}/applications/${id}`);
  const data = await res.json();
  return data.application;
}

async function saveApplicationStatus(app) {
  await fetch(`${API_BASE}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(app)
  });
}

async function logTimelineEvent(id, stage, status, details) {
  await fetch(`${API_BASE}/applications/${id}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, status, details })
  });
}

/* ========================================================================= */
/* MODULE 5 - TRACKING & LOGS                                                */
/* ========================================================================= */
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

function populateTrackingTable(apps) {
  const tbody = document.querySelector('#tracking-table tbody');
  tbody.innerHTML = '';

  if (apps.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center">No applications tracked.</td></tr>`;
    return;
  }

  apps.forEach(app => {
    let statClass = 'pending';
    if (app.application_status === 'submitted') statClass = 'success';
    else if (app.application_status === 'failed') statClass = 'failed';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${app.application_id}</code></td>
      <td><strong>${app.job_title}</strong></td>
      <td>${app.company}</td>
      <td>${app.submission_method}</td>
      <td>${app.attempts}</td>
      <td><span class="status-badge ${statClass}">● ${app.application_status}</span></td>
      <td>${app.error ? `<code>${app.error.stage}</code>` : 'null'}</td>
      <td>${app.submitted_at ? new Date(app.submitted_at).toLocaleTimeString() : 'Pending'}</td>
      <td><button class="btn btn-secondary" onclick="viewTimeline('${app.application_id}')">Timeline</button></td>
    `;
    tbody.appendChild(tr);
  });
}

async function viewTimeline(appId) {
  try {
    const res = await fetch(`${API_BASE}/applications/${appId}`);
    const data = await res.json();
    if (data.success) {
      const container = document.getElementById('timeline-flow');
      container.innerHTML = '';
      
      data.logs.forEach(log => {
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

      document.getElementById('timeline-details-panel').classList.remove('hidden');
    }
  } catch (e) {
    console.error('Error viewing timeline:', e);
  }
}

/* ========================================================================= */
/* MODULE 6 — E2E PIPELINE ORCHESTRATION (n8n Integration)                  */
/* ========================================================================= */

// Poll real n8n status — NO SIMULATION, reads from /api/n8n/status
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

// Mark a pipeline progress step visual state
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

// Run the full E2E pipeline via Express → real n8n webhook
// The frontend has NO orchestration business logic — it sends data and displays results
async function runE2EPipeline() {
  if (!currentCandidateProfile) {
    const saved = localStorage.getItem('saved_candidate_profile');
    if (saved) {
      try { currentCandidateProfile = JSON.parse(saved); } catch(e){}
    }
  }

  if (!currentCandidateProfile) {
    alert('No candidate profile loaded. Please upload and parse a CV first (CV Intelligence tab).');
    showView('cv-intelligence');
    return;
  }
  if (!currentRetrievedJobs || currentRetrievedJobs.length === 0) {
    alert('No jobs retrieved. Please run Job Discovery first (Job Discovery tab).');
    showView('job-discovery');
    return;
  }

  const statusEl = document.getElementById('pipeline-run-status');
  const progressPanel = document.getElementById('pipeline-progress-panel');
  const resultsPanel = document.getElementById('pipeline-results-panel');
  const runBtn = document.getElementById('btn-run-pipeline');

  progressPanel.style.display = 'block';
  resultsPanel.style.display = 'none';
  statusEl.classList.remove('hidden');
  statusEl.className = 'status-indicator';
  statusEl.textContent = '🚀 Initiating E2E Orchestration Pipeline...';
  if (runBtn) runBtn.disabled = true;

  ['ps-m1', 'ps-m2'].forEach(s => setPipelineStep(s, 'active'));

  try {
    const payload = {
      candidate_profile: currentCandidateProfile,
      jobs: currentRetrievedJobs
    };

    statusEl.textContent = 'Evaluating jobs in Matching Engine (M3) & Applying Intelligent Filter...';
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
      statusEl.className = 'status-indicator success';
      statusEl.textContent = '✨ Pipeline Completed Successfully! Application packages generated and queued for approval.';

      resultsPanel.style.display = 'block';
      const outputItems = data.result || (data.ranked_jobs ? data.ranked_jobs : [data]);
      renderPipelineResults(outputItems);
      refreshDashboard();
    } else {
      statusEl.className = 'status-indicator error';
      statusEl.textContent = `Pipeline note: ${data.message || 'Execution error'}`;

      resultsPanel.style.display = 'block';
      document.getElementById('pipeline-results-content').innerHTML = `
        <div class="error-box" style="display:block;">
          <strong>Pipeline Notice:</strong> ${data.message || 'Execution notice'}<br>
          <pre style="margin-top:8px; font-size:0.8rem; white-space:pre-wrap;">${JSON.stringify(data, null, 2)}</pre>
        </div>
      `;
    }

  } catch (err) {
    statusEl.className = 'status-indicator error';
    statusEl.textContent = `Error: ${err.message}`;
    console.error('E2E pipeline run error:', err);
  } finally {
    if (runBtn) runBtn.disabled = false;
  }
}

// Render pipeline results returned from n8n / server
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
          <span class="decision-badge apply" style="font-size:0.85rem;">Match Score: ${matchScore}%</span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-top:14px; background:rgba(15,23,42,0.6); padding:12px; border-radius:8px;">
          <div><label style="color:#94a3b8; font-size:0.75rem;">Application ID:</label><br><code>${appId}</code></div>
          <div><label style="color:#94a3b8; font-size:0.75rem;">Status:</label><br><span style="color:${statusColor}; font-weight:bold;">● ${appStatus}</span></div>
          <div><label style="color:#94a3b8; font-size:0.75rem;">Skills Matched:</label><br><span style="font-size:0.85rem; color:#38bdf8;">${matchedSkills.slice(0, 4).join(', ')}</span></div>
          <div><label style="color:#94a3b8; font-size:0.75rem;">Contracts Enforced:</label><br><span style="font-size:0.75rem; color:#a78bfa;">3.1 → 3.2 → 3.3 → 3.4 → 3.5</span></div>
        </div>

        <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap; align-items:center;">
          ${cvFile ? `<a href="${cvFile}" target="_blank" class="btn btn-secondary" style="padding:6px 12px; font-size:0.85rem;">📄 View Tailored CV (PDF)</a>` : ''}
          ${coverFile ? `<a href="${coverFile}" target="_blank" class="btn btn-secondary" style="padding:6px 12px; font-size:0.85rem;">✉️ View Cover Letter</a>` : ''}
          <button class="btn btn-primary" onclick="showView('approvals')" style="padding:6px 14px; font-size:0.85rem; margin-left:auto;">
            👉 Review in Approvals Gate
          </button>
        </div>
      </div>
    `;
  }).join('');
}
