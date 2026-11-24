export const GIFT_CENTS = 500;
export const TIME_ZONE = 'America/Toronto';

export function prediction(input: unknown) {
  if (!input || typeof input !== 'object') throw new Error('Enter your prediction.');
  const values = input as Record<string, unknown>;
  const {day, period, requestId} = values;
  const name = typeof values.name === 'string' ? values.name.trim() : '';
  const email = typeof values.email === 'string' ? values.email.trim() : '';
  const wishes = typeof values.wishes === 'string' ? values.wishes.trim() : '';
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 31 ||
      (period !== 'AM' && period !== 'PM')) throw new Error('Select a January AM or PM slot.');
  if (!name || name.length > 100) throw new Error('Enter a name up to 100 characters.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (wishes.length > 1000) throw new Error('Keep wishes to 1,000 characters.');
  if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new Error('Refresh and try again.');
  return {day, period, name, email, wishes, requestId};
}

export function birthTime(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Enter a valid Toronto birth date and time.');
  const date = new Date(value + ':00Z');
  if (!Number.isFinite(+date) || date.toISOString().slice(0,16) !== value)
    throw new Error('Enter a valid Toronto birth date and time.');
  return value;
}

export function csvCell(value: unknown) {
  let field = String(value ?? '');
  if (/^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(field)) field = "'" + field;
  return '"' + field.replaceAll('"', '""') + '"';
}
