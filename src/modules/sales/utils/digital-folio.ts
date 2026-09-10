/** Folio digital: D- + número de venta. */
export function formatDigitalFolio(
  id: number | string | null | undefined,
): string {
  const raw = String(id ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/^D-/i, '').replace(/\D/g, '');
  if (!digits) return raw;
  return `D-${Number(digits)}`;
}
