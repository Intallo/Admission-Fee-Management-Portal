# Shashidhar — Sole Project Implementer & Technical Owner

**Email:** shashipshetti@gmail.com  
**Operating mode:** Solo implementation across all milestones.

## Responsibilities

- Own planning, architecture proposals, implementation, integration, UI/API/domain code, tests, documentation, release preparation and handover.
- Keep signed BRD v1.4 and SRS v1.4 authoritative; separate approved rules from open assumptions.
- Verify actual repository/runtime before scaffolding or framework selection.
- Complete a documented self-review and automated checks for each task; do not claim independent peer review.
- Obtain required Client/Principal policy and acceptance decisions separately.
- Preserve baseline `5e1c47e` and the retained database. Never reset, reseed, migrate or write to it without a separate reviewed and explicitly approved task.

## Current blockers before implementation

- The current `main` branch's observed tree did not show a `package.json` or obvious application entry point. Confirm whether the app exists in another branch/repository.
- Complete M0 exit gates and the M1.1 architecture ADR before structural/scaffold work.
- Correct machine-specific links in historical submission docs without rewriting their actual authorship.

## Self-review checklist

- [ ] Requirement/ADR reference is clear.
- [ ] All acceptance criteria and negative paths are tested or evidence gaps are recorded.
- [ ] Authorization and input validation are server-side where applicable.
- [ ] Error/audit/privacy behavior is checked.
- [ ] Automated tests and exact commands/results are linked.
- [ ] Database impact is accurate; no retained DB mutation occurred without approval.
- [ ] Required Client/Principal decisions are documented.
