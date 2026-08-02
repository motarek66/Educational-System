import { DomainError } from '../../common/errors/domain-error';

export const whatsappTemplateVariables = [
  'student_name',
  'student_code',
  'grade_level',
  'center_name',
  'guardian_name',
  'score',
  'max_score',
  'percentage',
  'exam_name',
  'lesson_date',
  'late_count',
] as const;

export function renderWhatsAppTemplate(
  bodyTemplate: string,
  variables: Record<string, string | number>,
): string {
  const missingVariables = new Set<string>();
  const message = bodyTemplate.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => {
    const value = variables[key];
    if (value === undefined || String(value).trim() === '') {
      missingVariables.add(key);
      return `{{${key}}}`;
    }
    return String(value);
  });

  if (missingVariables.size > 0) {
    throw new DomainError(
      'WHATSAPP_TEMPLATE_VARIABLE_MISSING',
      'القالب يحتاج بيانات إضافية قبل فتح واتساب.',
      422,
      { variables: [...missingVariables] },
    );
  }

  return message.trim();
}

export function normalizeWhatsAppPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  let normalized = digits;
  if (digits.startsWith('0')) normalized = `20${digits.slice(1)}`;
  else if (digits.length === 10 && digits.startsWith('1')) normalized = `20${digits}`;

  if (!/^[1-9]\d{7,14}$/.test(normalized)) {
    throw new DomainError(
      'WHATSAPP_PHONE_INVALID',
      'رقم واتساب غير صالح. سجّل الرقم بصيغة دولية مثل +201xxxxxxxxx.',
      422,
    );
  }
  return normalized;
}

export function buildWhatsAppUrl(phoneE164: string, message: string): string {
  const phone = normalizeWhatsAppPhone(phoneE164);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
