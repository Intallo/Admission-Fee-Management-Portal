# Team Roles Documentation Overlay

This is a **documentation-only overlay** for the School Admission & Fee Management Portal repository. It adds team responsibility files without replacing any application, SQL, config or requirements file.

## Files

- `TEAM_ROLES.md` — project-wide responsibilities and current ownership summary.
- `docs/team/README.md` — index for the team folder.
- `docs/team/SHASHIDHAR_PROJECT_LEAD.md`
- `docs/team/UJWAL_ADMISSIONS_STUDENT_RECORDS.md`
- `docs/team/SUJAL_FRONTEND_UX_QUALITY.md`
- `docs/team/JEEVAN_FEES_LEDGER.md`
- `docs/team/TASK_OWNERSHIP_MATRIX.md`
- `docs/team/WORKFLOW_AND_HANDOFFS.md`
- `docs/team/REVIEW_AND_SUBMISSION_POLICY.md`
- `docs/team/TEAM_ONBOARDING_CHECKLIST.md`

## Install into the repository

From the repository root, merge the files from this archive into the same relative paths. Review the diff, then commit the documentation overlay on a task-specific branch. This archive is intended to be safe to overlay because it contains only the new Markdown files.

## Repository inspection note

These role documents were tailored after inspecting the supplied `Admission-Fee-Management-Portal.zip`. The current working tree visibly contains a Supabase/PostgreSQL foundation (migrations, seed, SQL tests) and generated TypeScript database types, but no visible `package.json`, frontend route/component tree, API/service modules or app test runner. Confirm whether the app implementation lives in a different branch/repository before assigning framework-specific code tasks.

## Security note

The uploaded source archive contained local `.env` and Supabase CLI temporary/configuration artifacts. They were intentionally excluded from this overlay. Do not redistribute the original archive or commit those files. If any real credentials were included, treat them as exposed and rotate/revoke them; keep secrets in a trusted local/server environment. The service-role key must never be exposed to browser code.
