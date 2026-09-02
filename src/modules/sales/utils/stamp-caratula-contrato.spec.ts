import { stampContratoOnCaratulaPdf } from './stamp-caratula-contrato';

function buildPdf(objects: string[]): Buffer {
  const header = '%PDF-1.3\n';
  const bodies = objects.map((dict, i) => `${i + 1} 0 obj\n${dict}\nendobj\n`);
  let offset = header.length;
  const offsets = bodies.map((body) => {
    const at = offset;
    offset += body.length;
    return at;
  });
  const xrefOff = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const at of offsets) {
    xref += `${String(at).padStart(10, '0')} 00000 n \n`;
  }
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOff}\n%%EOF\n`;
  return Buffer.from(header + bodies.join('') + xref + trailer, 'latin1');
}

describe('stampContratoOnCaratulaPdf', () => {
  it('sella el folio cuando /Resources es una referencia', () => {
    const pdf = buildPdf([
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources 4 0 R /Contents 6 0 R >>',
      '<< /ProcSet [/PDF /Text] /Font << /F1 5 0 R >> >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Length 0 >>\nstream\nendstream',
    ]);

    const stamped = stampContratoOnCaratulaPdf(pdf, 'S00048');
    const text = stamped.toString('latin1');

    expect(text).toContain('/VdC 7 0 R');
    expect(text).toContain('/BaseFont /Helvetica-Bold');
    expect(text).toContain('(S00048)');
  });

  it('sella el folio cuando /Font también es una referencia', () => {
    const pdf = buildPdf([
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources 4 0 R /Contents 6 0 R >>',
      '<< /ProcSet [/PDF /Text] /Font 7 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Length 0 >>\nstream\nendstream',
      '<< /F1 5 0 R >>',
    ]);

    const stamped = stampContratoOnCaratulaPdf(pdf, 'S00049');
    const text = stamped.toString('latin1');

    expect(text).toContain('/VdC 8 0 R');
    expect(text).toContain('(S00049)');
  });
});
