import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { AttendancePage } from '../features/attendance/AttendancePage';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { CentersPage } from '../features/centers/CentersPage';
import { CenterDetailsPage } from '../features/centers/CenterDetailsPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ExamsPage } from '../features/exams/ExamsPage';
import { GradebookPage } from '../features/exams/GradebookPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { StudentProfilePage } from '../features/students/StudentProfilePage';
import { StudentsPage } from '../features/students/StudentsPage';
import { SupervisorsPage } from '../features/supervisors/SupervisorsPage';
import { NotFoundPage } from './NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="students/:studentId" element={<StudentProfilePage />} />
          <Route path="centers" element={<CentersPage />} />
          <Route path="centers/:centerId" element={<CenterDetailsPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="exams/:examId/gradebook" element={<GradebookPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="supervisors" element={<SupervisorsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
