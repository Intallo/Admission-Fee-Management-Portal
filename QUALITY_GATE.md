# Quality Gate Checklist

## Per-task gate
- [ ] Task dependencies and source requirement read.
- [ ] Implementation limited to accepted scope; open business policy not guessed.
- [ ] Acceptance criteria have pass/fail evidence.
- [ ] Relevant unit/integration/E2E tests executed; results recorded.
- [ ] Role and sensitive-field tests cover allowed and denied paths.
- [ ] Data/year/transaction invariants verified where applicable.
- [ ] No secret, real student/parent/payment data or dump in repo/evidence.
- [ ] Database impact is accurately declared; retained DB unchanged unless separately approved.
- [ ] Docs and known gaps updated.
- [ ] PR/artifact submitted and independently reviewed.

## Milestone gate
- Evidence links from all required tasks.
- Required architecture/business decisions are accepted.
- Exit criteria demonstrated, not assumed.
- No unapproved database operation.
- Status changes to Accepted only after reviewer/Client authority approves.

## Release gate
- All signed requirements trace to acceptance evidence.
- Admission-before-payment, precise money, shared unique receipt sequence, final receipt gating and annual certificate status separation verified.
- Critical authorization/privacy/data-integrity findings resolved or formally accepted by an authorized Client.
- Setup tested on a clean machine.
- Source/handover package delivered and written Client acceptance recorded.
