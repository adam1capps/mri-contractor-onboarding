import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { AGREEMENT_TITLE, AGREEMENT_SECTIONS } from './terms.mjs';

/* Executed-agreement PDF. Brand rules carry over from the page: white
   background, navy and green as text only, never fills. Trebuchet is not a
   standard PDF font, so Helvetica stands in. */

const NAVY = rgb(0x1e / 255, 0x2c / 255, 0x55 / 255);
const GREEN = rgb(0x00 / 255, 0xbd / 255, 0x70 / 255);
const INK = rgb(0.2, 0.2, 0.2);
const SUB = rgb(0.36, 0.39, 0.47);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 56;
const BOTTOM = 64;
const BODY_W = PAGE_W - MARGIN * 2;

function wrap(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * @param {object} opts
 * @param {{company:string, training_date?:string, trainer?:string, package?:string, token:string, format?:string}} opts.training
 * @param {{name:string, title:string, email:string}} opts.signer
 * @param {'draw'|'type'} opts.sigType
 * @param {string} opts.sigData  data URL PNG (draw) or typed name (type)
 * @param {string} opts.signedAt ISO timestamp
 * @param {string} opts.ip
 * @param {string} opts.userAgent
 * @param {string} opts.termsVersion
 * @returns {Promise<Uint8Array>}
 */
export async function buildAgreementPdf(opts) {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const mono = await doc.embedFont(StandardFonts.Courier);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensure = (needed) => {
    if (y - needed < BOTTOM) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };
  const drawLines = (lines, font, size, color, lineGap = 1.45) => {
    for (const line of lines) {
      ensure(size * lineGap);
      page.drawText(line, { x: MARGIN, y: y - size, size, font, color });
      y -= size * lineGap;
    }
  };
  const para = (text, { font = helv, size = 10.5, color = INK, after = 7 } = {}) => {
    drawLines(wrap(text, font, size, BODY_W), font, size, color);
    y -= after;
  };

  // Header
  page.drawText('ROOF MRI', { x: MARGIN, y: y - 14, size: 14, font: bold, color: NAVY });
  page.drawText('ADVANCING THE SCIENCE OF MOISTURE DETECTION', {
    x: MARGIN, y: y - 28, size: 7.5, font: helv, color: SUB,
  });
  y -= 46;
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.2, color: NAVY,
  });
  y -= 24;

  para(AGREEMENT_TITLE.toUpperCase(), { font: bold, size: 16, color: NAVY, after: 10 });

  const t = opts.training;
  const metaPairs = [
    ['Client', t.company],
    ['Training date', t.training_date ? String(t.training_date).slice(0, 10) : 'TBD'],
    ['Trainer', t.trainer || 'ReDry'],
    ['Package', t.package || ''],
    ['Format', t.format === 'nashville' ? 'Nashville (ReDry facility)' : 'On site at client'],
    ['Provider', 'ReDry LLC'],
  ];
  for (const [k, v] of metaPairs) {
    if (!v) continue;
    ensure(14);
    page.drawText(k.toUpperCase(), { x: MARGIN, y: y - 9, size: 7.5, font: mono, color: SUB });
    page.drawText(String(v), { x: MARGIN + 110, y: y - 9, size: 9.5, font: bold, color: NAVY });
    y -= 14;
  }
  y -= 14;

  // Sections
  for (const section of AGREEMENT_SECTIONS) {
    ensure(40);
    page.drawText(section.num, { x: MARGIN, y: y - 11, size: 10, font: mono, color: GREEN });
    const titleLines = wrap(section.title, bold, 11.5, BODY_W - 26);
    for (const [i, line] of titleLines.entries()) {
      ensure(16);
      page.drawText(line, { x: MARGIN + (i === 0 ? 26 : 26), y: y - 11.5, size: 11.5, font: bold, color: NAVY });
      y -= 16;
    }
    y -= 3;
    for (const block of section.body) {
      if (block.sub) para(block.sub, { font: bold, size: 10.5, color: NAVY, after: 2 });
      para(block.text);
    }
    y -= 8;
  }

  // Execution block
  ensure(200);
  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.2, color: NAVY,
  });
  y -= 22;
  para('EXECUTED BY', { font: mono, size: 8.5, color: SUB, after: 4 });
  para(`${opts.signer.name}, ${opts.signer.title}`, { font: bold, size: 12, color: NAVY, after: 2 });
  para(`${opts.signer.email} on behalf of ${t.company}`, { size: 10, color: SUB, after: 12 });

  if (opts.sigType === 'draw' && /^data:image\/png;base64,/.test(opts.sigData)) {
    try {
      const pngBytes = Buffer.from(opts.sigData.split(',')[1], 'base64');
      const png = await doc.embedPng(pngBytes);
      const scale = Math.min(220 / png.width, 70 / png.height);
      const w = png.width * scale;
      const h = png.height * scale;
      ensure(h + 20);
      page.drawImage(png, { x: MARGIN, y: y - h, width: w, height: h });
      y -= h + 6;
    } catch (err) {
      console.error('signature embed failed, falling back to name', err);
      para(opts.signer.name, { font: oblique, size: 20, color: NAVY, after: 6 });
    }
  } else {
    para(opts.sigType === 'type' ? opts.sigData : opts.signer.name, {
      font: oblique, size: 20, color: NAVY, after: 6,
    });
  }
  ensure(20);
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: MARGIN + 240, y }, thickness: 0.8, color: SUB,
  });
  y -= 20;

  // Audit trail
  ensure(80);
  para('ELECTRONIC SIGNATURE RECORD (ESIGN / UETA)', { font: mono, size: 8.5, color: SUB, after: 4 });
  const audit = [
    `Signed at (UTC):  ${opts.signedAt}`,
    `Terms version:    ${opts.termsVersion}`,
    `Signature method: ${opts.sigType === 'draw' ? 'drawn' : 'typed'}`,
    `IP address:       ${opts.ip || 'unavailable'}`,
    `User agent:       ${(opts.userAgent || 'unavailable').slice(0, 90)}`,
    `Training token:   ${t.token}`,
  ];
  for (const line of audit) {
    ensure(12);
    page.drawText(line, { x: MARGIN, y: y - 8.5, size: 8.5, font: mono, color: INK });
    y -= 12;
  }

  return doc.save();
}
