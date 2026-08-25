/**
 * Sella el folio CONTRATO sobre la carátula que ya generó jsPDF en el front.
 * Actualización incremental del PDF (fuentes estándar), sin librerías extra.
 *
 * Coordenadas = `fieldInline(..., 'CONTRATO:', ...)` en sale-pdf.ts
 * (jsPDF: origen arriba-izquierda, pt).
 */

const CONTRATO_LABEL_X = 421;
const CONTRATO_LABEL_W = 44;
const CONTRATO_VALUE_Y = 100;
const CONTRATO_MAX_W = 108;
const BOX_TOP = 87.4;
const BOX_H = 20.8;
const DEFAULT_PAGE_H = 1009.13;

function extractDict(objRaw: string): string {
  const start = objRaw.indexOf('<<');
  if (start < 0) throw new Error('Objeto PDF sin diccionario');
  let depth = 0;
  for (let i = start; i < objRaw.length - 1; i++) {
    if (objRaw[i] === '<' && objRaw[i + 1] === '<') {
      depth += 1;
      i += 1;
    } else if (objRaw[i] === '>' && objRaw[i + 1] === '>') {
      depth -= 1;
      i += 1;
      if (depth === 0) return objRaw.slice(start, i + 1);
    }
  }
  throw new Error('Diccionario PDF sin cierre');
}

function findObjectRaw(pdf: string, num: number): string {
  const re = new RegExp(`(?:^|[\\r\\n])${num} 0 obj`);
  const m = re.exec(pdf);
  if (!m) throw new Error(`No está el objeto PDF ${num}`);
  const start = pdf.indexOf(`${num} 0 obj`, m.index);
  const end = pdf.indexOf('endobj', start);
  if (end < 0) throw new Error(`Objeto PDF ${num} incompleto`);
  return pdf.slice(start, end + 6);
}

function parseTrailer(pdf: string): {
  size: number;
  root: string;
  startxref: number;
} {
  const sx = pdf.lastIndexOf('startxref');
  if (sx < 0) throw new Error('PDF sin startxref');
  const xrefOff = /startxref\s+(\d+)/.exec(pdf.slice(sx));
  if (!xrefOff) throw new Error('PDF startxref inválido');
  const trailerIdx = pdf.lastIndexOf('trailer', sx);
  if (trailerIdx < 0) {
    throw new Error('PDF sin trailer (no es el formato de jsPDF)');
  }
  const trailer = pdf.slice(trailerIdx, sx);
  const size = Number(/\/Size\s+(\d+)/.exec(trailer)?.[1]);
  const root = /\/Root\s+(\d+\s+0\s+R)/.exec(trailer)?.[1];
  if (!size || !root) throw new Error('Trailer PDF incompleto');
  return { size, root, startxref: Number(xrefOff[1]) };
}

function firstPageObjectNum(pdf: string, rootRef: string): number {
  const rootNum = Number(/^(\d+)/.exec(rootRef)?.[1]);
  const catalog = findObjectRaw(pdf, rootNum);
  const pagesNum = Number(/\/Pages\s+(\d+)\s+0\s+R/.exec(catalog)?.[1]);
  if (!pagesNum) throw new Error('Catalog sin Pages');
  const pages = findObjectRaw(pdf, pagesNum);
  const kids = /\/Kids\s*\[([^\]]+)\]/.exec(pages)?.[1];
  const first = Number(/(\d+)\s+0\s+R/.exec(kids ?? '')?.[1]);
  if (!first) throw new Error('Pages sin Kids');
  return first;
}

function pageHeight(pageDict: string): number {
  const m = /\/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+[\d.]+\s+([\d.]+)\s*\]/.exec(
    pageDict,
  );
  return m ? Number(m[1]) : DEFAULT_PAGE_H;
}

function injectFontResource(pageDict: string, fontRef: string): string {
  if (/\/Resources\s+\d+\s+0\s+R/.test(pageDict)) {
    throw new Error('Resources PDF indirecto no soportado');
  }
  if (/\/Font\s*<</.test(pageDict)) {
    return pageDict.replace(/\/Font\s*<</, `/Font << /VdC ${fontRef} `);
  }
  if (/\/Resources\s*<</.test(pageDict)) {
    return pageDict.replace(
      /\/Resources\s*<</,
      `/Resources << /Font << /VdC ${fontRef} >> `,
    );
  }
  return pageDict.replace(/<</, `<< /Resources << /Font << /VdC ${fontRef} >> >>`);
}

function appendContents(pageDict: string, streamRef: string): string {
  const arr = /\/Contents\s*\[([^\]]*)\]/.exec(pageDict);
  if (arr) {
    return pageDict.replace(arr[0], `/Contents [${arr[1].trim()} ${streamRef}]`);
  }
  const single = /\/Contents\s+(\d+\s+0\s+R)/.exec(pageDict);
  if (single) {
    return pageDict.replace(single[0], `/Contents [${single[1]} ${streamRef}]`);
  }
  return pageDict.replace(/<</, `<< /Contents ${streamRef} `);
}

function escapePdfString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function xrefEntry(offset: number): string {
  return `${String(offset).padStart(10, '0')} 00000 n \n`;
}

function stampOperators(folio: string, pageH: number): string {
  const valueX = CONTRATO_LABEL_X + CONTRATO_LABEL_W;
  const valueY = pageH - CONTRATO_VALUE_Y;
  const rectY = pageH - (BOX_TOP + BOX_H) + 0.6;
  const clipped = folio.slice(0, 24);
  return [
    'q',
    '0.980 0.988 0.992 rg',
    `${valueX - 2} ${rectY} ${CONTRATO_MAX_W + 8} ${BOX_H - 1.2} re`,
    'f',
    'Q',
    'BT',
    '/VdC 8 Tf',
    '0.102 0.133 0.165 rg',
    `${valueX} ${valueY} Td`,
    `(${escapePdfString(clipped)}) Tj`,
    'ET',
    '',
  ].join('\n');
}

/** Escribe el folio de cotización en el hueco CONTRATO de la carátula. */
export function stampContratoOnCaratulaPdf(
  pdfBytes: Buffer,
  contrato: string,
): Buffer {
  const folio = contrato.trim();
  if (!folio) return pdfBytes;

  const pdf = pdfBytes.toString('latin1');
  const { size, root, startxref } = parseTrailer(pdf);
  const pageNum = firstPageObjectNum(pdf, root);
  const pageRaw = findObjectRaw(pdf, pageNum);
  const pageDict = injectFontResource(
    appendContents(extractDict(pageRaw), `${size + 1} 0 R`),
    `${size} 0 R`,
  );
  const pageH = pageHeight(pageDict);
  const ops = stampOperators(folio, pageH);

  const fontObj =
    `${size} 0 obj\n` +
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\n' +
    'endobj\n';
  const streamObj =
    `${size + 1} 0 obj\n` +
    `<< /Length ${Buffer.byteLength(ops, 'latin1')} >>\n` +
    `stream\n${ops}endstream\n` +
    'endobj\n';
  const pageObj = `${pageNum} 0 obj\n${pageDict}\nendobj\n`;

  const chunks: Buffer[] = [pdfBytes];
  if (pdfBytes[pdfBytes.length - 1] !== 0x0a) {
    chunks.push(Buffer.from('\n', 'latin1'));
  }
  const baseLen = chunks.reduce((n, c) => n + c.length, 0);
  const pageOff = baseLen;
  const fontOff = pageOff + Buffer.byteLength(pageObj, 'latin1');
  const streamOff = fontOff + Buffer.byteLength(fontObj, 'latin1');
  const xrefOff =
    streamOff + Buffer.byteLength(streamObj, 'latin1');

  const xref =
    'xref\n' +
    '0 1\n' +
    '0000000000 65535 f \n' +
    `${pageNum} 1\n` +
    xrefEntry(pageOff) +
    `${size} 1\n` +
    xrefEntry(fontOff) +
    `${size + 1} 1\n` +
    xrefEntry(streamOff);

  const trailer =
    `trailer\n<< /Size ${size + 2} /Root ${root} /Prev ${startxref} >>\n` +
    `startxref\n${xrefOff}\n%%EOF\n`;

  chunks.push(
    Buffer.from(pageObj + fontObj + streamObj + xref + trailer, 'latin1'),
  );
  return Buffer.concat(chunks);
}
