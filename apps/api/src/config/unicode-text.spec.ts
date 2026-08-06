import { unicodeEnvOrFallback } from './unicode-text';

describe('unicodeEnvOrFallback', () => {
  it('preserves valid Arabic text', () => {
    expect(unicodeEnvOrFallback('  محمد طارق  ', 'مدير النظام')).toBe('محمد طارق');
  });

  it.each([undefined, '', '   ', '?????', '??? ????'])('uses the fallback for missing or corrupted text: %p', (value) => {
    expect(unicodeEnvOrFallback(value, 'مدير النظام')).toBe('مدير النظام');
  });

  it('does not reject a valid name that contains punctuation', () => {
    expect(unicodeEnvOrFallback('محمد؟', 'مدير النظام')).toBe('محمد؟');
  });
});
