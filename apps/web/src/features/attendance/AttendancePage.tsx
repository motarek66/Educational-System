import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, CheckCircle2, Keyboard, ScanLine, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import { formatDateTime } from '../../lib/formatting';
import type { ApiResponse, AttendanceScanResult } from '../../types/api';

function Scanner({ active, onDetected }: { active: boolean; onDetected: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastValueRef = useRef<{ value: string; at: number } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !videoRef.current) return;
    let disposed = false;
    setCameraError(null);
    const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 250, delayBetweenScanSuccess: 1200 });

    reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' } } },
      videoRef.current,
      (result) => {
        if (!result || disposed) return;
        const value = result.getText();
        const previous = lastValueRef.current;
        if (previous && previous.value === value && Date.now() - previous.at < 2500) return;
        lastValueRef.current = { value, at: Date.now() };
        onDetected(value);
      },
    ).then((controls) => {
      controlsRef.current = controls;
    }).catch((error: unknown) => {
      setCameraError(error instanceof Error ? error.message : 'تعذر تشغيل الكاميرا.');
    });

    return () => {
      disposed = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [active, onDetected]);

  return (
    <div className="scanner-frame">
      {active ? <video ref={videoRef} muted playsInline aria-label="كاميرا مسح QR" /> : <div className="text-center text-white"><Camera size={48} className="mb-3 opacity-75" /><p className="mb-0">اضغط «بدء المسح» ووجّه الكاميرا إلى QR الطالب.</p></div>}
      {active ? <div className="scanner-frame__guide" aria-hidden="true" /> : null}
      {cameraError ? <div className="position-absolute bottom-0 start-0 end-0 m-3 alert alert-danger border-0">{cameraError}<div className="small mt-1">يمكنك تسجيل الحضور بكود الطالب من القسم الآخر.</div></div> : null}
    </div>
  );
}

export function AttendancePage() {
  const queryClient = useQueryClient();
  const [scannerActive, setScannerActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lastResult, setLastResult] = useState<AttendanceScanResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const reflectAttendance = useCallback((result: AttendanceScanResult) => {
    setLastError(null);
    setLastResult(result);
    void queryClient.invalidateQueries({ queryKey: ['student', result.student.id] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
  }, [queryClient]);

  const scanMutation = useMutation({
    mutationFn: async (qrToken: string) => {
      const cleanedToken = qrToken.startsWith('STQR:') ? qrToken.slice(5) : qrToken;
      return (await api.post<ApiResponse<AttendanceScanResult>>('/attendance/scan', {
        qrToken: cleanedToken,
        idempotencyKey: crypto.randomUUID(),
      })).data.data;
    },
    onSuccess: (result) => {
      reflectAttendance(result);
      if ('vibrate' in navigator) navigator.vibrate(80);
    },
    onError: (error) => {
      setLastResult(null);
      setLastError(getApiErrorMessage(error));
      if ('vibrate' in navigator) navigator.vibrate([80, 50, 80]);
    },
  });

  const manualMutation = useMutation({
    mutationFn: async () => (await api.post<ApiResponse<AttendanceScanResult>>('/attendance/manual', {
      studentCode: manualCode.trim(),
      idempotencyKey: crypto.randomUUID(),
    })).data.data,
    onSuccess: (result) => {
      reflectAttendance(result);
      setManualCode('');
    },
    onError: (error) => {
      setLastResult(null);
      setLastError(getApiErrorMessage(error));
    },
  });

  const scanMutationRef = useRef(scanMutation);
  scanMutationRef.current = scanMutation;
  const onDetected = useCallback((value: string) => {
    const mutation = scanMutationRef.current;
    if (!mutation.isPending) mutation.mutate(value);
  }, []);

  return (
    <>
      <PageHeader title="تسجيل الحضور" subtitle="سجّل حضور الطالب مباشرةً عن طريق QR Code أو كود الطالب؛ وسيظهر التسجيل تلقائيًا في ملفه." />

      <div className="row g-3">
        <div className="col-xl-7">
          <Card className="panel h-100">
            <div className="panel__header">
              <div><h2 className="panel__title">Scan QR Code</h2><p className="panel__subtitle">امسح كود الطالب لتسجيل حضوره فورًا في حصة الأسبوع الحالي.</p></div>
              <ScanLine size={21} color="var(--color-primary-600)" />
            </div>
            <Scanner active={scannerActive} onDetected={onDetected} />
            <Button className="w-100 mt-3" onClick={() => setScannerActive((value) => !value)}>
              <ScanLine size={18} /> {scannerActive ? 'إيقاف المسح' : 'بدء المسح'}
            </Button>
            {scanMutation.isPending ? <div className="alert alert-info border-0 mt-3 mb-0">جار التحقق من QR وتسجيل الحضور...</div> : null}
          </Card>
        </div>

        <div className="col-xl-5">
          <Card className="panel h-100">
            <div className="panel__header">
              <div><h2 className="panel__title">إدخال كود الطالب</h2><p className="panel__subtitle">استخدم الكود المكتوب على كارت الطالب عند تعذر الكاميرا.</p></div>
              <Keyboard size={21} color="var(--color-primary-600)" />
            </div>
            <form onSubmit={(event) => { event.preventDefault(); if (manualCode.trim()) manualMutation.mutate(); }}>
              <label className="form-label">كود الطالب</label>
              <input className="form-control form-control-lg ltr-value" placeholder="ST-2026-0001" value={manualCode} onChange={(event) => setManualCode(event.target.value)} autoComplete="off" />
              <Button type="submit" className="w-100 mt-3" loading={manualMutation.isPending} disabled={!manualCode.trim()}>تسجيل الحضور</Button>
            </form>
            <div className="rounded-3 p-3 mt-4 text-secondary small" style={{ background: 'var(--surface-subtle)' }}>
              النظام يحدد السنتر والسنة والشهر والأسبوع تلقائيًا من ملف الطالب وتاريخ التسجيل.
            </div>
          </Card>
        </div>
      </div>

      {lastResult ? <div className="scan-result rounded-3 mt-3" style={{ background: 'var(--color-success-50)' }}><CheckCircle2 size={28} color="var(--color-success-500)" /><div className="flex-grow-1"><div className="fw-semibold">تم تسجيل حضور {lastResult.student.fullName}</div><div className="text-secondary small"><span className="ltr-value d-inline-block">{lastResult.student.studentCode}</span> · {lastResult.lesson.title} · {formatDateTime(lastResult.recordedAt)}</div></div><StatusBadge label={lastResult.status === 'LATE' ? 'متأخر' : 'حاضر'} tone={lastResult.status === 'LATE' ? 'warning' : 'success'} /></div> : null}
      {lastError ? <div className="scan-result rounded-3 mt-3" style={{ background: 'var(--color-danger-50)' }}><XCircle size={28} color="var(--color-danger-500)" /><div><div className="fw-semibold">لم يتم التسجيل</div><div className="text-secondary small">{lastError}</div></div></div> : null}
    </>
  );
}
