const http = require('http');
const fs = require('fs');
const path = require('path');

const postData = JSON.stringify({
  candidate_id: "cand_98a72b",
  job_id: "job_001",
  cv_tex_raw: "\\documentclass{article}\\n\\begin{document}\\nJane Doe CV. Node.js backend engineer.\\n\\end{document}",
  cover_letter_text: "Dear Hiring Manager,\nI am applying for Backend Engineer..."
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/documents/assemble',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    const parsed = JSON.parse(body);
    console.log('RESPONSE:', parsed);
    
    if (res.statusCode === 200 && parsed.success) {
      const pdfPath = path.resolve(__dirname, '../../', parsed.cv_file);
      console.log('Checking PDF file:', pdfPath);
      if (fs.existsSync(pdfPath)) {
        const bytes = fs.readFileSync(pdfPath);
        const header = bytes.toString('utf8', 0, 4);
        console.log('PDF Header:', header);
        console.log('PDF Size:', bytes.length, 'bytes');
        if (header === '%PDF' && bytes.length > 100) {
          console.log('VERIFICATION: PDF matches valid specification!');
          process.exit(0);
        }
      }
    }
    console.error('VERIFICATION FAILED!');
    process.exit(1);
  });
});

req.on('error', (e) => {
  console.error('Req error:', e.message);
  process.exit(1);
});

req.write(postData);
req.end();
