import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bell,
  Building2,
  CalendarRange,
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
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { displayUserName } from '../../features/auth/user-display';
import { api } from '../../lib/api/client';
import { formatDateTime } from '../../lib/formatting';
import { can } from '../../lib/permissions/can';
import type { ApiResponse } from '../../types/api';

type NotificationItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actor: { fullName: string } | null;
};

const notificationLabels: Record<string, string> = {
  STUDENT_CREATED: 'تمت إضافة طالب جديد',
  STUDENT_UPDATED: 'تم تعديل بيانات طالب',
  STUDENT_ARCHIVED: 'تمت أرشفة طالب',
  STUDENT_TRANSFERRED: 'تم نقل طالب إلى سنتر آخر',
  LESSON_CLOSED: 'تم إغلاق حصة واعتماد الحضور',
  LESSON_STARTED: 'تم بدء حصة جديدة',
  EXAM_PUBLISHED: 'تم نشر درجات امتحان',
  USER_CREATED: 'تمت إضافة مستخدم جديد',
  IMPORT_COMMITTED: 'تم اعتماد ملف استيراد',
  EXPORT_CREATED: 'تم إنشاء ملف تصدير',
};


const primaryNav = [
  { to: '/', label: 'الرئيسية', icon: LayoutDashboard, requiredPermission: 'dashboard.view' },
  { to: '/students', label: 'الطلاب', icon: GraduationCap, requiredPermission: 'students.view' },
  { to: '/centers', label: 'السناتر', icon: Building2, requiredPermission: 'centers.view' },
  { to: '/attendance', label: 'الحضور', icon: ScanLine, requiredPermission: 'attendance.view' },
  { to: '/lessons', label: 'الحصص', icon: CalendarRange, requiredPermission: 'lessons.create' },
  { to: '/reports', label: 'التقارير', icon: BarChart3, requiredPermission: 'reports.export' },
];

const secondaryNav = [
  { to: '/supervisors', label: 'المشرفون', icon: Users, adminOnly: true },
  { to: '/settings', label: 'الإعدادات', icon: Settings, adminOnly: true },
];

const routeTitles: Record<string, string> = {
  '/': 'لوحة التحكم',
  '/students': 'الطلاب',
  '/centers': 'السناتر',
  '/attendance': 'الحضور والحصص',
  '/lessons': 'الحصص',
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
  const notificationRef = useRef<HTMLDivElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => Number(localStorage.getItem('notifications:lastSeen') ?? 0));
  const userName = displayUserName(user);
  const routeRoot = `/${location.pathname.split('/').filter(Boolean)[0] ?? ''}`;
  const title = routeTitles[location.pathname] ?? routeTitles[routeRoot] ?? 'منصة متابعة الطلاب';
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<ApiResponse<NotificationItem[]>>('/audit-logs/notifications')).data.data,
    enabled: can(user, 'dashboard.view'),
    refetchInterval: 60_000,
  });
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((item) => new Date(item.createdAt).getTime() > lastSeen).length;

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const toggleNotifications = () => {
    setNotificationsOpen((current) => {
      const next = !current;
      if (next) {
        const now = Date.now();
        localStorage.setItem('notifications:lastSeen', String(now));
        setLastSeen(now);
      }
      return next;
    });
  };

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
            <div className="notification-center" ref={notificationRef}>
              <button className="btn p-2 position-relative" aria-label={`الإشعارات${unreadCount ? `، ${unreadCount} غير مقروءة` : ''}`} aria-expanded={notificationsOpen} onClick={toggleNotifications}>
                <Bell size={20} />
                {unreadCount > 0 ? <span className="notification-dot">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
              </button>
              {notificationsOpen ? (
                <div className="notification-menu app-card">
                  <div className="notification-menu__header"><strong>الإشعارات</strong><span className="text-secondary small">آخر الأنشطة</span></div>
                  <div className="notification-menu__list">
                    {notificationsQuery.isLoading ? <div className="p-3 text-secondary small">جاري تحميل الإشعارات...</div> : null}
                    {!notificationsQuery.isLoading && notifications.length === 0 ? <div className="p-3 text-secondary small">لا توجد إشعارات جديدة.</div> : null}
                    {notifications.map((item) => {
                      const content = <><span className="notification-menu__icon"><Bell size={15} /></span><span className="flex-grow-1"><strong className="d-block small">{notificationLabels[item.action] ?? item.action.replaceAll('_', ' ')}</strong><span className="text-secondary" style={{ fontSize: 11 }}>{item.actor?.fullName ?? 'النظام'} · {formatDateTime(item.createdAt)}</span></span></>;
                      const target = item.entityType === 'Student' && item.entityId
                        ? `/students/${item.entityId}`
                        : item.entityType === 'Lesson' && item.entityId ? `/lessons/${item.entityId}` : null;
                      return target
                        ? <NavLink key={item.id} to={target} className="notification-menu__item" onClick={() => setNotificationsOpen(false)}>{content}</NavLink>
                        : <div key={item.id} className="notification-menu__item">{content}</div>;
                    })}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="d-flex align-items-center gap-2 border-start ps-3">
              <div className="d-none d-md-block text-end">
                <div className="small fw-semibold">{userName}</div>
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
          <ul className="sidebar__list">{primaryNav.filter((item) => user?.isSuperAdmin || can(user, item.requiredPermission)).map((item) => <SideNavLink key={item.to} {...item} />)}</ul>
          <ul className="sidebar__list">
            {secondaryNav.filter((item) => !item.adminOnly || user?.isSuperAdmin).map((item) => <SideNavLink key={item.to} {...item} />)}
            <li><a className="sidebar__link" href="#help" title="المساعدة"><HelpCircle size={20} /><span>المساعدة</span></a></li>
            <li><button className="sidebar__link border-0 bg-transparent" onClick={() => void logout()} title="تسجيل الخروج"><LogOut size={20} /><span>تسجيل الخروج</span></button></li>
          </ul>
        </nav>
      </aside>

      <nav className="mobile-nav" aria-label="التنقل على الهاتف">
        <NavLink className="mobile-nav__link" to="/" end><LayoutDashboard size={20} /><span>الرئيسية</span></NavLink>
        <NavLink className="mobile-nav__link" to="/students"><GraduationCap size={20} /><span>الطلاب</span></NavLink>
        <NavLink className="mobile-nav__link mobile-nav__link--scan" to="/attendance"><ScanLine size={24} /><span>مسح</span></NavLink>
        <NavLink className="mobile-nav__link" to="/lessons"><CalendarRange size={20} /><span>الحصص</span></NavLink>
        <NavLink className="mobile-nav__link" to="/settings"><ShieldCheck size={20} /><span>المزيد</span></NavLink>
      </nav>
    </div>
  );
}
