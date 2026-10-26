# Team Onboarding Checklist

## Access and setup (each contributor)

- [ ] Accept invitation to the correct Notion workspace and confirm access to Project Hub, Implementation Task Tracker, Milestone Tracker and Decision & Risk Register.
- [ ] Confirm repository URL, branch policy and access. The supplied archive's working tree does not show app code/package manifest; verify whether the intended application branch/repository is separate.
- [ ] Read signed `docs/requirements/School_Admission_Portal_BRD_v1.4.md` and `SRS_v1.4.md`.
- [ ] Read `README.md`, `DATABASE.md`, `CONTRIBUTING.md`, `QUALITY_GATE.md`, and this responsibility folder.
- [ ] Confirm the project baseline and working-tree status before modifying anything.
- [ ] Verify local tooling versions using non-destructive commands; do not print or share secret values.
- [ ] Ensure `.env`, `.env.local`, `supabase/.temp/`, `supabase/.branches/`, service-role secrets, database passwords and real student data are excluded from all archives/commits.
- [ ] Use synthetic fixtures for any demo or test.

## Person-specific first steps

### Shashidhar
- [ ] Verify repository HEAD/status/baseline and capture evidence.
- [ ] Start the signed BRD/SRS traceability matrix.
- [ ] Coordinate the read-only M0.4 review and architecture ADR inputs.
- [ ] Keep role-authority and technical stack decisions visible as explicit gates.

### Ujwal
- [ ] Inventory schema metadata, relationships, RLS and migration history using read-only inspection.
- [ ] Record existing-vs-proposed schema facts without exposing personal rows.
- [ ] Map admission/student/academic-year fields and open status/seat policy questions.

### Sujal
- [ ] Confirm the source branch contains actual UI/app files or record that they are absent from the supplied archive.
- [ ] Audit existing routes/components/test tooling only after repository access is confirmed.
- [ ] Map required screens, form validation states, accessibility behavior and print scenarios from signed SRS.
- [ ] Wait for M1.1/M1.2 approval before implementing a new framework or reorganizing structure.

### Jeevan
- [ ] Read the SQL integrity migrations and describe current payment/receipt/adjustment invariants.
- [ ] Inspect verification/integrity test design and identify additional isolated test cases.
- [ ] List fee policy decisions that need Principal/client approval before M5 implementation.
- [ ] Do not run write-oriented tests against the retained/shared database.

## Completion of onboarding

Each person posts a short confirmation to the project lead stating: repository/Notion access is working, the applicable role document is read, the first assigned task is understood, and any missing access/files/decisions are identified. Never include credentials in that confirmation.
