// Builds the "unofficial transcript" PDF from plain data, so it can be tested without a database.
// Every page carries a large diagonal UNOFFICIAL watermark, a banner at the top and a footer with
// the page number: a printout can't be mistaken for the registrar's signed, sealed transcript.

const PDFDocument = require('pdfkit');

const NAVY = '#0f204b';
const GOLD = '#8a6a2c';
const RED = '#b00020';
const GREY = '#5b6477';
const MARGIN = 50;
const ROW_H = 16;

// Column x-offsets (relative to the left margin) and widths of the grades table.
const COLS = [
  { key: 'code', x: 0, w: 62, label: 'Code' },
  { key: 'title', x: 62, w: 250, label: 'Subject' },
  { key: 'units', x: 312, w: 40, label: 'Units', align: 'right' },
  { key: 'grade', x: 362, w: 50, label: 'Grade', align: 'center' },
  { key: 'remark', x: 412, w: 83, label: 'Remark' },
];

// Cuts text so it fits `width` points on one line (the table never wraps).
function fit(doc, text, width) {
  let t = String(text ?? '');
  if (doc.widthOfString(t) <= width) return t;
  while (t.length > 1 && doc.widthOfString(`${t}...`) > width) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const fmtGwa = (g) => (g === null || g === undefined ? '-' : g.toFixed(2));

/**
 * data = {
 *   institution, system,
 *   student: { name, studentId, program, department, yearLevel, section, academicStatus },
 *   terms: [{ name, gwa, rows: [{ code, title, units, grade, remark }] }]   // oldest first
 *   overall: { gwa, unitsEarned, unitsRequired },
 *   generatedAt
 * }
 * Resolves to a Buffer.
 */
function buildTranscript(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 60, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: {
        Title: `UNOFFICIAL Transcript of Records - ${data.student.studentId}`,
        Author: data.institution,
        Subject: 'Unofficial copy. Not valid for any official purpose.',
      },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = MARGIN;
    const contentW = doc.page.width - MARGIN * 2;
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 10;

    const header = () => {
      doc.font('Helvetica-Bold').fontSize(18).fillColor(NAVY).text(data.institution.toUpperCase(), left, 62, { width: contentW, align: 'center', lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor(GREY).text(data.system, left, 84, { width: contentW, align: 'center', lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(13).fillColor(NAVY).text('UNOFFICIAL TRANSCRIPT OF RECORDS', left, 104, { width: contentW, align: 'center', lineBreak: false });
      doc.moveTo(left, 126).lineTo(left + contentW, 126).lineWidth(1.5).strokeColor(GOLD).stroke();
      doc.y = 138;
    };

    const studentBlock = () => {
      const s = data.student;
      const lines = [
        ['Name', s.name],
        ['Student number', s.studentId],
        ['Program', s.program || '-'],
        ['Department', s.department || '-'],
        ['Year and section', [s.yearLevel, s.section && `Section ${s.section}`].filter(Boolean).join(', ') || '-'],
        ['Academic status', s.academicStatus],
        ['Generated', fmtDate(data.generatedAt)],
      ];
      let y = doc.y;
      for (const [label, value] of lines) {
        doc.font('Helvetica').fontSize(9.5).fillColor(GREY).text(label, left, y, { width: 110, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#1b2233').text(fit(doc, value, contentW - 120), left + 120, y, { lineBreak: false });
        y += 14;
      }
      doc.y = y + 10;
    };

    const continuation = () => {
      doc.addPage();
      doc.font('Helvetica').fontSize(9).fillColor(GREY).text(`${data.student.name} - ${data.student.studentId} (continued)`, left, 62, { width: contentW, lineBreak: false });
      doc.moveTo(left, 78).lineTo(left + contentW, 78).lineWidth(0.5).strokeColor('#c9ced9').stroke();
      doc.y = 90;
    };

    const ensureSpace = (needed) => {
      if (doc.y + needed > bottomLimit()) continuation();
    };

    const tableHead = () => {
      const y = doc.y;
      doc.rect(left, y - 2, contentW, ROW_H + 2).fillColor('#eef1f7').fill();
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NAVY);
      for (const c of COLS) doc.text(c.label.toUpperCase(), left + c.x, y + 2, { width: c.w, align: c.align || 'left', lineBreak: false });
      doc.y = y + ROW_H + 4;
    };

    const termBlock = (term) => {
      // Keep a semester together on one page when it fits on one; otherwise at least heading, column row and a subject.
      const wholeTerm = 18 + ROW_H + 4 + term.rows.length * ROW_H + 30;
      const pageRoom = doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 40;
      ensureSpace(wholeTerm <= pageRoom ? wholeTerm : ROW_H * 4);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text(term.name, left, doc.y, { width: contentW, lineBreak: false });
      doc.y += 18;
      tableHead();
      for (const r of term.rows) {
        if (doc.y + ROW_H > bottomLimit()) {
          continuation();
          doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(`${term.name} (continued)`, left, doc.y, { lineBreak: false });
          doc.y += 16;
          tableHead();
        }
        const y = doc.y;
        doc.font('Helvetica').fontSize(9).fillColor('#1b2233');
        for (const c of COLS) {
          doc.text(fit(doc, r[c.key], c.w), left + c.x, y, { width: c.w, align: c.align || 'left', lineBreak: false });
        }
        doc.y = y + ROW_H;
      }
      ensureSpace(ROW_H * 2);
      doc.moveTo(left, doc.y).lineTo(left + contentW, doc.y).lineWidth(0.5).strokeColor('#c9ced9').stroke();
      doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text(`Term GWA: ${fmtGwa(term.gwa)}`, left, doc.y + 4, { width: contentW, align: 'right', lineBreak: false });
      doc.y += 28;
    };

    header();
    studentBlock();

    if (data.terms.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(GREY).text('No academic records yet.', left, doc.y, { lineBreak: false });
      doc.y += 24;
    }
    data.terms.forEach(termBlock);

    // Summary and notes
    ensureSpace(150);
    doc.moveTo(left, doc.y).lineTo(left + contentW, doc.y).lineWidth(1.5).strokeColor(GOLD).stroke();
    doc.y += 10;
    const o = data.overall;
    const summary = [
      ['Cumulative GWA', fmtGwa(o.gwa)],
      ['Units earned', o.unitsRequired ? `${o.unitsEarned} of ${o.unitsRequired} required` : String(o.unitsEarned)],
    ];
    for (const [label, value] of summary) {
      doc.font('Helvetica').fontSize(10).fillColor(GREY).text(label, left, doc.y, { width: 120, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(value, left + 120, doc.y, { lineBreak: false });
      doc.y += 16;
    }
    doc.y += 8;
    doc.font('Helvetica').fontSize(8).fillColor(GREY).text(
      'Grading: 1.00 is the highest grade, 3.00 is the passing mark and 5.00 is a failure. INC = incomplete, DRP = dropped, W = withdrawn, ' +
        'IP = in progress. The GWA is the average of numeric grades weighted by units; PE and NSTP carry units but are not counted in it. ' +
        'Every numeric attempt is counted, including retakes.',
      left,
      doc.y,
      { width: contentW, align: 'left' },
    );
    doc.y += 8;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(RED).text(
      'This is an UNOFFICIAL copy generated from the student portal. It carries no signature or seal and is not valid for any official purpose. ' +
        'Request an official transcript from the Registrar.',
      left,
      doc.y,
      { width: contentW },
    );

    // Mark every page: watermark, top banner, footer with page numbers.
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      const { width, height } = doc.page;
      doc.page.margins.bottom = 0; // lets the footer sit inside the bottom margin without starting a new page
      doc.page.margins.top = 0;

      doc.save();
      doc.rotate(-40, { origin: [width / 2, height / 2] });
      // Sized so the word is about 440pt long: it must stay on one line and inside the page after rotation.
      doc.fillColor(RED).opacity(0.1).font('Helvetica-Bold').fontSize(100);
      const size = (100 * 440) / doc.widthOfString('UNOFFICIAL');
      doc.fontSize(size);
      doc.text('UNOFFICIAL', (width - 460) / 2, height / 2 - size * 0.36, { width: 460, align: 'center', lineBreak: false });
      doc.restore();

      doc.opacity(1);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(RED).text('UNOFFICIAL COPY - NOT VALID FOR ANY OFFICIAL PURPOSE', 0, 28, { width, align: 'center', lineBreak: false });
      doc.font('Helvetica').fontSize(8).fillColor(GREY).text(
        `UNOFFICIAL - ${data.institution} - Page ${i + 1} of ${range.count}`,
        0,
        height - 38,
        { width, align: 'center', lineBreak: false },
      );
    }
    doc.end();
  });
}

module.exports = { buildTranscript };
