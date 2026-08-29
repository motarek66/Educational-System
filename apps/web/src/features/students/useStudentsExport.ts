import { useState } from 'react';
import { api } from '../../lib/api/client';
import type { ApiResponse } from '../../types/api';

/**
 * Triggers the server-side export:
 *   1. POST /exports/students  → creates export job → { id, status }
 *   2. GET  /exports/:id/download → streams the .xlsx file as a download
 */
export function useStudentsExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportStudents = async () => {
    setIsExporting(true);
    setError(null);
    try {
      // Step 1: kick off the export job
      const jobResponse = await api.post<ApiResponse<{ id: string; status: string }>>('/exports/students');
      const jobId = jobResponse.data.data.id;

      // Step 2: download the generated file as a blob
      const fileResponse = await api.get(`/exports/${jobId}/download`, {
        responseType: 'blob',
      });

      // Extract filename from Content-Disposition header or use a fallback
      const disposition = fileResponse.headers['content-disposition'] as string | undefined;
      let fileName = 'students-export.xlsx';
      if (disposition) {
        const match = /filename="?([^";\n]+)"?/i.exec(disposition);
        if (match?.[1]) fileName = match[1];
      }

      // Trigger browser download
      const url = URL.createObjectURL(new Blob([fileResponse.data as BlobPart]));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      setError('فشل تصدير البيانات. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportStudents, isExporting, error };
}
