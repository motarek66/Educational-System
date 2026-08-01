# API endpoint matrix

Base path: `/api/v1`

## Auth and authorization

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | Login and create rotating session |
| POST | `/auth/refresh` | Rotate refresh token and issue access token |
| POST | `/auth/logout` | Revoke current session |
| GET | `/auth/me` | Current user, roles and permissions |
| GET | `/auth/sessions` | Active sessions |
| GET/POST | `/roles` | List/create roles |
| GET | `/permissions` | Permission catalog |
| PUT | `/roles/:id/permissions` | Replace role permissions |
| PUT | `/users/:id/scopes` | Update center/group scope |

## Academic operations

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/academic-years` | List/create academic years |
| GET/POST | `/centers` | List/create centers |
| GET | `/centers/options` | Scoped selector options |
| GET/POST | `/groups` | List/create groups |
| GET | `/groups/options` | Scoped selector options |
| GET/POST | `/students` | Paginated search/create student transaction |
| GET | `/students/:id/profile` | Unified student profile |
| GET | `/students/:id/qr` | Render current QR |
| POST | `/students/:id/qr/rotate` | Revoke and regenerate QR |
| POST | `/students/:id/archive` | Soft archive |
| POST | `/students/:id/transfer` | Close old enrollment and create a new one |

## Attendance and grading

| Method | Path | Purpose |
|---|---|---|
| GET | `/lessons/today` | Today's scoped lessons |
| POST | `/lessons` | Create lesson |
| POST | `/lessons/:id/open` | Open attendance |
| POST | `/lessons/:id/close` | Close and optionally create absences |
| POST | `/attendance/scan` | Secure QR scan |
| POST | `/attendance/manual` | Code/manual registration |
| GET/POST | `/exams` | List/create exams |
| GET | `/exams/:id/gradebook` | Gradebook rows |
| PUT | `/exams/:id/grades/bulk` | Validate and save grades |
| POST | `/exams/:id/publish` | Publish validated exam |

## Data operations

| Method | Path | Purpose |
|---|---|---|
| GET | `/dashboard/overview` | Main aggregated metrics |
| GET | `/imports/templates/students` | Download safe XLSX template |
| POST | `/imports/students/upload` | Validate and preview import |
| GET | `/imports/:id/preview` | Import validation result |
| POST | `/imports/:id/commit` | Commit approved rows |
| POST | `/exports/students` | Students XLSX |
| POST | `/exports/attendance` | Attendance XLSX |
| POST | `/exports/grades` | Grades XLSX |
| POST | `/exports/full-snapshot` | ZIP snapshot + manifest |
| GET | `/exports/:id/download` | Temporary scoped download |
| GET | `/whatsapp/templates` | Active templates |
| POST | `/whatsapp/preview` | Render and validate click-to-chat message |
| GET | `/audit-logs` | Super Admin audit view |
| GET | `/health/live` | Process liveness |
| GET | `/health/ready` | Database readiness |

Swagger is generated at runtime from controller metadata at `/docs`. The endpoints above represent the implemented vertical slices; extension endpoints from the product specification can be added without changing module boundaries.
