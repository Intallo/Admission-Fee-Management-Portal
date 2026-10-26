# Sujal — Frontend, UI/UX & Quality Owner

**Email:** sujalv641@gmail.com  
**Team role:** Frontend/UI architecture, accessible form experience, navigation, print UX, test harness coordination, E2E and accessibility quality.  
**Primary Notion work:** M1.2, M2.3–M2.4, M4.1, M6.2, M6.4, M7.1 and M7.4 (respect dependencies/status; start implementation only after the architecture gate).

## Mission

Make the portal clear and reliable for school office staff using desktop Chrome, while making the interface reflect server-enforced permissions and approved domain workflows. A good-looking screen must not mask missing backend validation or authorization.

## Responsibilities now — source and design audit

- Confirm the actual app source location, framework, package manager, UI entry point, route structure and test tooling with Shashidhar before planning framework-specific work.
- The supplied archive contains no visible `package.json`, app route tree, UI components or app test runner. The current baseline therefore does not establish a working frontend implementation; record this as a repository completeness finding instead of fabricating existing paths.
- Review `UI_UX.md`, `WEB_UX.md`, `DESIGN_SYSTEM.md` and relevant SRS acceptance criteria; list required screens, shared controls, validation states and print needs.
- Contribute to M1.2 by mapping domain boundaries to frontend feature boundaries only after M1.1 ADR acceptance.

## Responsibilities after approval

- Build a consistent desktop-first layout, navigation and shared form primitives using the approved stack and existing dependencies.
- Implement admission forms with accessible labels, validation summaries, clear errors, save/loading states and server-error handling.
- Present status, academic year, fees/balances and document states accurately; do not infer business state only in the browser.
- Enforce visual role-based visibility as usability support while relying on server-side authorization for actual data protection.
- Build print/download affordances and regression checks for server-generated receipt, statement and LC/TC PDFs. Official values must come from authorized server data, not be assembled as authoritative values in the browser.
- Establish isolated unit/component/E2E tests; add critical flows covering admission before payment, authorization denial, partial-payment receipt blocking, full-payment final receipt and annual certificate handling.
- Review keyboard accessibility, focus indicators, semantic form structure, screen-size behavior, long text, loading/empty/error/permission-denied states and print clipping.

## Deliverables

- UI navigation/screen map and accessible component inventory.
- Approved design tokens and usage examples, without inventing an unapproved client brand identity.
- Admission forms and validation UX with screenshots/test evidence.
- PDF/print regression corpus using clearly synthetic sample data.
- E2E tests and CI evidence for critical workflows.
- Accessibility/privacy review report and tracked defects.

## Explicit non-responsibilities

- Do not choose a new frontend framework or CSS component library before the ADR gate.
- Do not implement hidden or visible features outside signed scope (parent/student portal, attendance, exams, timetable, messaging or online payments).
- Do not treat hidden menus as the security boundary; every protected API/file action requires server authorization.
- Do not upload real student or receipt records in screenshots; use fake/masked data.
- Do not approve your own PR.

## Handoffs

- **With Ujwal:** form field labels, validation behavior, admission states, document checklist and LC/TC fields.
- **With Jeevan:** receipt/statement display values, balance states, PDF template requirements and print test cases.
- **With Shashidhar:** route/API contract, permission matrix, app shell and test/CI conventions.

## Ready-to-submit checklist

- [ ] UI matches approved acceptance criteria and uses the accepted stack.
- [ ] Forms have labels, useful error messages and keyboard support.
- [ ] Loading, empty, failed and denied states are present where needed.
- [ ] Sensitive data isn't exposed by UI payloads or screenshots.
- [ ] PDF/print checks use synthetic samples and server-generated values.
- [ ] Tests, screenshots, PR/evidence links and known gaps are documented.
