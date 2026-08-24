# Student Card Print — integration handoff

This folder is a drop-in implementation for `motarek66/Educational-System`.

## Goal

Wire the **existing** `طباعة الكارت` button on `StudentProfilePage.tsx` so it opens `StudentCardPrintModal`.
The modal must:

- load the exact same backend-truth QR data already used by the existing `عرض QR` flow;
- build one A4 PDF with the card front and back stacked vertically;
- display that generated PDF inside the modal;
- allow `تحميل PDF` and `طباعة` from inside the modal;
- keep the existing QR modal and every unrelated behavior unchanged.

## Files to copy

Copy this folder into the repository root preserving paths. It adds:

`apps/web/src/features/students/student-card-print/*`

## Dependencies

From the repo root, add only if they are not already installed in `apps/web`:

```bash
pnpm --dir apps/web add jspdf html-to-image
```

Do not upgrade unrelated packages or major versions.

## StudentProfilePage.tsx wiring

1. Import React state if it is not already available:

```tsx
import { useState } from 'react';
```

2. Import the feature:

```tsx
import {
  StudentCardPrintModal,
  type StudentCardQrSource,
} from './student-card-print';
```

3. Inside `StudentProfilePage`, add:

```tsx
const [isCardPrintOpen, setIsCardPrintOpen] = useState(false);
```

4. Find the EXISTING `طباعة الكارت` button. Keep its classes, icon and placement exactly as-is; only replace/add its click handler:

```tsx
onClick={() => setIsCardPrintOpen(true)}
```

5. Reuse the current `عرض QR` data loader instead of inventing a second API endpoint. Create an adapter that returns one of these forms:

```tsx
const loadStudentCardQr = async (): Promise<StudentCardQrSource> => {
  // IMPORTANT: call/reuse the same query/API helper that the existing عرض QR modal uses.

  // If the backend returns SVG markup:
  return { kind: 'svg', value: qrSvgFromExistingFlow };

  // OR, if it returns a data URL:
  // return { kind: 'data-url', value: qrDataUrlFromExistingFlow };

  // OR, if it returns a directly renderable image URL:
  // return { kind: 'url', value: qrImageUrlFromExistingFlow };
};
```

Do not generate a different QR payload. The backend/current QR flow remains the source of truth.

6. Render the modal once near the end of the page component (inside the component return, not inside the button):

```tsx
<StudentCardPrintModal
  open={isCardPrintOpen}
  onClose={() => setIsCardPrintOpen(false)}
  identity={{
    name: student.name, // map to the actual full-name field used in this page
    code: student.code, // map to the actual ST-.... field used in this page
  }}
  loadQr={loadStudentCardQr}
/>
```

Use the page's real existing student field names. Do not alter the API DTO merely to match this snippet.

If the app already stores the display name via a formatter, reuse the same formatter so the printed name exactly matches the profile header.

## QR adapter rules

- Backend returns raw `<svg ...>` text → `kind: 'svg'`.
- Backend returns `data:image/...` → `kind: 'data-url'`.
- Backend returns a same-origin/CORS-enabled image URL → `kind: 'url'`.
- If the current QR flow returns an object wrapper, unwrap only the image/SVG field.
- Do not use a screenshot of the QR modal.
- Do not introduce a new backend endpoint unless the existing QR flow is genuinely unusable.

## Figma source

File: `b3Yqgen9ItzZY8RbnIDIU2` (`Sanade-UAE`)

- Section: `10334:27443`
- Front: `10332:27408`
- Back: `10332:27390`

Reference card coordinate system is 100 × 40. This implementation prints each face at **100mm × 40mm**, preserving the Figma 5:2 ratio.
Figma colors used: primary `#0B2C5C`, white `#FFFFFF`, gray `#717784`.

The decorative Figma background is reproduced locally with CSS gradients so the committed feature has no expiring Figma asset URLs. Do not replace it with temporary `figma.com/api/mcp/asset/...` URLs.

## PDF behavior

`pdf.ts` captures both faces at 3× pixel ratio, creates one A4 portrait PDF, centers each 100mm × 40mm card horizontally and places the back below the front. The modal previews the actual generated blob PDF, not a fake HTML-only preview.

## Required verification before finishing

Run from repo root:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

If the project has targeted web commands, also run the closest student-profile/component test. Fix only failures caused by this feature. Do not refactor unrelated areas.

Manual smoke test:

1. Open a real student profile.
2. Click `طباعة الكارت`.
3. Confirm the modal opens and the PDF preview finishes loading.
4. Confirm page 1 contains the front and back under each other.
5. Confirm printed name/code match the profile.
6. Scan the QR from the generated PDF and verify it matches the current `عرض QR` behavior.
7. Click `تحميل PDF` and confirm a single PDF downloads.
8. Click `طباعة` and confirm the browser print dialog opens for the PDF only.
9. Close and reopen the modal for a second student; confirm no stale student or QR data remains.

## Scope guard

Do not change backend/database/auth/permissions/routing. Do not remove or change the existing `عرض QR` modal. Do not rewrite `StudentProfilePage`; make the smallest integration patch around the existing print button and QR loader.
