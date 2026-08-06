import type { UserSummary } from '../../types/api';

const ASCII_QUESTION_MARK_ONLY = /^\?+(?:\s+\?+)*$/u;

export function displayUserName(user: Pick<UserSummary, 'fullName' | 'isSuperAdmin'> | null): string {
  const fullName = user?.fullName.trim();
  if (fullName && !ASCII_QUESTION_MARK_ONLY.test(fullName)) return fullName;
  return user?.isSuperAdmin ? 'مدير النظام' : 'مستخدم';
}
