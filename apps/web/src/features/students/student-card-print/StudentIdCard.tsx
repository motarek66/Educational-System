import type { StudentCardBranding, StudentCardIdentity } from './types';
import './studentCardPrint.css';

type CardFaceProps = {
  identity: StudentCardIdentity;
  qrImageSrc: string;
  branding?: StudentCardBranding | undefined;
};

const DEFAULT_BRANDING: Required<StudentCardBranding> = {
  frontTitle: 'الكارت التعريفي للطالب',
  frontSubtitle: 'مستر عبدالله سيد 2026',
  qrScanLabel: 'SCAN QR',
  qrFooterLabel: 'MR ABDULLAH SAYED',
};

function brandingWithDefaults(branding?: StudentCardBranding): Required<StudentCardBranding> {
  return { ...DEFAULT_BRANDING, ...branding };
}

export function StudentIdCardFront({ branding }: Pick<CardFaceProps, 'branding'>) {
  const labels = brandingWithDefaults(branding);

  return (
    <article className="student-id-card student-id-card--front" aria-label="واجهة كارت الطالب">
      <div className="student-id-card__glow" aria-hidden="true" />
      <div className="student-id-card__front-outline" aria-hidden="true" />
      <div className="student-id-card__front-copy" dir="rtl">
        <strong>{labels.frontTitle}</strong>
        <span>{labels.frontSubtitle}</span>
      </div>
    </article>
  );
}

export function StudentIdCardBack({ identity, qrImageSrc, branding }: CardFaceProps) {
  const labels = brandingWithDefaults(branding);

  return (
    <article className="student-id-card student-id-card--back" aria-label="ظهر كارت الطالب">
      <div className="student-id-card__glow student-id-card__glow--back" aria-hidden="true" />
      <div className="student-id-card__decor student-id-card__decor--top" aria-hidden="true" />
      <div className="student-id-card__decor student-id-card__decor--bottom" aria-hidden="true" />

      <div className="student-id-card__student-copy" dir="rtl">
        <strong>الطالب: {identity.name}</strong>
        <span>كود الطالب: <bdi>{identity.code}</bdi></span>
      </div>

      <div className="student-id-card__qr-panel" dir="ltr">
        <div className="student-id-card__qr-frame">
          <img src={qrImageSrc} alt={`QR للطالب ${identity.name}`} draggable={false} />
        </div>
        <strong className="student-id-card__qr-scan">{labels.qrScanLabel}</strong>
        <span className="student-id-card__qr-footer">{labels.qrFooterLabel}</span>
      </div>
    </article>
  );
}
