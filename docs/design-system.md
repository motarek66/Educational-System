# Design system

## Direction and typography

- Arabic first, `dir="rtl"`, `lang="ar"`.
- Primary typeface: Cairo.
- Numeric codes, phone numbers and IDs use `direction:ltr` within their own elements.
- Visual hierarchy is created by spacing, type weight and tonal surfaces rather than shadows.

## Color tokens

The reference layout used gold as an accent. This implementation preserves the spacing, radius, navigation and surface language while replacing the accent with an education-focused blue.

- Primary 50 `#EEF5FF`
- Primary 100 `#D9E9FF`
- Primary 200 `#B8D6FF`
- Primary 300 `#8CB9FF`
- Primary 400 `#5A96FF`
- Primary 500 `#2F78F4`
- Primary 600 `#155FDC`
- Primary 700 `#124CB4`
- Primary 800 `#123F8E`
- Primary 900 `#14366F`
- Background `#F5F7FA`
- Surface `#FFFFFF`
- Text `#0E121B`
- Muted `#717784`
- Border `#E1E4EA`

## Geometry

- Base spacing: 4px.
- Main page gap: 16px.
- Card padding: 20–24px.
- Radius: 8px controls, 12px buttons/cards, 16px major cards, 20px navigation shell.
- Borders are 1px and low contrast.
- No decorative drop shadows. Focus rings are the only elevated visual treatment.

## Layout

- Desktop: 96px right navigation rail, top bar, fluid content canvas.
- Tablet: collapsible navigation and two-column content.
- Mobile: top title bar + five-item bottom navigation with attendance scan emphasized.

## Components

Button, IconButton, Input, Select, SearchInput, Badge, Avatar, Card, MetricCard, DataTable, MobileDataCard, Pagination, Tabs, Modal, Drawer, Toast, Alert, EmptyState, ErrorState, Skeleton, ConfirmDialog, PermissionDenied, StudentCard, AttendanceStatusBadge, GradeInputRow and ScanResultCard.
