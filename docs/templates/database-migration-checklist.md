# Database Migration Review Checklist

This checklist is not permission to modify the retained/production database. Obtain separate explicit approval.

- [ ] Requirement and ADR linked.
- [ ] Current schema/constraints/policies captured read-only.
- [ ] Exact migration diff reviewed; no accidental reset/seed/drop/truncate/delete.
- [ ] Affected data, compatibility and lock/downtime impact documented.
- [ ] Backup/restore owner and verification documented.
- [ ] Upgrade/rollback tested on isolated disposable DB.
- [ ] Data-preserving pre/post assertions defined.
- [ ] Least-privilege app DB permissions preserved.
- [ ] Isolated test evidence linked; no test used retained DB for writes.
- [ ] Independent reviewer and authorized approver recorded.
- [ ] Runbook updated.
- [ ] Explicit go/no-go approval recorded immediately before execution.
