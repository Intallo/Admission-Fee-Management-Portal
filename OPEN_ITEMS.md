# Open Client Decisions and Dependencies

> [!IMPORTANT]
> **Canonical Single Register:** Per Milestone M0.5, all 20 open items, business rules, technical dependencies, security risks, and delivery assumptions are consolidated in the canonical register:
> 👉 **[`docs/DECISION_AND_RISK_REGISTER.md`](docs/DECISION_AND_RISK_REGISTER.md)**.
> All items below are mapped to their canonical register ID (`REG-XX`), owner, target milestone, and next action.

| # | Open Item Description | Canonical Register ID | Affected Scope | Target Milestone | Accountable Owner |
|---:|---|:---:|---|:---:|:---:|
| 1 | Other receipt/form types besides admission, fees, books and vehicle | **REG-08** | Fee config, receipt layouts | M5.1 | Shashidhar |
| 2 | Who "admin" is for fee heads/places/amounts (ACC drafts, Principal approves) | **REG-05** | Roles, fee configuration | M5.1 | Shashidhar |
| 3 | Whether books/uniform are compulsory and fixed per standard | **REG-07** | Fee structure / generation | M5.1 | Shashidhar |
| 4 | Vehicle "Place" meaning and tariff by place only or place+standard | **REG-06** | Vehicle fee calculation | M5.1 | Shashidhar |
| 5 | How a previously approved student who never joins releases a seat | **REG-10** | Status / seat capacity | M4.2 | Shashidhar |
| 6 | Admission Fee refund policy; correction/reversal details | **REG-04** | Financial policy | M5.4 | Shashidhar |
| 7 | Scope of 100-seat limit (per section, per grade, or across group) | **REG-02** | Seat-limit enforcement | M4.2 | Shashidhar |
| 8 | Whether TC can be issued with unpaid dues (Principal override) | **REG-03** | TC approval workflow | M6.3 | Shashidhar |
| 9 | Separate caste/category field and where sensitive details are collected | **REG-11** | Admission form / privacy | M4.1 | Shashidhar |
| 10 | Minimum age per class; advisory calculated, blocking disabled | **REG-12** | Form validation | M4.1 | Shashidhar |
| 11 | Final application statuses & transition alignment | **REG-13** | Admission lifecycle | M4.2 | Shashidhar |
| 12 | Approved TC format, numbering/duplicate requirements and fields | **REG-14** | LC/TC PDF generation | M6.3 | Shashidhar |
| 13 | High-resolution letterhead, full-page receipt samples, print details | **REG-15** | Official layouts / PDF | M6.2 | Shashidhar |
| 14 | Mandatory/optional document checklist per section | **REG-16** | Document management | M4.3 | Shashidhar |
| 15 | Initial admin bootstrap / forced password change & SYSADMIN role | **REG-17** | Authentication / RBAC | M3.2 | Shashidhar |
| 16 | Audit/file retention duration if not specified in signed terms | **REG-18** | Retention policy | M3.5 | Shashidhar |
| — | Principal vs. System Administrator Role Authority Ambiguity | **REG-01** | Role Matrix / Governance | M0 Exit / M3.1 | Shashidhar |
| — | Application Source Tree & Package Manifest Location | **REG-19** | Architecture / Scaffolding | M0 Exit / M1.1 | Shashidhar |
| — | Row-Level Security vs. Server-Side Mediation Architecture | **REG-20** | Architecture / Security | M0 Exit / M1.1 | Shashidhar |

## Closure Process
Every item requires written confirmation from the designated Approver (Client Rakesh Aralikatti or Principal for business rules; Architecture Lead Shashidhar for technical contracts). When an answer is received:
1. Update `docs/DECISION_AND_RISK_REGISTER.md` with approval evidence and date.
2. Update affected user stories in `docs/features/` and traceability in `TRACEABILITY.md`.
3. Unlock downstream tasks in the task ownership matrix.
