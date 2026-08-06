/**
 * Calcula cuántos segundos faltan para la medianoche
 * en la zona horaria de negocio indicada.
 *
 * Se usa para firmar el JWT del vendedor: la sesión
 * dura solo lo que reste del día calendario local.
 */
export function secondsUntilEndOfDay(
  timeZone: string,
  now: Date = new Date(),
): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour') === 24 ? 0 : get('hour');
  const minute = get('minute');
  const second = get('second');

  const secondsElapsedToday = hour * 3600 + minute * 60 + second;
  const secondsInDay = 24 * 3600;
  const remaining = secondsInDay - secondsElapsedToday;

  // Evita tokens con expiresIn = 0 si cae exactamente en medianoche.
  return Math.max(remaining, 60);
}

/**
 * Devuelve la fecha/hora ISO UTC del fin del día en la zona indicada.
 * Útil para exponer `expiresAt` al frontend.
 */
export function endOfDayUtcIso(
  timeZone: string,
  now: Date = new Date(),
): string {
  const remainingSeconds = secondsUntilEndOfDay(timeZone, now);
  return new Date(now.getTime() + remainingSeconds * 1000).toISOString();
}
