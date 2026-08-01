import { normalizeArabicName, normalizeEgyptPhone } from './student-utils';

describe('student utilities', () => {
  it('normalizes common Arabic forms for search', () => {
    expect(normalizeArabicName('  أحمَد   علي  ')).toBe('احمد علي');
  });

  it('normalizes Egyptian local phone numbers', () => {
    expect(normalizeEgyptPhone('0100 000 0000')).toBe('+201000000000');
  });
});
