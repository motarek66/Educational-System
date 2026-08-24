import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudentProfile } from '../../types/api';
import { StudentProfilePage } from './StudentProfilePage';

const apiGet = vi.fn();

vi.mock('../../lib/api/client', () => ({
  api: { get: (...args: unknown[]) => apiGet(...args) },
  getApiErrorMessage: () => 'error',
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { isSuperAdmin: true, permissions: [] } }),
}));

vi.mock('../whatsapp/WhatsAppDialog', () => ({ WhatsAppDialog: () => null }));
vi.mock('./StudentFormDialog', () => ({ StudentFormDialog: () => null }));

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,AA=='),
}));

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    addImage: vi.fn(),
    output: vi.fn().mockReturnValue(new Blob(['pdf'], { type: 'application/pdf' })),
  })),
}));

const student: StudentProfile = {
  id: 'student-1',
  fullName: 'محمود أحمد',
  studentCode: 'ST-2026-0008',
  gradeLevel: 'الصف الأول',
  centerName: 'المركز الرئيسي',
  guardianPhone: null,
  status: 'ACTIVE',
  studentPhone: null,
  schoolName: null,
  address: null,
  academicYear: null,
  guardians: [],
  attendanceSummary: { present: 0, late: 0, absent: 0, rate: 0 },
  attendanceSessions: [],
  gradeSummary: { average: 0, publishedExams: 0 },
  weeklyAttendance: [],
  lessonGrades: [],
};

describe('StudentProfilePage card printing', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url.endsWith('/profile')) {
        return Promise.resolve({ data: { data: student } });
      }

      return new Promise(() => undefined);
    });
  });

  it('opens the student card print dialog from the profile action', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <MemoryRouter initialEntries={['/students/student-1']}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/students/:studentId" element={<StudentProfilePage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /طباعة الكارت/ }));

    const dialog = screen.getByRole('dialog', { name: /معاينة طباعة كارت الطالب/ });
    expect(dialog.parentElement).toBe(document.body);
  });
});
