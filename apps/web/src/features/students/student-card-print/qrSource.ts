import type { StudentCardQrSource } from './types';

const SVG_PREFIX = 'data:image/svg+xml;charset=utf-8,';

export function qrSourceToImageSrc(source: StudentCardQrSource): string {
  if (source.kind === 'svg') {
    return `${SVG_PREFIX}${encodeURIComponent(source.value)}`;
  }

  return source.value;
}
