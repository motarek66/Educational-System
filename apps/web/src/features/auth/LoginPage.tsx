import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, GraduationCap, LockKeyhole, Phone } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { getApiErrorMessage } from '../../lib/api/client';
import { useAuth } from './AuthContext';

const schema = z.object({
  identifier: z.string().min(3, 'اكتب رقم الهاتف أو البريد الإلكتروني.'),
  password: z.string().min(8, 'كلمة المرور يجب ألا تقل عن 8 أحرف.'),
  rememberMe: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '', password: '', rememberMe: true },
  });

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login(values);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  };

  return (
    <main className="min-vh-100 d-grid" style={{ placeItems: 'center', background: 'var(--surface-page)', padding: 16 }}>
      <div className="row g-0 app-card overflow-hidden w-100" style={{ maxWidth: 980, minHeight: 620 }}>
        <section className="col-lg-5 d-none d-lg-flex flex-column justify-content-between p-5 text-white" style={{ background: 'var(--color-primary-600)' }}>
          <div className="d-flex align-items-center gap-3">
            <div className="bg-white text-primary rounded-circle d-grid" style={{ width: 52, height: 52, placeItems: 'center' }}><GraduationCap size={27} /></div>
            <div><div className="fw-bold fs-5">منصة متابعة الطلاب</div><div className="opacity-75 small">إدارة تعليمية أبسط وأكثر دقة</div></div>
          </div>
          <div>
            <h1 className="display-6 fw-semibold lh-base">كل بيانات طلابك وحضورهم ودرجاتهم في مكان واحد.</h1>
            <p className="opacity-75 lh-lg">واجهة عربية واضحة، مسح QR سريع، تقارير قابلة للتصدير وصلاحيات دقيقة للمشرفين.</p>
          </div>
          <p className="small opacity-75 mb-0">آمن · متجاوب · مصمم للموبايل أولًا</p>
        </section>

        <section className="col-lg-7 p-4 p-md-5 d-flex align-items-center">
          <form className="w-100 mx-auto" style={{ maxWidth: 430 }} onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="d-lg-none sidebar__brand-mark mb-4"><GraduationCap size={23} /></div>
            <h2 className="h2 fw-semibold mb-2">مرحبًا بعودتك</h2>
            <p className="text-secondary mb-4">سجل الدخول للوصول إلى لوحة الإدارة.</p>

            {serverError ? <div className="alert alert-danger border-0 rounded-3">{serverError}</div> : null}

            <div className="mb-3">
              <label className="form-label" htmlFor="identifier">الهاتف أو البريد الإلكتروني</label>
              <div className="position-relative">
                <input id="identifier" className={`form-control pe-5 ${errors.identifier ? 'is-invalid' : ''}`} autoComplete="username" {...register('identifier')} />
                <Phone size={18} className="position-absolute top-50 translate-middle-y text-secondary" style={{ right: 16 }} />
              </div>
              {errors.identifier ? <div className="text-danger small mt-1">{errors.identifier.message}</div> : null}
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="password">كلمة المرور</label>
              <div className="position-relative">
                <input id="password" type={showPassword ? 'text' : 'password'} className={`form-control px-5 ${errors.password ? 'is-invalid' : ''}`} autoComplete="current-password" {...register('password')} />
                <LockKeyhole size={18} className="position-absolute top-50 translate-middle-y text-secondary" style={{ right: 16 }} />
                <button type="button" className="btn p-1 position-absolute top-50 translate-middle-y" style={{ left: 12 }} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password ? <div className="text-danger small mt-1">{errors.password.message}</div> : null}
            </div>

            <div className="d-flex justify-content-between align-items-center mb-4">
              <label className="d-flex align-items-center gap-2 small"><input className="form-check-input m-0" type="checkbox" {...register('rememberMe')} /> تذكرني</label>
              <a href="#forgot" className="small text-primary">نسيت كلمة المرور؟</a>
            </div>

            <Button className="w-100" type="submit" loading={isSubmitting}>تسجيل الدخول</Button>
            <p className="text-secondary small text-center mt-4 mb-0">لا تشارك بيانات الدخول مع أي شخص.</p>
          </form>
        </section>
      </div>
    </main>
  );
}
