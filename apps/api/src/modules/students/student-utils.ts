export const normalizeArabicName = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const normalizeEgyptPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('20')) return `+${digits}`;
  if (digits.startsWith('0')) return `+20${digits.slice(1)}`;
  if (digits.length === 10) return `+20${digits}`;
  return value.startsWith('+') ? value : `+${digits}`;
};
