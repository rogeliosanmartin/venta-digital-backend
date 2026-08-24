const LAZY_SEQUENCES = new Set([
  '0123456789',
  '1234567890',
  '9876543210',
  '0987654321',
]);

/** Solo dígitos; quita +52 / 52 / 521 si vienen con lada país. */
export function normalizeMxPhone(raw: string | null | undefined): string {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('521') && digits.length >= 13) {
    digits = digits.slice(3);
  } else if (digits.startsWith('52') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 10);
}

export function isValidMxPhone(raw: string | null | undefined): boolean {
  const phone = normalizeMxPhone(raw);
  if (!/^\d{10}$/.test(phone)) return false;
  if (phone.startsWith('0') || phone.startsWith('1')) return false;
  if (new Set(phone).size === 1) return false;
  if (LAZY_SEQUENCES.has(phone)) return false;
  return true;
}

export function isEmptyOrValidMxPhone(raw: string | null | undefined): boolean {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return true;
  return isValidMxPhone(raw);
}

export function assertMxPhone(
  raw: string | null | undefined,
  label: string,
  required = false,
): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) {
    if (required) {
      throw new Error(`${label} es obligatorio (10 dígitos).`);
    }
    return '';
  }
  if (!isValidMxPhone(raw)) {
    throw new Error(`${label} no es un celular válido de 10 dígitos.`);
  }
  return normalizeMxPhone(raw);
}
