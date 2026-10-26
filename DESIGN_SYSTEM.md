# Design System

**Status: proposal.** Signed requirements do not specify an approved logo, brand palette or proprietary font. The Client-approved forms and letterhead govern official document design; do not label invented branding as approved.

## Principles
Operational clarity, consistency, visible academic-year/status context, privacy by default, paper fidelity where required, accessibility and explicit feedback for consequential actions.

## Initial semantic tokens (proposed)
```css
:root {
  --color-text: #17212f;
  --color-text-muted: #526071;
  --color-surface: #ffffff;
  --color-surface-subtle: #f5f7fa;
  --color-border: #d6dde6;
  --color-primary: #244a73;
  --color-primary-hover: #1c3b5c;
  --color-focus: #1368ce;
  --color-success: #216e4e;
  --color-warning: #8a5a00;
  --color-danger: #a4262c;
  --radius-sm: 4px;
  --radius-md: 8px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --content-max: 1440px;
}
```
Use the confirmed UI stack's equivalent. Validate contrast and visible focus. Prefer the system font stack unless repository/client assets dictate otherwise.

## Components
App shell/header with selected year; role-filtered navigation; page title/action row; text/select/date/currency/file/textarea controls; field errors and error summary; search/filter/table/status label; loading/empty/error/permission-denied states; approval/reversal confirmation; document list/version history; audit/status timeline; receipt/statement/certificate preview/download/reprint.

## Input behavior
- Mark required fields and clearly identify optional fields.
- Currency uses exact INR two-decimal precision and agrees with server amounts.
- Dates are consistently formatted and validated against year rules when required.
- File picker communicates accepted types and size limit per the SRS working assumption (PDF/JPG/PNG, up to 5MB); section-specific required-document rules remain open.
- Sensitive fields only exist in permitted server response/UI; CSS masking is not an authorization boundary.

## Feedback/status
Show text and color for statuses; visible loading; disable duplicate submit while pending; report saved success only after server confirmation; plain-English recoverable errors, with technical errors in protected logs.

## Official documents
Official values are server-generated from authorized data. Use client-approved letterhead, receipt layout, dimensions, signatory labels and TC template. Test variable line counts, long names, page breaks, amount in words, signature areas and duplicate labels using synthetic fixtures.
