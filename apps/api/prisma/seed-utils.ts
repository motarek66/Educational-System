const ASCII_QUESTION_MARK_ONLY = /^\?+(?:\s+\?+)*$/u;

/**
 * Environment variables can be corrupted to ASCII question marks when Arabic
 * text passes through a shell with a legacy code page. Never persist that
 * lossy value during production seeding.
 */
export function unicodeEnvOrFallback(value: string | undefined, fallback: string): string {
  const candidate = value?.trim();
  if (!candidate || ASCII_QUESTION_MARK_ONLY.test(candidate)) return fallback;
  return candidate;
}
