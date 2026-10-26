# Performance and Scale Verification

## SRS target
Common screens load in under 3 seconds with 2,000 students per academic year and 10 years of data in the demo environment. Production performance depends on the Client-selected hosting.

## Benchmark plan
1. Define a reproducible synthetic dataset with 2,000 students per year and ten years of history.
2. Record environment/runtime version, database configuration, machine and test browser.
3. Measure login/year selection, application list/filter, student search/profile, dues list, fee history and dashboard.
4. Run representative query/UX tests with warm and cold cache where relevant; document methodology.
5. Optimize only after measurement; protect year-scope and authorization.
6. Rerun business-rule and privacy tests after query/index changes.

## Guardrails
- Use synthetic data only; never benchmark with live personal information.
- Query/search/export must filter by authorized user and academic year.
- Index proposals come from query plans and M0.4 inventory; do not alter retained schema without separate approval.
- No performance test may run destructive cleanup on retained or production DB.
