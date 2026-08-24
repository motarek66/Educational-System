import * as XLSX from 'xlsx';
import { useState } from 'react';
import { api } from '../../lib/api/client';
import type { ApiResponse, StudentListItem } from '../../types/api';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'نشط',
  INACTIVE: 'غير نشط',
  WITHDRAWN: 'منسحب',
  SUSPENDED: 'موقوف',
};

/**
 * Fetches ALL students (no pagination) and generates an Excel file download.
 * Returns { exportStudents, isExporting, error }.
 */
export function useStudentsExport(filters: {
  search?: string;
  status?: string;
  academicYearId?: string;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportStudents = async () => {
    setIsExporting(true);
    setError(null);
    try {
      // Fetch up to 5000 students (no pagination limit in one request)
      const response = await api.get<ApiResponse<StudentListItem[]>>('/students', {
        params: {
          search: filters.search || undefined,
          status: filters.status || undefined,
          academicYearId: filters.academicYearId || undefined,
          sort: 'newest',
          limit: 5000,
          page: 1,
        },
      });

      const students = response.data.data;

      if (!students || students.length === 0) {
        setError('لا توجد بيانات طلاب للتصدير بناءً على الفلاتر الحالية.');
        setIsExporting(false);
        return;
      }

      // Map to Arabic-headed rows
      const rows = students.map((s, index) => ({
        '#': index + 1,
        'كود الطالب': s.studentCode,
        'اسم الطالب': s.fullName,
        'المرحلة الدراسية': s.gradeLevel,
        'اسم السنتر': s.centerName,
        'رقم ولي الأمر': s.guardianPhone ?? '',
        'الحالة': STATUS_LABELS[s.status] ?? s.status,
      }));

      // Build worksheet
      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Set RTL direction and column widths
      worksheet['!dir'] = 'rtl';
      worksheet['!cols'] = [
        { wch: 5 },   // #
        { wch: 14 },  // كود الطالب
        { wch: 28 },  // اسم الطالب
        { wch: 20 },  // المرحلة
        { wch: 20 },  // السنتر
        { wch: 16 },  // رقم ولي الأمر
        { wch: 12 },  // الحالة
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'الطلاب');

      // Add a helper "template" sheet so users know the import format
      const templateRows = [
        {
          'اسم الطالب': 'محمد أحمد السيد',
          'المرحلة الدراسية': 'الثالث الثانوي',
          'اسم ولي الأمر': 'أحمد السيد',
          'رقم ولي الأمر': '+201012345678',
          'رقم الطالب': '+201198765432',
          'الحالة': 'نشط',
        },
      ];
      const templateSheet = XLSX.utils.json_to_sheet(templateRows);
      templateSheet['!cols'] = [
        { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(workbook, templateSheet, 'نموذج الاستيراد');

      // Trigger download
      const date = new Date().toLocaleDateString('en-EG').replace(/\//g, '-');
      XLSX.writeFile(workbook, `students-export-${date}.xlsx`);
    } catch (err) {
      console.error(err);
      setError('فشل تصدير البيانات. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportStudents, isExporting, error };
}
