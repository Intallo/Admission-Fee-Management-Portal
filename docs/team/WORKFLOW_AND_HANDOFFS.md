# Workflow and Handoffs

## 1. Task lifecycle

`Backlog → Ready → In Progress → In Review → Done`

Use `Blocked` when a dependency, repository access, environment issue, business rule or approval prevents safe progress. Put the specific reason and decision link in the Notion task's Risk / Blocker field. Do not move a task to In Progress merely because it was assigned; verify its dependencies first.

## 2. Before implementation

1. Read the task and relevant signed BRD/SRS story.
2. Check the task's Dependencies and Database Impact.
3. Confirm the source branch/repository and current state.
4. Verify the code path actually exists. The supplied archive currently contains the database foundation, SQL integrity rules, seed/tests and database types, but no visible app manifest/routes/components/API services.
5. If code or a decision is missing, record it and escalate. Don't invent schema/API/framework details.
6. Make sure the local/test database is isolated before running write-oriented tests.

## 3. Git branch and PR

- Create a focused task branch from the team-approved baseline; put task code in the branch/PR title where practical.
- Make small commits that can be reviewed independently.
- Run only checks safe for the intended environment. Inspect scripts before execution.
- Provide a PR description with purpose, requirements, changes, tests, data impact, risk, screenshots and rollback notes if relevant.
- Request review from a teammate who did not author the change.
- Merge only according to repository policy after approval and required checks pass.

## 4. Cross-team handoff contracts

### Ujwal → Sujal

Provide approved field names, required/optional status, validation rules, application state transitions, document requirements and authorization-visible states. Flag open client decisions. Sujal should not invent fields or statuses from a mockup.

### Sujal → Ujwal

Provide UI behavior, accessible error handling, screenshots with synthetic data, form interaction details and any UX assumptions requiring client confirmation. Ensure disabled/hidden UI states are consistent with the domain rules but never replace server authorization.

### Ujwal → Jeevan

Provide canonical student, academic-year and student-academic-record identifiers; clarify which status/transition is authoritative. Do not let annual certificate creation silently set student status or copy balances across years.

### Jeevan → Sujal

Provide fee/payment response shapes, decimal amount examples, per-head and net balances, receipt eligibility conditions, receipt numbering results and approved print fields. Include partial/full payment and error examples. Do not create official values solely in the browser.

### Jeevan → Ujwal

Agree fee assignment and year scoping, receipt/certificate references and how a certificate relates to student-year records. Keep payment history immutable and financial policy explicit.

### Feature owners → Shashidhar

Before integration, share contract/PR and evidence. Shashidhar coordinates route/API ownership, authorization requirements, configuration, audit events, error conventions and release gate. Changes across modules must be discussed before merging when they alter a shared contract.

## 5. Escalation rules

Set a task to Blocked and record a question instead of guessing when:
- signed requirements and current code conflict;
- a role/permission is unclear;
- a policy remains marked working/open in SRS v1.4;
- a migration/schema change appears necessary;
- the task depends on a package/runtime/source directory absent from the supplied archive;
- the available credentials point at a shared/production database rather than an isolated local test DB.

The Principal/client confirms business policy; technical architecture decisions follow ADR review; data changes follow a separately approved migration task.
