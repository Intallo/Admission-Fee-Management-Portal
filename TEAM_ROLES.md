# Solo Project Ownership & Delivery Responsibilities

**Project:** School Admission & Fee Management Portal  
**Requirements baseline:** Signed BRD v1.4 and SRS v1.4, approved 22 October 2026  
**Current operating mode:** Single implementer — Shashidhar Pawadashetti  
**Owner contact:** shashipshetti@gmail.com  
**Mode effective:** 27 October 2026

> This file describes delivery ownership, not the application's business roles. Principal, Admission Officer, Accounts Officer and technical System Administrator permissions remain governed by the signed BRD/SRS and accepted business/architecture decisions.

## Current ownership

Shashidhar is the sole active implementation owner for planning, architecture, task execution, UI/API/domain implementation, test automation, integration, documentation, risk tracking, release preparation and handover across every milestone. No other developer is assigned active project work.

Historical commits, pull requests and submission records are retained as project history and must not be misrepresented as current assignments. The Notion Implementation Task Tracker is the source of truth for active task ownership and status. Reviewer is `Unassigned` in solo mode.

## Repository reality and implementation guardrails

The observed `main` branch contains the Supabase/PostgreSQL foundation, SQL migrations/tests, generated TypeScript database types and documentation. The latest observed tree did not show a `package.json` or obvious application entry points, route tree, API runtime or application test runner. Confirm whether app code exists in another branch/repository before scaffolding a runtime.

1. Signed BRD v1.4 and SRS v1.4 remain authoritative. Do not silently invent business rules.
2. Do not select or replace a framework, ORM, provider, API layout or schema before repository evidence and the required ADR/approval gates.
3. Preserve baseline commit `5e1c47e` and the retained database. M0.4 inventory is read-only. No reset, reseed, migration, DDL/DML write, drop, truncate or delete against the retained database without a separate reviewed and explicitly approved change.
4. Use isolated local/test databases and synthetic data for write-oriented tests.
5. Use precise decimal/numeric INR arithmetic, never binary floating-point for money.
6. Enforce authorization and validation server-side. Sensitive student/financial files must not be public by default.
7. Admission must not be gated on payment; Admission Fee is variable; no automatic fee carry-forward; no hard deletes.
8. Issue a final fees receipt only when all applicable fees are fully paid. Include Payer, Cashier and Manager (Principal) signature lines.
9. Annual LC/TC issuance must not itself change the student status to Left/Transferred.

## Solo workflow

- Assign active tasks and milestone leads to Shashidhar.
- Set reviewer to `Unassigned`; do not assign the implementer to act as an independent reviewer.
- Make focused changes and record the branch/PR/commit where applicable.
- Complete a documented self-review against all acceptance criteria; run applicable automated checks and record exact commands/results.
- Use isolated tests for database writes; state database impact accurately.
- Track unresolved choices in the canonical Decision & Risk Register. Client/Principal policy approval remains a separate gate.
- Keep status truthful. `Done` requires complete evidence and required approvals, not merely a commit.
- Never describe self-review as independent peer approval.

## Authority and approval boundaries

- **Client/Principal:** approves unresolved business rules, school policy, required business acceptance and contractual changes.
- **Shashidhar:** owns implementation, technical proposals, integration, testing and documentation. Solo ownership does not authorize unilateral changes to signed business policy or the retained database.
- **External approvals:** any required Client/Principal sign-off remains a separate gate. Self-review and automated checks do not replace it.

## Definition of Done

- Each acceptance criterion has linked evidence.
- Relevant tests/checks have actual pass/fail results.
- Security, privacy, authorization, financial integrity and database safety are addressed for the change.
- Documentation and known limitations are updated.
- Required Client/Principal decisions and sign-offs are recorded.
- No independent reviewer approval is claimed unless it actually occurred.

## Active planning links

- [Implementation Task Tracker](https://app.notion.com/p/31ce328026b74b789079f250f980c2c7)
- [Milestone Tracker](https://app.notion.com/p/1c7e0e446b0e4d2b9689430c5fbd3d8f)
- [Decision & Risk Register](https://app.notion.com/p/8ae373edaca94eecab0c475329710846)
- [Solo workflow and implementation gates](docs/team/WORKFLOW_AND_HANDOFFS.md)

## Historical records

Older submission documents may identify their actual original author/reviewer. Preserve those records for audit/history; they are not active work assignments. Do not edit the signed BRD/SRS.
