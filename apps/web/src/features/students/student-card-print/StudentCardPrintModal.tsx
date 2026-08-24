import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StudentIdCardBack, StudentIdCardFront } from './StudentIdCard';
import { buildStudentCardPdf, downloadPdfBlob, printPdfBlob } from './pdf';
import { qrSourceToImageSrc } from './qrSource';
import type { StudentCardBranding, StudentCardIdentity, StudentCardQrSource } from './types';
import './studentCardPrint.css';

type StudentCardPrintModalProps = {
  open: boolean;
  identity: StudentCardIdentity;
  loadQr: () => Promise<StudentCardQrSource>;
  onClose: () => void;
  branding?: StudentCardBranding;
};

type PreviewStatus = 'idle' | 'loading-qr' | 'building-pdf' | 'ready' | 'error';

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function sanitizeFilePart(value: string): string {
  const sanitized = value.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return sanitized || 'student';
}

export function StudentCardPrintModal({
  open,
  identity,
  loadQr,
  onClose,
  branding,
}: StudentCardPrintModalProps) {
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const generationIdRef = useRef(0);
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [error, setError] = useState<string>('');
  const [qrImageSrc, setQrImageSrc] = useState('');
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState('');

  const pdfFileName = useMemo(
    () => `student-card-${sanitizeFilePart(identity.code)}.pdf`,
    [identity.code],
  );

  const clearPdf = useCallback(() => {
    setPdfBlob(null);
    setPdfUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return '';
    });
  }, []);

  const generatePreview = useCallback(
    async (qrSource: StudentCardQrSource) => {
      const generationId = ++generationIdRef.current;
      clearPdf();
      setError('');

      try {
        const nextQrImageSrc = qrSourceToImageSrc(qrSource);
        setQrImageSrc(nextQrImageSrc);
        setStatus('building-pdf');

        await nextPaint();

        if (generationId !== generationIdRef.current) {
          return;
        }

        const frontElement = frontRef.current;
        const backElement = backRef.current;
        if (!frontElement || !backElement) {
          throw new Error('تعذر تجهيز عناصر الكارت للطباعة.');
        }

        const blob = await buildStudentCardPdf(frontElement, backElement);
        if (generationId !== generationIdRef.current) {
          return;
        }

        const url = URL.createObjectURL(blob);
        setPdfBlob(blob);
        setPdfUrl(url);
        setStatus('ready');
      } catch (caughtError) {
        if (generationId !== generationIdRef.current) {
          return;
        }

        setStatus('error');
        setError(caughtError instanceof Error ? caughtError.message : 'تعذر إنشاء ملف PDF للكارت.');
      }
    },
    [clearPdf],
  );

  const loadAndGenerate = useCallback(async () => {
    const generationId = ++generationIdRef.current;
    clearPdf();
    setQrImageSrc('');
    setError('');
    setStatus('loading-qr');

    try {
      const qrSource = await loadQr();
      if (generationId !== generationIdRef.current) {
        return;
      }

      // generatePreview owns a fresh generation id from this point forward.
      await generatePreview(qrSource);
    } catch (caughtError) {
      if (generationId !== generationIdRef.current) {
        return;
      }

      setStatus('error');
      setError(caughtError instanceof Error ? caughtError.message : 'تعذر تحميل QR الخاص بالطالب.');
    }
  }, [clearPdf, generatePreview, loadQr]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadAndGenerate();
  }, [open, identity.code, loadAndGenerate]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open]);

  useEffect(
    () => () => {
      generationIdRef.current += 1;
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    },
    [pdfUrl],
  );

  if (!open) {
    return null;
  }

  const isBusy = status === 'loading-qr' || status === 'building-pdf';

  return createPortal(
    <div className="student-card-print-modal" role="dialog" aria-modal="true" aria-labelledby="student-card-print-title">
      <div className="student-card-print-modal__backdrop" aria-hidden="true" />
      <section className="student-card-print-modal__dialog" dir="rtl">
        <header className="student-card-print-modal__header">
          <div>
            <h2 id="student-card-print-title">معاينة طباعة كارت الطالب</h2>
            <p>{identity.name} · <bdi>{identity.code}</bdi></p>
          </div>
          <button type="button" className="student-card-print-modal__close" onClick={onClose} aria-label="إغلاق">
            ×
          </button>
        </header>

        <div className="student-card-print-modal__body">
          {isBusy ? (
            <div className="student-card-print-modal__state" role="status">
              <span className="student-card-print-modal__spinner" aria-hidden="true" />
              <strong>{status === 'loading-qr' ? 'جاري تحميل QR...' : 'جاري تجهيز معاينة PDF...'}</strong>
              <span>سيظهر الوجه والظهر في صفحة PDF واحدة.</span>
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="student-card-print-modal__state student-card-print-modal__state--error" role="alert">
              <strong>لم يتم إنشاء المعاينة</strong>
              <span>{error}</span>
              <button type="button" className="btn btn-outline-primary" onClick={() => void loadAndGenerate()}>
                إعادة المحاولة
              </button>
            </div>
          ) : null}

          {status === 'ready' && pdfUrl ? (
            <iframe
              className="student-card-print-modal__pdf"
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
              title={`معاينة كارت ${identity.name}`}
            />
          ) : null}
        </div>

        <footer className="student-card-print-modal__footer">
          <button
            type="button"
            className="btn btn-light student-card-print-modal__cancel"
            onClick={onClose}
          >
            إغلاق
          </button>
          <div className="student-card-print-modal__actions">
            <button
              type="button"
              className="btn btn-outline-primary"
              disabled={!pdfBlob || isBusy}
              onClick={() => pdfBlob && downloadPdfBlob(pdfBlob, pdfFileName)}
            >
              تحميل PDF
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!pdfBlob || isBusy}
              onClick={() => pdfBlob && printPdfBlob(pdfBlob)}
            >
              طباعة
            </button>
          </div>
        </footer>

        <div className="student-card-print-capture" aria-hidden="true">
          <div ref={frontRef} className="student-card-print-capture__card">
            <StudentIdCardFront branding={branding} />
          </div>
          <div ref={backRef} className="student-card-print-capture__card">
            {qrImageSrc ? (
              <StudentIdCardBack identity={identity} qrImageSrc={qrImageSrc} branding={branding} />
            ) : null}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
