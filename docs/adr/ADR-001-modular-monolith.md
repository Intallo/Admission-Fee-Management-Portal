# ADR-001: Target module and deployment architecture

- **Status:** Proposed / Pending repository audit and review
- **Date opened:** 2026-10-26
- **Owner:** Shashidhar
- **Approvers:** Architecture review; Client/Principal for business/operational policy
- **Dependencies:** M0.1, M0.2, M0.4, M0.5

## Context
The signed product needs sensitive-data protection, append-only financial history, annual scope, official PDFs and source-only handover. CampusHR is an organizational reference, but file-level comparison could not be verified because connected GitHub returned 404. Current stack and entry points must be documented before choosing structure.

## Decision to evaluate
Prefer a modular monolith with feature-based UI areas, one defined server/API path, domain services and adapters for current persistence/file storage only if the actual repository supports this with less risk than alternatives.

## Options
1. Preserve existing organization and strengthen domain/service boundaries incrementally.
2. Refactor incrementally to explicit modules while keeping current runtime/framework/ORM/provider/schema.
3. Replace framework/provider/schema or split services immediately.

## Criteria
Fit with current repo; source-only handover; data-preservation/migration risk; authorization/privacy; atomic ledger and numbering; audit/PDF; testing; operability; maintainability; cost/schedule.

## Preliminary recommendation
Option 1 or 2 is preferred, selected only after repository evidence. Option 3 is not approved absent a clear reason, migration plan and explicit approval.

## Required evidence before acceptance
- Actual repo tree/runtime/entry points/routing/auth/ORM/database/storage/PDF/scripts/tests.
- CampusHR patterns selected/rejected with file links once repository access is restored.
- Module/dependency diagram.
- At least two viable choices and security/operational trade-offs.
- Schema impact and tested rollback; statement retained DB unchanged during audit.
- Named reviewer approval. Keep status proposed until confirmed.
