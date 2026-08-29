import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, CheckCircle2, Clock3, Keyboard, Play, Save, ScanLine, Square, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import { formatDateTime, formatNumber } from '../../lib/formatting';
import type { ApiResponse, AttendanceScanResult, LessonDetails } from '../../types/api';

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
    reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, videoRef.current, (result) => {
      if (!result || disposed) return;
      const value = result.getText();
      const previous = lastValueRef.current;
      if (previous && previous.value === value && Date.now() - previous.at < 2500) return;
      lastValueRef.current = { value, at: Date.now() };
      onDetected(value);
    }).then((controls) => { controlsRef.current = controls; }).catch(() => setCameraError('تعذر تشغيل الكاميرا. يمكنك استخدام كود الطالب.'));
    return () => { disposed = true; controlsRef.current?.stop(); controlsRef.current = null; };
  }, [active, onDetected]);

  return <div className="scanner-frame">
    {active ? <video ref={videoRef} muted playsInline aria-label="كاميرا مسح QR" /> : <div className="text-center text-white"><Camera size={48} className="mb-3 opacity-75" /><p className="mb-0">اضغط «بدء المسح» ووجّه الكاميرا إلى QR الطالب.</p></div>}
    {active ? <div className="scanner-frame__guide" aria-hidden="true" /> : null}
    {cameraError ? <div className="position-absolute bottom-0 start-0 end-0 m-3 alert alert-danger border-0">{cameraError}</div> : null}
  </div>;
}

function GradeInput({ lessonId, enrollmentId, value, maxScore }: { lessonId: string; enrollmentId: string; value: number | null; maxScore: number }) {
  const queryClient = useQueryClient();
  const [score, setScore] = useState(value === null ? '' : String(value));
  useEffect(() => setScore(value === null ? '' : String(value)), [value]);
  const mutation = useMutation({
    mutationFn: async () => (await api.put(`/lessons/${lessonId}/grades/${enrollmentId}`, { score: Number(score) })).data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['lessons', 'active'] }),
  });
  return <div className="d-flex gap-1 align-items-center" style={{ minWidth: 125 }}>
    <input className="form-control form-control-sm ltr-value" type="number" min={0} max={maxScore} step="0.5" value={score} onChange={(event) => setScore(event.target.value)} placeholder={`من ${maxScore}`} />
    <button className="btn btn-sm btn-outline-primary" type="button" disabled={score === '' || mutation.isPending} onClick={() => mutation.mutate()} aria-label="حفظ الدرجة"><Save size={15} /></button>
  </div>;
}

export function AttendancePage() {
  const queryClient = useQueryClient();
  const [scannerActive, setScannerActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lastResult, setLastResult] = useState<AttendanceScanResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const lessonQuery = useQuery({
    queryKey: ['lessons', 'active'],
    queryFn: async () => (await api.get<ApiResponse<LessonDetails | null>>('/lessons/active')).data.data,
    refetchInterval: 3_000,
  });
  const lesson = lessonQuery.data;

  const startMutation = useMutation({
    mutationFn: async () => (await api.post('/lessons/start')).data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['lessons'] }),
  });
  const closeMutation = useMutation({
    mutationFn: async () => lesson && (await api.post(`/lessons/${lesson.id}/close`)).data,
    onSuccess: () => { setScannerActive(false); void queryClient.invalidateQueries({ queryKey: ['lessons'] }); },
  });

  const reflectAttendance = useCallback((result: AttendanceScanResult) => {
    setLastError(null); setLastResult(result);
    void queryClient.invalidateQueries({ queryKey: ['lessons', 'active'] });
    void queryClient.invalidateQueries({ queryKey: ['student', result.student.id] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
  }, [queryClient]);
  const scanMutation = useMutation({
    mutationFn: async (qrToken: string) => (await api.post<ApiResponse<AttendanceScanResult>>('/attendance/scan', { qrToken: qrToken.startsWith('STQR:') ? qrToken.slice(5) : qrToken, idempotencyKey: crypto.randomUUID() })).data.data,
    onSuccess: (result) => { reflectAttendance(result); if ('vibrate' in navigator) navigator.vibrate(80); },
    onError: (error) => { setLastResult(null); setLastError(getApiErrorMessage(error)); },
  });
  const manualMutation = useMutation({
    mutationFn: async () => (await api.post<ApiResponse<AttendanceScanResult>>('/attendance/manual', { studentCode: manualCode.trim(), idempotencyKey: crypto.randomUUID() })).data.data,
    onSuccess: (result) => { reflectAttendance(result); setManualCode(''); },
    onError: (error) => { setLastResult(null); setLastError(getApiErrorMessage(error)); },
  });
  const scanMutationRef = useRef(scanMutation); scanMutationRef.current = scanMutation;
  const onDetected = useCallback((value: string) => { if (!scanMutationRef.current.isPending) scanMutationRef.current.mutate(value); }, []);

  if (lessonQuery.isError) return <ErrorState message={getApiErrorMessage(lessonQuery.error)} onRetry={() => void lessonQuery.refetch()} />;

  return <>
    <PageHeader title="الحضور" subtitle="ابدأ الحصة مباشرة، ثم سجّل الطلاب وأدخل درجاتهم من نفس الشاشة." actions={lesson ? <Button variant="danger" loading={closeMutation.isPending} onClick={() => { if (window.confirm('هل تريد إنهاء الحصة؟ لن يُسجل غياب على أي طالب الآن.')) closeMutation.mutate(); }}><Square size={17} /> إنهاء الحصة</Button> : undefined} />

    {!lesson && !lessonQuery.isLoading ? <Card className="panel text-center py-5">
      <div className="mx-auto mb-3 sidebar__brand-mark" style={{ width: 64, height: 64 }}><Play size={28} /></div>
      <h2 className="h4">لا توجد حصة جارية</h2>
      <p className="text-secondary">سيُطبّق النظام الحصة تلقائيًا على كل السناتر الموجودة ضمن صلاحياتك.</p>
      <div><Button loading={startMutation.isPending} onClick={() => startMutation.mutate()}><Play size={19} /> ابدأ حصة الآن</Button></div>
      {startMutation.isError ? <div className="alert alert-danger mt-3 mb-0">{getApiErrorMessage(startMutation.error)}</div> : null}
    </Card> : null}

    {lesson ? <>
      <Card className="panel mb-3">
        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
          <div><div className="d-flex align-items-center gap-2"><span className="live-dot" /><h2 className="h5 mb-0">{lesson.title}</h2><StatusBadge label="جارية" tone="success" /></div><div className="text-secondary small mt-2"><Clock3 size={14} className="ms-1" /> بدأت {formatDateTime(lesson.startsAt)} · التأخير بعد {lesson.lateAfterMinutes} دقيقة</div></div>
          <div className="d-flex gap-3"><div><strong>{formatNumber(lesson.summary.registered)}</strong><div className="small text-secondary">مسجل</div></div><div><strong>{formatNumber(lesson.summary.late)}</strong><div className="small text-secondary">متأخر</div></div><div><strong>{formatNumber(lesson.summary.gradesEntered)}</strong><div className="small text-secondary">درجة</div></div></div>
        </div>
      </Card>
      <div className="row g-3">
        <div className="col-xl-7"><Card className="panel h-100"><div className="panel__header"><div><h2 className="panel__title">مسح QR Code</h2><p className="panel__subtitle">توقيت التسجيل والحالة يُحسبان من السيرفر تلقائيًا.</p></div><ScanLine size={21} color="var(--color-primary-600)" /></div><Scanner active={scannerActive} onDetected={onDetected} /><Button className="w-100 mt-3" onClick={() => setScannerActive((value) => !value)}><ScanLine size={18} /> {scannerActive ? 'إيقاف المسح' : 'بدء المسح'}</Button></Card></div>
        <div className="col-xl-5"><Card className="panel h-100"><div className="panel__header"><div><h2 className="panel__title">إدخال كود الطالب</h2><p className="panel__subtitle">بديل سريع عند تعذر استخدام الكاميرا.</p></div><Keyboard size={21} color="var(--color-primary-600)" /></div><form onSubmit={(event) => { event.preventDefault(); if (manualCode.trim()) manualMutation.mutate(); }}><label className="form-label">كود الطالب</label><input className="form-control form-control-lg ltr-value" placeholder="ST-2026-0001" value={manualCode} onChange={(event) => setManualCode(event.target.value)} autoComplete="off" /><Button type="submit" className="w-100 mt-3" loading={manualMutation.isPending} disabled={!manualCode.trim()}>تسجيل الحضور</Button></form></Card></div>
      </div>

      {lastResult ? <div className="scan-result rounded-3 mt-3" style={{ background: 'var(--color-success-50)' }}><CheckCircle2 size={28} color="var(--color-success-500)" /><div className="flex-grow-1"><div className="fw-semibold">تم تسجيل حضور {lastResult.student.fullName}</div><div className="text-secondary small"><span className="ltr-value d-inline-block">{lastResult.student.studentCode}</span> · {formatDateTime(lastResult.recordedAt)}</div></div><StatusBadge label={lastResult.status === 'LATE' ? 'متأخر' : 'حاضر'} tone={lastResult.status === 'LATE' ? 'warning' : 'success'} /></div> : null}
      {lastError ? <div className="scan-result rounded-3 mt-3" style={{ background: 'var(--color-danger-50)' }}><XCircle size={28} color="var(--color-danger-500)" /><div><div className="fw-semibold">لم يتم التسجيل</div><div className="text-secondary small">{lastError}</div></div></div> : null}

      <Card className="panel mt-3">
        <div className="panel__header"><div><h2 className="panel__title">الطلاب الحاضرون ودرجات الحصة</h2><p className="panel__subtitle">القائمة تتحدث تلقائيًا عند التسجيل من أي جهاز.</p></div><Link to={`/lessons/${lesson.id}`} className="app-button app-button--secondary">عرض التفاصيل</Link></div>
        <div className="table-responsive"><table className="table align-middle"><thead><tr><th>الطالب</th><th>السنتر / المرحلة</th><th>وقت الحضور</th><th>الحالة</th><th>الدرجة</th></tr></thead><tbody>{lesson.rows.map((row) => <tr key={row.attendanceId}><td><Link to={`/students/${row.studentId}`} className="fw-semibold text-decoration-none">{row.fullName}</Link><div className="text-secondary small ltr-value">{row.studentCode}</div></td><td>{row.centerName}<div className="text-secondary small">{row.gradeLevel}</div></td><td>{formatDateTime(row.checkInAt)}</td><td><StatusBadge label={row.attendanceStatus === 'LATE' ? 'متأخر' : 'حاضر'} tone={row.attendanceStatus === 'LATE' ? 'warning' : 'success'} /></td><td>{lesson.assessment ? <GradeInput lessonId={lesson.id} enrollmentId={row.enrollmentId} value={row.score} maxScore={lesson.assessment.maxScore} /> : '—'}</td></tr>)}</tbody></table></div>

        <div className="data-card-list p-3">{lesson.rows.map((row) => <div key={row.attendanceId} className="rounded-3 p-3" style={{ background: 'var(--surface-subtle)' }}>
          <div className="d-flex align-items-start justify-content-between gap-2">
            <Link to={`/students/${row.studentId}`} className="text-body"><div className="fw-semibold">{row.fullName}</div><div className="text-secondary small ltr-value">{row.studentCode}</div></Link>
            <StatusBadge label={row.attendanceStatus === 'LATE' ? 'متأخر' : 'حاضر'} tone={row.attendanceStatus === 'LATE' ? 'warning' : 'success'} />
          </div>
          <div className="text-secondary small mt-2">{row.centerName} · {row.gradeLevel} · {formatDateTime(row.checkInAt)}</div>
          {lesson.assessment ? <div className="mt-3"><GradeInput lessonId={lesson.id} enrollmentId={row.enrollmentId} value={row.score} maxScore={lesson.assessment.maxScore} /></div> : null}
        </div>)}</div>

        {lesson.rows.length === 0 ? <div className="text-center text-secondary py-4">لم يُسجل أي طالب بعد.</div> : null}
      </Card>
    </> : null}
  </>;
}
