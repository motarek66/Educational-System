import type { UserSummary } from '../../types/api';

export const can = (user: UserSummary | null, permission: string): boolean => {
  if (!user) return false;
  return user.isSuperAdmin || user.permissions.includes(permission);
};
