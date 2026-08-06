import { describe, expect, it } from 'vitest';
import { displayUserName } from './user-display';

describe('displayUserName', () => {
  it('preserves a valid Arabic user name', () => {
    expect(displayUserName({ fullName: 'محمد طارق', isSuperAdmin: true })).toBe('محمد طارق');
  });

  it('replaces a corrupted administrator name', () => {
    expect(displayUserName({ fullName: '????????????? ????????', isSuperAdmin: true })).toBe('مدير النظام');
  });

  it('uses a neutral fallback for other corrupted users', () => {
    expect(displayUserName({ fullName: '?????', isSuperAdmin: false })).toBe('مستخدم');
  });
});
