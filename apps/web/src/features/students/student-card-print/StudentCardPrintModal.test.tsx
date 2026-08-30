import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentCardPrintModal } from './StudentCardPrintModal';

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,AA=='),
}));

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    addImage: vi.fn(),
    output: vi.fn().mockReturnValue(new Blob(['pdf'], { type: 'application/pdf' })),
  })),
}));

describe('StudentCardPrintModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });

    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    });

    Object.defineProperty(HTMLImageElement.prototype, 'complete', {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
      configurable: true,
      get: () => 256,
    });

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:student-card'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('loads the existing QR source and builds one PDF preview', async () => {
    const loadQr = vi.fn().mockResolvedValue({
      kind: 'data-url' as const,
      value: 'data:image/png;base64,AA==',
    });

    render(
      <StudentCardPrintModal
        open
        identity={{ name: 'محمود احمد', code: 'ST-2026-0008' }}
        loadQr={loadQr}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(loadQr).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTitle('معاينة كارت محمود احمد')).not.toBeNull());
    expect(screen.getByText('Englisher ID')).not.toBeNull();
    expect(screen.getByText('مستر عبداللة سيد 2027')).not.toBeNull();
    expect(screen.getByText('الطالب: محمود احمد')).not.toBeNull();
  });

  it('closes from the close control', () => {
    const onClose = vi.fn();

    render(
      <StudentCardPrintModal
        open
        identity={{ name: 'محمود احمد', code: 'ST-2026-0008' }}
        loadQr={() => new Promise(() => undefined)}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'إغلاق' })[0]!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
