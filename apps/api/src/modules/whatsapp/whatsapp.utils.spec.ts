import { buildWhatsAppUrl, normalizeWhatsAppPhone, renderWhatsAppTemplate } from './whatsapp.utils';

describe('WhatsApp utilities', () => {
  it('renders variables and encodes an Egyptian WhatsApp URL', () => {
    const message = renderWhatsAppTemplate('مرحبًا {{ student_name }}', { student_name: 'أحمد' });
    expect(message).toBe('مرحبًا أحمد');
    expect(buildWhatsAppUrl('01012345678', message)).toBe(
      `https://wa.me/201012345678?text=${encodeURIComponent(message)}`,
    );
  });

  it('rejects missing template variables', () => {
    expect(() => renderWhatsAppTemplate('درجة {{student_name}} هي {{score}}', { student_name: 'أحمد' }))
      .toThrow('القالب يحتاج بيانات إضافية');
  });

  it('normalizes international numbers and rejects short numbers', () => {
    expect(normalizeWhatsAppPhone('+201012345678')).toBe('201012345678');
    expect(() => normalizeWhatsAppPhone('123')).toThrow('رقم واتساب غير صالح');
  });
});
