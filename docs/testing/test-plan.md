# Test plan

## Automated gates

1. TypeScript strict typecheck for web and API.
2. ESLint with zero warnings.
3. Unit tests for normalization, status calculations and UI status components.
4. API integration tests against a disposable PostgreSQL database.
5. Playwright E2E and visual snapshots at mobile and desktop widths.
6. Production builds for both applications.

## Critical E2E flow

1. Login as Super Admin.
2. Create academic year, center and group.
3. Create student and guardian in one transaction.
4. Verify generated Student Code and QR.
5. Open lesson and scan the student.
6. Scan again and assert `ATTENDANCE_ALREADY_RECORDED`.
7. Close lesson and generate absent rows for unrecorded enrollments.
8. Create exam, enter grade and publish.
9. Preview WhatsApp result message; assert status is not recorded as sent automatically.
10. Export students/attendance/grades and verify workbook headers.
11. Login as scoped supervisor and assert another center returns 404/403 without leaking data.

## Security checks

- IDOR across organizations, centers and groups.
- Refresh-token reuse and session revocation.
- Login/scan/import/export rate limits.
- Formula injection in Excel cells.
- Malicious filenames and MIME mismatch.
- XSS payloads in notes and feedback.
- No secrets or token values in logs/audit rows.

## Manual device matrix

- Chrome Android: rear camera, permission denial, torch availability.
- Safari iOS: HTTPS camera, app switching, interrupted scan.
- Desktop Chrome/Edge: responsive lists and gradebook keyboard flow.
- 320px, 375px, 768px, 1280px and 1600px viewport review.
