import {
  BarChart3,
  Bell,
  BookOpenCheck,
  Building2,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';

const primaryNav = [
  { to: '/', label: 'الرئيسية', icon: LayoutDashboard },
  { to: '/students', label: 'الطلاب', icon: GraduationCap },
  { to: '/centers', label: 'السناتر', icon: Building2 },
  { to: '/attendance', label: 'الحضور', icon: ScanLine },
  { to: '/exams', label: 'الامتحانات', icon: BookOpenCheck },
  { to: '/reports', label: 'التقارير', icon: BarChart3 },
];

const secondaryNav = [
  { to: '/supervisors', label: 'المشرفون', icon: Users },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
];

const routeTitles: Record<string, string> = {
  '/': 'لوحة التحكم',
  '/students': 'الطلاب',
  '/centers': 'السناتر',
  '/attendance': 'الحضور والحصص',
  '/exams': 'الامتحانات والدرجات',
  '/reports': 'التقارير والتصدير',
  '/supervisors': 'المشرفون والصلاحيات',
  '/settings': 'إعدادات النظام',
};

function SideNavLink({ to, label, icon: Icon }: (typeof primaryNav)[number]) {
  return (
    <li>
      <NavLink className="sidebar__link" to={to} end={to === '/'} aria-label={label} title={label}>
        <Icon size={20} aria-hidden="true" />
        <span>{label}</span>
      </NavLink>
    </li>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const routeRoot = `/${location.pathname.split('/').filter(Boolean)[0] ?? ''}`;
  const title = routeTitles[location.pathname] ?? routeTitles[routeRoot] ?? 'منصة متابعة الطلاب';

  return (
    <div className="app-shell">
      <main className="app-main">
        <header className="topbar">
          <div className="topbar__section">
            <button className="btn p-2 d-lg-none" type="button" aria-label="فتح القائمة"><Menu size={22} /></button>
            <div>
              <div className="fw-semibold">{title}</div>
              <div className="text-secondary small topbar__desktop-only">عام / {title}</div>
            </div>
          </div>

          <div className="topbar__section">
            <div className="position-relative topbar__desktop-only">
              <input className="form-control topbar__search" placeholder="ابحث عما تريد..." aria-label="البحث العام" />
              <Search size={17} className="position-absolute top-50 translate-middle-y text-secondary" style={{ insetInlineEnd: 0 }} />
            </div>
            <button className="btn p-2 position-relative" aria-label="الإشعارات">
              <Bell size={20} />
              <span className="position-absolute rounded-circle bg-danger" style={{ width: 7, height: 7, top: 8, right: 7 }} />
            </button>
            <div className="d-flex align-items-center gap-2 border-end pe-3">
              <div className="d-none d-md-block text-end">
                <div className="small fw-semibold">{user?.fullName}</div>
                <div className="text-secondary" style={{ fontSize: 11 }}>{user?.isSuperAdmin ? 'مدير النظام' : 'مشرف'}</div>
              </div>
              <div className="sidebar__brand-mark" style={{ width: 40, height: 40 }}><Users size={19} /></div>
            </div>
          </div>
        </header>
        <section className="page-content"><Outlet /></section>
      </main>

      <aside className="sidebar" aria-label="التنقل الرئيسي">
        <div className="sidebar__brand" title="منصة متابعة الطلاب">
          <div className="sidebar__brand-mark"><GraduationCap size={23} /></div>
        </div>
        <nav className="sidebar__nav">
          <ul className="sidebar__list">{primaryNav.map((item) => <SideNavLink key={item.to} {...item} />)}</ul>
          <ul className="sidebar__list">
            {secondaryNav.map((item) => <SideNavLink key={item.to} {...item} />)}
            <li><a className="sidebar__link" href="#help" title="المساعدة"><HelpCircle size={20} /><span>المساعدة</span></a></li>
            <li><button className="sidebar__link border-0 bg-transparent" onClick={() => void logout()} title="تسجيل الخروج"><LogOut size={20} /><span>تسجيل الخروج</span></button></li>
          </ul>
        </nav>
      </aside>

      <nav className="mobile-nav" aria-label="التنقل على الهاتف">
        <NavLink className="mobile-nav__link" to="/" end><LayoutDashboard size={20} /><span>الرئيسية</span></NavLink>
        <NavLink className="mobile-nav__link" to="/students"><GraduationCap size={20} /><span>الطلاب</span></NavLink>
        <NavLink className="mobile-nav__link mobile-nav__link--scan" to="/attendance"><ScanLine size={24} /><span>مسح</span></NavLink>
        <NavLink className="mobile-nav__link" to="/exams"><BookOpenCheck size={20} /><span>الامتحانات</span></NavLink>
        <NavLink className="mobile-nav__link" to="/settings"><ShieldCheck size={20} /><span>المزيد</span></NavLink>
      </nav>
    </div>
  );
}
