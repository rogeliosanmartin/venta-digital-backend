/**
 * Validación de CURP mexicana (formato + dígito verificador).
 * @see RENAPO / algoritmos públicos de verificación
 */
const CURP_RE =
  /^[A-Z][AEIOUX][A-Z]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HM](?:AS|B[CS]|C[CLMSH]|D[FG]|G[TR]|HG|JC|M[CNS]|N[ETL]|OC|PL|Q[TR]|S[PLR]|T[CSL]|VZ|YN|ZS)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;

const DICT = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

export function normalizeCurp(raw: string | null | undefined): string {
  return (raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidCurp(raw: string | null | undefined): boolean {
  const curp = normalizeCurp(raw);
  if (curp.length !== 18) return false;
  if (!CURP_RE.test(curp)) return false;

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const idx = DICT.indexOf(curp[i]!);
    if (idx < 0) return false;
    sum += idx * (18 - i);
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === Number(curp[17]);
}

export function assertValidCurp(raw: string | null | undefined): string {
  const curp = normalizeCurp(raw);
  if (!curp) {
    throw new Error('La CURP es obligatoria');
  }
  if (!isValidCurp(curp)) {
    throw new Error('La CURP no es válida');
  }
  return curp;
}
