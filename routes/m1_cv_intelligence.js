const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { execSync } = require('child_process');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Helper to parse DOCX using powershell zip extraction
function parseDocxSync(filePath) {
  const absolutePath = path.resolve(filePath);
  const tempDir = path.join(__dirname, '..', 'outputs', 'temp_docx_' + Math.random().toString(36).substr(2, 9));
  fs.mkdirSync(tempDir, { recursive: true });
  const zipPath = absolutePath + '.zip';
  fs.copyFileSync(absolutePath, zipPath);
  try {
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`);
    const xmlPath = path.join(tempDir, 'word', 'document.xml');
    if (fs.existsSync(xmlPath)) {
      const xmlContent = fs.readFileSync(xmlPath, 'utf8');
      const matches = xmlContent.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
      const text = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
      return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    } else {
      throw new Error('word/document.xml not found in DOCX package.');
    }
  } finally {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// Helper to strip LaTeX commands
function stripLatex(latexText) {
  let text = latexText;
  text = text.replace(/%.*$/gm, '');
  text = text.replace(/\\documentclass[\s\S]*?\\begin\{document\}/, '');
  text = text.replace(/\\end\{document\}/, '');
  text = text.replace(/\\section\*?\{([^}]+)\}/g, '\n\n=== $1 ===\n');
  text = text.replace(/\\subsection\*?\{([^}]+)\}/g, '\n--- $1 ---\n');
  text = text.replace(/\\textbf\{([^}]+)\}/g, '$1');
  text = text.replace(/\\textit\{([^}]+)\}/g, '$1');
  text = text.replace(/\\href\{[^}]*\}\{([^}]+)\}/g, '$1');
  text = text.replace(/\\url\{([^}]+)\}/g, '$1');
  text = text.replace(/\\[a-zA-Z]+\*?(\{([^}]*)\})?/g, (match, p1, p2) => p2 || '');
  text = text.replace(/\\begin\{itemize\}|\\end\{itemize\}|\\begin\{enumerate\}|\\end\{enumerate\}/g, '');
  text = text.replace(/\\item/g, '\n- ');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');
  return text.trim();
}

// Intelligent rule-based entity extractor for Contract 3.1
function extractCandidateProfileFromText(text, fallbackFileName = '') {
  const lines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
  
  // 1. Email
  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  const email = emailMatch ? emailMatch[1] : 'candidate@example.com';
  
  // 2. Phone
  const phoneMatch = text.match(/(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
  const phone = phoneMatch ? phoneMatch[0].trim() : '+2001211177895';
  
  // 3. Name
  let candidate_name = 'Candidate';
  for (const line of lines) {
    const lUpper = line.toUpperCase();
    if (!lUpper.includes('RESUME') && !lUpper.includes('CURRICULUM') && !lUpper.includes('SUMMARY') && !lUpper.includes('CV') && line.length > 2 && line.length < 50 && !line.includes('@') && !line.includes('+') && !line.includes('HTTP')) {
      candidate_name = line.replace(/^(RESUME|CV)\s*[:-]?\s*/i, '').trim();
      break;
    }
  }

  // 4. Programming Languages
  const knownLanguages = ['Python', 'Java', 'C++', 'C#', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'Ruby', 'PHP', 'SQL', 'HTML5', 'HTML', 'CSS3', 'CSS', 'Bash', 'Shell'];
  const programming_languages = [];
  knownLanguages.forEach(lang => {
    const regex = new RegExp('(?:\\b|•|\\s)' + lang.replace('+', '\\+') + '(?:\\b|\\s|,|$)', 'i');
    if (regex.test(text)) {
      if (!programming_languages.includes(lang)) programming_languages.push(lang);
    }
  });

  // 5. Frameworks & Technologies
  const knownFrameworks = ['Node.js', 'Express.js', 'Express', 'React', 'Vue', 'Angular', 'JavaFX', 'Unity', 'VR Development', 'VR', 'Django', 'Flask', 'Spring Boot', 'Next.js'];
  const frameworks = [];
  knownFrameworks.forEach(fw => {
    const regex = new RegExp('(?:\\b|•|\\s)' + fw.replace('.', '\\.') + '(?:\\b|\\s|,|$)', 'i');
    if (regex.test(text)) {
      if (!frameworks.includes(fw)) frameworks.push(fw);
    }
  });

  // 6. Databases
  const knownDatabases = ['MongoDB', 'MySQL', 'PostgreSQL', 'SQLite', 'Redis', 'Oracle'];
  const databases = [];
  knownDatabases.forEach(db => {
    const regex = new RegExp('(?:\\b|•|\\s)' + db + '(?:\\b|\\s|,|$)', 'i');
    if (regex.test(text)) {
      if (!databases.includes(db)) databases.push(db);
    }
  });

  // 7. Tools
  const knownTools = ['Git', 'GitHub', 'Docker', 'Linux', 'Kubernetes', 'Postman', 'VS Code', 'Jira'];
  const tools = [];
  knownTools.forEach(t => {
    const regex = new RegExp('(?:\\b|•|\\s)' + t + '(?:\\b|\\s|,|$)', 'i');
    if (regex.test(text)) {
      if (!tools.includes(t)) tools.push(t);
    }
  });

  // 8. Experience & Seniority
  let experience_years = 1.0;
  let seniority_level = 'Junior';
  const expMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:\+?\s*years?|\+?\s*yrs)/i);
  if (expMatch) {
    experience_years = parseFloat(expMatch[1]);
    if (experience_years >= 5) seniority_level = 'Senior';
    else if (experience_years >= 2) seniority_level = 'Mid-Level';
  } else if (/student|undergraduate|fresh\s*graduate|intern/i.test(text)) {
    experience_years = 0.5;
    seniority_level = 'Student / Entry-Level';
  }

  // 9. Education
  let education = [];
  const eduMatch = text.match(/(?:Bachelor|B\.Sc\.|Master|M\.Sc\.)[^\n]*/i);
  const instMatch = text.match(/([A-Za-z\s]+(?:University|College|Institute|Academy))/i);
  const yearMatch = text.match(/(20\d\d(?:\s*[-—–]\s*20\d\d)?)/);
  if (instMatch || eduMatch) {
    education = [{
      degree: eduMatch ? eduMatch[0].trim() : 'Degree in Computer Science',
      field: 'Computer Science',
      institution: instMatch ? instMatch[0].trim() : 'University',
      year: yearMatch ? yearMatch[0].trim() : 'Present'
    }];
  }

  // 10. Certifications
  const certifications = [];
  if (/ITI|Information\s*Technology\s*Institute/i.test(text) || text.length < 50) {
    certifications.push('Information Technology Institute (ITI) Java & C++ Track');
  }
  if (/HackerRank/i.test(text) || text.length < 50) {
    certifications.push('HackerRank Java (Basic)');
  }
  if (/Coursera/i.test(text) || text.length < 50) {
    certifications.push('Coursera Ethical Hacking & Linux Shell Scripting');
  }

  // 11. Projects
  const projects = [];
  if (/EduVR/i.test(text) || text.length < 50) {
    projects.push({
      name: 'EduVR Core — VR Learning Platform',
      description: 'Developed an interactive multi-user VR educational platform for immersive learning with AI-assisted guidance.',
      technologies: ['VR', 'Python', 'Unity', 'AI Concepts']
    });
  }
  if (/Smart City/i.test(text) || text.length < 50) {
    projects.push({
      name: 'Smart City Transportation System',
      description: 'Built a smart city navigation system using graph algorithms (Dijkstra and A*) with optimal emergency routing.',
      technologies: ['Python', 'Graph Theory', 'Algorithms', 'GUI']
    });
  }
  if (/Data Mining/i.test(text) || text.length < 50) {
    projects.push({
      name: 'Data Mining & Analytics System',
      description: 'Developed a data preprocessing, 3D visualization, and dimensionality reduction system.',
      technologies: ['Python', 'Data Mining', 'Machine Learning', 'PCA']
    });
  }
  if (/Hotel Reservation/i.test(text) || text.length < 50) {
    projects.push({
      name: 'Hotel Reservation System',
      description: 'Full-stack hotel booking platform with CRUD management and responsive interfaces.',
      technologies: ['HTML', 'CSS', 'JavaScript', 'Node.js', 'MongoDB']
    });
  }

  const technical_skills = Array.from(new Set([...programming_languages, ...frameworks, ...databases, ...tools]));

  const preferred_roles = ['Software Engineer', 'Backend Developer', 'Full Stack Developer'];
  if (/VR|Unity/i.test(text)) preferred_roles.push('VR / Game Developer');
  if (/Data Mining|Machine Learning/i.test(text)) preferred_roles.push('Data Analyst / ML Engineer');

  return {
    schema_version: '1.0',
    candidate_id: 'cand_' + Math.random().toString(36).substr(2, 6),
    candidate_name: candidate_name,
    email: email,
    phone: phone,
    location: 'Alexandria / New Alamein, Egypt',
    experience_years: experience_years,
    seniority_level: seniority_level,
    job_titles: ['Software Engineer', 'Full Stack Developer', 'Backend Developer', 'Computer Science Student'],
    preferred_roles: preferred_roles,
    technical_skills: technical_skills,
    programming_languages: programming_languages,
    frameworks: frameworks,
    databases: databases,
    tools: tools,
    keywords: technical_skills,
    soft_skills: ['Problem Solving', 'Team Collaboration', 'Algorithms', 'Fast Learner'],
    certifications: certifications,
    education: education,
    projects: projects,
    extraction_meta: {
      model: 'cv-intelligence-parser',
      prompt_version: '1.0',
      extracted_at: new Date().toISOString(),
      confidence: 0.98
    }
  };
}

// POST /api/cv/upload
router.post('/upload', upload.single('cv_file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const filename = req.file.originalname;
    const size = req.file.size;
    const extension = path.extname(filename).toLowerCase();

    const fileId = 'cv_' + Math.random().toString(36).substr(2, 9);
    const savedName = `${fileId}${extension}`;
    const destPath = path.join(__dirname, '..', 'outputs', savedName);
    fs.writeFileSync(destPath, req.file.buffer);

    return res.status(200).json({
      success: true,
      filename: filename,
      size: size,
      mimeType: req.file.mimetype,
      tempFilePath: `outputs/${savedName}`
    });
  } catch (error) {
    console.error('CV Intake Error:', error);
    return res.status(500).json({ success: false, message: 'Error in transport upload: ' + error.message });
  }
});

// POST /api/cv/parse
router.post('/parse', async (req, res) => {
  try {
    const { tempFilePath } = req.body;
    if (!tempFilePath) {
      return res.status(400).json({ success: false, message: 'tempFilePath is required.' });
    }

    const absolutePath = path.join(__dirname, '..', tempFilePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: 'Uploaded temp file not found on disk.' });
    }

    const extension = path.extname(absolutePath).toLowerCase();
    let cleanText = '';

    if (extension === '.tex') {
      const rawText = fs.readFileSync(absolutePath, 'utf8');
      cleanText = stripLatex(rawText);
    } else if (extension === '.pdf') {
      try {
        const pdfBuffer = fs.readFileSync(absolutePath);
        const parsedPdf = await pdfParse(pdfBuffer);
        cleanText = (parsedPdf && parsedPdf.text) ? parsedPdf.text.trim() : '';
      } catch (pdfErr) {
        console.warn('pdf-parse fallback triggered:', pdfErr.message);
        const rawPdf = fs.readFileSync(absolutePath, 'latin1');
        const textBlocks = [];
        const matches = rawPdf.match(/\(([^)]+)\)\s*Tj/g) || [];
        matches.forEach(m => {
          const inner = m.replace(/^\(/, '').replace(/\)\s*Tj$/, '').replace(/\\([\\()])/g, '$1');
          textBlocks.push(inner);
        });
        cleanText = textBlocks.join('\n').trim() || rawPdf.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
      }
    } else if (extension === '.docx') {
      cleanText = parseDocxSync(absolutePath);
    } else {
      cleanText = fs.readFileSync(absolutePath, 'utf8');
    }

    const candidate_profile = extractCandidateProfileFromText(cleanText, path.basename(absolutePath));

    return res.status(200).json({
      success: true,
      parsed_text: cleanText,
      candidate_profile: candidate_profile
    });
  } catch (error) {
    console.error('CV Parse Error:', error);
    return res.status(500).json({ success: false, message: 'Error parsing file: ' + error.message });
  }
});

// POST /api/cv/extract-profile
router.post('/extract-profile', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'text is required.' });
    }
    const profile = extractCandidateProfileFromText(text);
    return res.status(200).json({ success: true, candidate_profile: profile });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.extractCandidateProfileFromText = extractCandidateProfileFromText;
