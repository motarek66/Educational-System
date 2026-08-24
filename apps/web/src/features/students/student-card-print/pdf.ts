import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

const A4_WIDTH_MM = 210;
const CARD_WIDTH_MM = 100;
const CARD_HEIGHT_MM = 40;
const CARD_GAP_MM = 12;
const FIRST_CARD_TOP_MM = 70;
const PNG_PIXEL_RATIO = 3;

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));

  await Promise.all(
    images.map((image) => {
      if (image.complete && image.naturalWidth > 0) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve, reject) => {
        const handleLoad = () => {
          cleanup();
          resolve();
        };
        const handleError = () => {
          cleanup();
          reject(new Error(`تعذر تحميل صورة داخل الكارت: ${image.src}`));
        };
        const cleanup = () => {
          image.removeEventListener('load', handleLoad);
          image.removeEventListener('error', handleError);
        };

        image.addEventListener('load', handleLoad, { once: true });
        image.addEventListener('error', handleError, { once: true });
      });
    }),
  );
}

async function waitForFonts(): Promise<void> {
  if ('fonts' in document) {
    await document.fonts.ready;
  }
}

async function captureCard(element: HTMLElement): Promise<string> {
  await waitForImages(element);
  await waitForFonts();

  return toPng(element, {
    cacheBust: true,
    pixelRatio: PNG_PIXEL_RATIO,
    backgroundColor: '#0b2c5c',
  });
}

export async function buildStudentCardPdf(
  frontElement: HTMLElement,
  backElement: HTMLElement,
): Promise<Blob> {
  const [frontPng, backPng] = await Promise.all([
    captureCard(frontElement),
    captureCard(backElement),
  ]);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const x = (A4_WIDTH_MM - CARD_WIDTH_MM) / 2;
  const backY = FIRST_CARD_TOP_MM + CARD_HEIGHT_MM + CARD_GAP_MM;

  pdf.addImage(frontPng, 'PNG', x, FIRST_CARD_TOP_MM, CARD_WIDTH_MM, CARD_HEIGHT_MM, undefined, 'FAST');
  pdf.addImage(backPng, 'PNG', x, backY, CARD_WIDTH_MM, CARD_HEIGHT_MM, undefined, 'FAST');

  return pdf.output('blob');
}

export function downloadPdfBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function printPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.insetInlineStart = '-10000px';
  iframe.src = url;

  const cleanup = () => {
    iframe.remove();
    URL.revokeObjectURL(url);
  };

  iframe.addEventListener(
    'load',
    () => {
      window.setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } finally {
          window.setTimeout(cleanup, 60_000);
        }
      }, 200);
    },
    { once: true },
  );

  document.body.appendChild(iframe);
}
