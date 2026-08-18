const fs = require('fs');

/**
 * Generates a valid standalone PDF file binary stream.
 * @param {string} pdfPath - Destination file path
 * @param {string} title - Document title
 * @param {string} textContent - Multiline plain text content
 */
function generateValidPDF(pdfPath, title, textContent) {
  const lines = (textContent || '').split('\n').map(l => l.trim()).filter(Boolean);
  
  // Format lines as standard PDF stream commands
  let streamText = `BT\n/F1 14 Tf\n72 780 Td\n(${title.replace(/([\\()])/g, '\\$1')}) Tj\n0 -20 Td\n/F1 10 Tf\n`;
  lines.forEach(line => {
    const sanitized = line.replace(/([\\()])/g, '\\$1');
    streamText += `(${sanitized}) Tj\n0 -14 Td\n`;
  });
  streamText += `ET`;

  const streamLen = Buffer.byteLength(streamText, 'utf8');
  const h = '%PDF-1.4\n';
  const o1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const o2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const o3 = '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>\nendobj\n';
  const o4 = `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamText}\nendstream\nendobj\n`;
  
  const off1 = Buffer.byteLength(h);
  const off2 = off1 + Buffer.byteLength(o1);
  const off3 = off2 + Buffer.byteLength(o2);
  const off4 = off3 + Buffer.byteLength(o3);
  const startxref = off4 + Buffer.byteLength(o4);
  const p10 = (n) => String(n).padStart(10, '0');
  const xref = `xref\n0 5\n0000000000 65535 f \n${p10(off1)} 00000 n \n${p10(off2)} 00000 n \n${p10(off3)} 00000 n \n${p10(off4)} 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  fs.writeFileSync(pdfPath, Buffer.from(h + o1 + o2 + o3 + o4 + xref, 'binary'));
}

module.exports = {
  generateValidPDF
};
