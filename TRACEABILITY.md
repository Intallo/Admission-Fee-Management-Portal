# Requirements Traceability Matrix (RTM)

**Task:** M0.2 — BRD & SRS v1.4 Requirements Traceability  
**Task Owner:** Shashidhar (Project Lead & Architecture Owner)  
**Review Mode:** Solo implementation; no independent peer reviewer is assigned.
**Authoritative Baselines:** Signed BRD v1.4 and Signed SRS v1.4 (Approved 22 October 2026)  
**Database Impact:** Read-only (no database writes or schema changes performed)  
**Status:** In Review (Revised per review findings)  

---

## 1. Document Overview & Working Practice

This traceability matrix maps every requirement, role constraint, business invariant, non-functional specification, report, and explicit scope exclusion from the authoritative signed documents ([BRD v1.4](docs/requirements/School_Admission_Portal_BRD_v1.4.md) and [SRS v1.4](docs/requirements/School_Admission_Portal_SRS_v1.4.md)) to the modular architecture ([FILE_STRUCTURE.md](FILE_STRUCTURE.md)) and the implementation milestone plan ([docs/team/TASK_OWNERSHIP_MATRIX.md](docs/team/TASK_OWNERSHIP_MATRIX.md)).

### Status Legend
- **Confirmed**: Firm requirement fully specified in signed BRD v1.4 / SRS v1.4; ready for implementation without additional policy decisions.
- **Needs Clarification**: Requirement identified with pending client decision or open working assumption (cross-referenced to [OPEN_ITEMS.md](OPEN_ITEMS.md)).
- **Out of Scope**: Explicitly excluded capability from the signed contract; must not be implemented.

---

## 2. Functional Requirements & Delivery Stories Matrix

All 47 BRD requirements (`BR-01..47`) map to active SRS user stories. Project-team delivery stories (`US-04`, `US-39`, `US-40`, `US-41`) defined in SRS §5 Module 10 and §10 are explicitly mapped to their handover, dashboard, and verification tasks. Detailed individual acceptance criteria are maintained in [`docs/features/`](docs/features/).

| Requirement ID | SRS Story ID | Requirement Summary | Source Section | Target Module | Milestone | Status |
|---|---|---|---|---|---|---|
| **BR-01** | US-01, US-04 | User authentication, login failure lockout (5 attempts / 15 min), account deactivation, password reset | BRD §5.1, SRS §5 Mod 1 | `identity-access` | M3.1, M3.2 | Confirmed |
| **BR-02** | US-05, US-06 | Academic year creation, activation, closure; annual data isolation; no overlapping ranges | BRD §5.2, SRS §5 Mod 2 | `academic-years` | M3.4 | Confirmed |
| **BR-03** | US-02 | Role-based menu navigation and view rendering | BRD §5.1, SRS §5 Mod 1 | `identity-access`, `shared` | M2.4, M3.1 | Confirmed |
| **BR-04** | US-03 | Sensitive student/parent personal data protection and role-filtered display | BRD §4, SRS §5 Mod 1 | `identity-access` | M3.1, M4.5 | Confirmed |
| **BR-05** | US-07, US-08 | Student admission intake: name, standard, auto-generated application number on first save | BRD §5.3, SRS §5 Mod 3 | `admissions` | M4.1 | Confirmed |
| **BR-06** | US-09 | Parent and guardian contact, occupation, and address details entry | BRD §5.3, SRS §5 Mod 3 | `admissions` | M4.1 | Confirmed |
| **BR-07** | US-10 | Student admission document checklist and private file upload | BRD §5.3, SRS §5 Mod 3 | `documents`, `admissions` | M4.3 | Needs Clarification (Open Item #14) |
| **BR-08** | US-11, US-16 | Track missing documents and display verification status indicators | BRD §5.3, SRS §5 Mod 3 | `admissions` | M4.1, M4.2 | Confirmed |
| **BR-09** | US-07, US-12 | Save and resume admission drafts; editable before formal submission | BRD §5.3, SRS §5 Mod 3 | `admissions` | M4.1 | Confirmed |
| **BR-10** | US-13, US-14 | Submit application for verification; Principal review and decision workflow | BRD §5.3, SRS §5 Mod 3 | `admissions` | M4.2 | Confirmed |
| **BR-11** | US-14, US-16, US-38 | Application status tracking (Draft, Submitted, Approved, Rejected, On Hold) and audit log | BRD §5.3, SRS §5 Mod 3 | `admissions`, `audit-reporting` | M4.2, M3.5 | Confirmed |
| **BR-12** | US-15 | Admission approval: status update, admission number assignment, fee generation trigger | BRD §5.3, SRS §5 Mod 3 | `admissions`, `fees-ledger` | M4.2, M5.1 | Confirmed |
| **BR-13** | US-18 | Yearly fee structure setup per standard with component amounts and optional heads | BRD §5.4, SRS §5 Mod 4 | `fee-configuration` | M5.1 | Confirmed |
| **BR-14** | US-17, US-18, US-20 | Receipt types and fee heads management (Fixed vs Variable heads) | BRD §5.4, SRS §5 Mod 4 | `fee-configuration` | M5.1 | Needs Clarification (Open Item #1, #2) |
| **BR-15** | US-19, US-20 | Vehicle transport places and distance-based yearly tariffs management | BRD §5.4, SRS §5 Mod 4 | `fee-configuration` | M5.1 | Needs Clarification (Open Item #4) |
| **BR-16** | US-20 | Comprehensive student fee breakdown display (billed, paid, concessions, balances) | BRD §5.5, SRS §5 Mod 5 | `fees-ledger` | M5.3 | Confirmed |
| **BR-17** | US-21, US-22 | Record offline fee payments allocated across specific fee heads within one receipt type | BRD §5.5, SRS §5 Mod 5 | `fees-ledger` | M5.3 | Confirmed |
| **BR-18** | US-21, US-25 | Immutable payment recording; full chronological payment history per student | BRD §5.5, SRS §5 Mod 5 | `fees-ledger` | M5.3 | Confirmed |
| **BR-19** | US-21, US-23, US-24 | Real-time balance and dues calculation; outstanding dues report by class/section | BRD §5.5, SRS §5 Mod 5 | `fees-ledger` | M5.3, M5.5 | Confirmed |
| **BR-20** | US-23 | Head-level and student-level fee status derivation (Paid, Partial, Unpaid) | BRD §5.5, SRS §5 Mod 5 | `fees-ledger` | M5.3 | Confirmed |
| **BR-21** | US-26 | Concession and negotiated fee discount recording (Principal approval required) | BRD §5.6, SRS §5 Mod 6 | `fees-ledger` | M5.4 | Confirmed |
| **BR-22** | US-26A | Refund and payment correction flow via approved reversal adjustment; no physical delete | BRD §5.6, SRS §5 Mod 6 | `fees-ledger` | M5.4 | Needs Clarification (Open Item #6) |
| **BR-23** | US-26, US-26A | Linked audit trail for all financial adjustments, concessions, and reversals | BRD §5.6, SRS §5 Mod 6, §10 | `fees-ledger`, `audit-reporting` | M5.4, M3.5 | Confirmed |
| **BR-24** | US-27 | Numbered individual receipt generation per recorded payment transaction | BRD §5.7, SRS §5 Mod 7 | `receipts` | M6.1 | Confirmed |
| **BR-25** | US-28 | Final fees receipt issued ONLY upon 100% full payment across all fee heads | BRD §5.7, SRS §5 Mod 7 | `receipts` | M6.1 | Confirmed |
| **BR-26** | US-27, US-28 | Required receipt elements: amount in words, payer details, Cashier & Principal signatures | BRD §5.7, SRS §5 Mod 7 | `receipts` | M6.1, M6.2 | Confirmed |
| **BR-27** | US-29 | Secure document and receipt reprinting with explicit duplicate watermark and logging | BRD §5.7, SRS §5 Mod 7 | `receipts` | M6.1 | Confirmed |
| **BR-28** | US-30 | Multi-criteria student search (Name, Admission No, STS No, Standard, Academic Year) | BRD §5.8, SRS §5 Mod 8 | `student-records` | M4.4 | Confirmed |
| **BR-29** | US-31 | Unified student profile view with role-filtered tabs and year history | BRD §5.8, SRS §5 Mod 8 | `student-records` | M4.4 | Confirmed |
| **BR-30** | US-32, US-33 | Student lifecycle status transition (Active to Left / Transferred); no hard deletions | BRD §5.8, SRS §5 Mod 8 | `student-records` | M4.4 | Confirmed |
| **BR-31** | US-38 | System-wide append-only audit log capturing actor, timestamp, action, and changes | BRD §5.10, SRS §5 Mod 10 | `audit-reporting` | M3.5 | Confirmed |
| **BR-32** | US-34 | Pre-populate annual certificate records for admitted students in active year | BRD §5.9, SRS §5 Mod 9 | `certificates-lctc` | M6.3 | Confirmed |
| **BR-33** | US-35 | Two-step LC/TC review (Admission Officer verification followed by Principal approval) | BRD §5.9, SRS §5 Mod 9 | `certificates-lctc` | M6.3 | Needs Clarification (Open Item #8) |
| **BR-34** | US-36 | LC/TC official document generation with unique sequential certificate number | BRD §5.9, SRS §5 Mod 9 | `certificates-lctc` | M6.3 | Needs Clarification (Open Item #12) |
| **BR-35** | US-37 | Retrieve and reprint issued LC/TC with audit log and duplicate tracking | BRD §5.9, SRS §5 Mod 9 | `certificates-lctc` | M6.3 | Confirmed |
| **BR-36** | US-35 | Guardrail: LC/TC issuance does NOT automatically alter active student enrollment status | BRD §5.9, SRS §5 Mod 9 | `certificates-lctc` | M6.3 | Confirmed |
| **BR-37** | US-15, US-21 | Non-negotiable: Admission workflow must NOT require payment as a prerequisite | BRD §5.3, §5.5, SRS §4 | `admissions`, `fees-ledger` | M4.2 | Confirmed |
| **BR-38** | US-14, US-42 | Seat-capacity enforcement blocking application approval beyond defined limits | BRD §5.3, SRS §5 Mod 3 | `admissions` | M4.2 | Needs Clarification (Open Item #7) |
| **BR-39** | US-06, US-20, US-21, US-24 | Non-negotiable: No automatic fee carry-forward between distinct academic years | BRD §5.2, §5.5, SRS §4 | `academic-years`, `fees-ledger` | M3.4, M5.5 | Confirmed |
| **BR-40** | US-26 | Maximum concession cap enforcement: concessions cannot exceed total billed fee | BRD §5.6, SRS §5 Mod 6 | `fees-ledger` | M5.4 | Confirmed |
| **BR-41** | US-17 | Variable Admission Fee: fee head classification allows custom entered fee amount | BRD §5.4, SRS §5 Mod 4 | `fee-configuration`, `fees-ledger` | M5.1 | Confirmed |
| **BR-42** | US-17 | Fixed fee heads cannot be overpaid beyond the approved yearly tariff amount | BRD §5.4, §5.5, SRS §4 | `fees-ledger` | M5.3 | Confirmed |
| **BR-43** | US-21, US-22 | Payment flexibility: payments accepted at any time in any installment amounts | BRD §5.5, SRS §5 Mod 5 | `fees-ledger` | M5.3 | Confirmed |
| **BR-44** | US-18, US-19 | Transport fees configured as optional head tied to student's vehicle place | BRD §5.4, SRS §5 Mod 4 | `fee-configuration` | M5.1 | Confirmed |
| **BR-45** | US-27, US-28 | Unified receipt numbering sequence across all receipt types and final receipt | BRD §5.7, SRS §5 Mod 7 | `receipts` | M6.1 | Confirmed |
| **BR-46** | US-28 | Unnumbered fee statement accessible at any time regardless of dues status | BRD §5.7, SRS §5 Mod 7 | `receipts` | M6.1 | Confirmed |
| **BR-47** | US-27, US-28 | Multi-receipt payment tracking: final receipt references all prior payment receipt IDs | BRD §5.7, SRS §5 Mod 7 | `receipts` | M6.1 | Confirmed |
| **DEL-01** | **US-40** | **Developer handover package**: setup guide, config settings, DB setup, clean-machine verification | SRS §5 Mod 10, §10, §11 | `audit-reporting`, `shared` | M8.1, M8.2 | Confirmed |
| **DEL-02** | **US-41** | **Synthetic demo data**: seed script loading realistic fake data across sections, fees, payments, TC | SRS §5 Mod 10, §10, §11 | `infrastructure`, `shared` | M0.4, M2.3, M8.2 | Confirmed |
| **DEL-03** | **US-39** | **Basic operational dashboard**: high-level student counts, seat capacity, fee totals, list alignment | SRS §5 Mod 10, §10 | `audit-reporting` | M3.5 | Confirmed |
| **DEL-04** | **US-04** | **User account management**: admin create/deactivate staff accounts, password resets, role changes | SRS §5 Mod 1, §10 | `identity-access` | M3.1, M3.3 | Confirmed |
| **WTH-01** | **US-43** | **Withdrawn story**: automatic year-end fee closure / balance sweep | SRS §5 Mod 10, §10 | N/A | None | **Out of Scope** (Withdrawn) |

---

## 3. Complete User Story Coverage Verification (43 Active Stories + 1 Withdrawn)

The table below demonstrates 100% complete story-level coverage across all 43 active user stories and 1 explicitly withdrawn story.

| Story ID | User Story Title | Priority | Primary BRD / Delivery Mapping | Target Module | Assigned Milestone | Status |
|---|---|---|---|---|---|---|
| **US-01** | Login with individual credentials | P1 | BR-01 | `identity-access` | M3.2 | Confirmed |
| **US-02** | Role-based menu navigation and views | P1 | BR-03 | `identity-access`, `shared` | M2.4, M3.1 | Confirmed |
| **US-03** | Sensitive student/parent data protection | P1 | BR-04 | `identity-access` | M3.1, M4.5 | Confirmed |
| **US-04** | User account management & deactivation | P2 | Delivery / BR-01 | `identity-access` | M3.1, M3.3 | Confirmed |
| **US-05** | Select active academic year | P1 | BR-02 | `academic-years` | M3.4 | Confirmed |
| **US-06** | Manage academic years & annual boundaries | P2 | BR-02, BR-39 | `academic-years` | M3.4 | Confirmed |
| **US-07** | Create admission application draft | P1 | BR-05, BR-09 | `admissions` | M4.1 | Confirmed |
| **US-08** | Enter student personal & academic details | P1 | BR-05 | `admissions` | M4.1 | Confirmed |
| **US-09** | Enter parent & guardian details | P1 | BR-06 | `admissions` | M4.1 | Confirmed |
| **US-10** | Upload admission document checklist files | P1 | BR-07 | `documents`, `admissions` | M4.3 | Needs Clarification |
| **US-11** | Track missing documents & completeness | P2 | BR-08 | `admissions` | M4.1, M4.2 | Confirmed |
| **US-12** | Save & edit application draft | P1 | BR-09 | `admissions` | M4.1 | Confirmed |
| **US-13** | Submit application for verification | P1 | BR-10 | `admissions` | M4.2 | Confirmed |
| **US-14** | Principal review and admission decision | P1 | BR-10, BR-11, BR-38 | `admissions` | M4.2 | Confirmed |
| **US-15** | Admission approval & fee record generation | P1 | BR-12, BR-37 | `admissions`, `fees-ledger` | M4.2, M5.1 | Confirmed |
| **US-16** | Application list and status tracking | P2 | BR-08, BR-11 | `admissions` | M4.2 | Confirmed |
| **US-17** | Manage receipt types & fee heads | P1 | BR-14, BR-41, BR-42 | `fee-configuration` | M5.1 | Needs Clarification |
| **US-18** | Set yearly fee structure per standard | P1 | BR-13, BR-14, BR-44 | `fee-configuration` | M5.1 | Confirmed |
| **US-19** | Manage vehicle transport places & tariffs | P2 | BR-15, BR-44 | `fee-configuration` | M5.1 | Needs Clarification |
| **US-20** | View student fee breakdown & status | P1 | BR-14, BR-15, BR-16, BR-39 | `fees-ledger` | M5.3 | Confirmed |
| **US-21** | Record offline payment across fee heads | P1 | BR-17, BR-18, BR-19, BR-37, BR-39, BR-43 | `fees-ledger` | M5.3 | Confirmed |
| **US-22** | Record later installments & partial payments | P1 | BR-17, BR-43 | `fees-ledger` | M5.3 | Confirmed |
| **US-23** | Real-time fee status & balance display | P1 | BR-19, BR-20 | `fees-ledger` | M5.3 | Confirmed |
| **US-24** | Outstanding dues list by standard/section | P2 | BR-19, BR-39 | `fees-ledger` | M5.5 | Confirmed |
| **US-25** | Payment history audit per student | P1 | BR-18 | `fees-ledger` | M5.3 | Confirmed |
| **US-26** | Concession, negotiated fee, or extra charge | P2 | BR-21, BR-23, BR-40 | `fees-ledger` | M5.4 | Confirmed |
| **US-26A**| Refund or payment correction via reversal | P2 | BR-22, BR-23 | `fees-ledger` | M5.4 | Needs Clarification |
| **US-27** | Generate receipt for recorded payment | P1 | BR-24, BR-26, BR-45, BR-47 | `receipts` | M6.1 | Confirmed |
| **US-28** | Final fees receipt & printable fee statement | P1 | BR-25, BR-26, BR-45, BR-46, BR-47 | `receipts` | M6.1, M6.2 | Confirmed |
| **US-29** | Reprint receipts/documents with duplicate mark | P2 | BR-27 | `receipts` | M6.1 | Confirmed |
| **US-30** | Multi-criteria student search | P1 | BR-28 | `student-records` | M4.4 | Confirmed |
| **US-31** | Comprehensive student profile & history | P1 | BR-29 | `student-records` | M4.4 | Confirmed |
| **US-32** | Mark student as Left / Transferred | P2 | BR-30 | `student-records` | M4.4 | Confirmed |
| **US-33** | Immutable records & non-deletion guarantee | P1 | BR-30 | `student-records`, `infrastructure` | M4.4 | Confirmed |
| **US-34** | Create annual certificate records | P1 | BR-32 | `certificates-lctc` | M6.3 | Confirmed |
| **US-35** | Review & approve LC/TC (two-step) | P1 | BR-33, BR-36 | `certificates-lctc` | M6.3 | Needs Clarification |
| **US-36** | Generate official LC/TC document | P1 | BR-34 | `certificates-lctc` | M6.3 | Needs Clarification |
| **US-37** | Retrieve & reprint LC/TC with duplicate log | P2 | BR-35 | `certificates-lctc` | M6.3 | Confirmed |
| **US-38** | System-wide append-only audit log | P1 | BR-11, BR-31 | `audit-reporting` | M3.5 | Confirmed |
| **US-39** | Basic operational dashboard | P2 | Delivery | `audit-reporting` | M3.5 | Confirmed |
| **US-40** | Developer handover package & setup guide | P2 | Delivery | `audit-reporting`, `shared` | M8.1, M8.2 | Confirmed |
| **US-41** | Synthetic demo data seed script | P1 | Delivery | `infrastructure`, `shared` | M0.4, M2.3, M8.2 | Confirmed |
| **US-42** | Seat limits enforcement | P1 | BR-38 | `admissions` | M4.2 | Needs Clarification |
| **US-43** | Automatic year-end fee closure / balance sweep | N/A | Withdrawn | N/A | None | **Out of Scope** (Withdrawn) |

---

## 4. Role Constraints & Authorization Matrix

Server-side enforcement on all endpoints and views; UI component hiding does not substitute for server authorization.

| Role ID | Role Name | System Authority & Access Boundaries | Source Section | Target Module | Milestone | Status |
|---|---|---|---|---|---|---|
| **RC-01** | Principal / Head of School | Final business authority: admission approvals/rejections/holds, fee structures, concessions, adjustments, LC/TC issuance; full profile visibility | BRD §4.1, SRS §2.2 | `identity-access` | M3.1 | Confirmed |
| **RC-02** | Admission Officer (ADM) | Student intake, form drafts, parent info, document upload/checks, first-step LC/TC review; sees sensitive fields allowed by SRS | BRD §4.2, SRS §2.2 | `identity-access`, `admissions` | M3.1 | Confirmed |
| **RC-03** | Accounts Officer (ACC) | Fee collection, offline payment entry, receipts, dues monitoring, adjustment requests; **STRICTLY BLOCKED** from sensitive student personal fields | BRD §4.3, SRS §2.2 | `identity-access`, `fees-ledger` | M3.1 | Confirmed |
| **RC-04** | System Administrator (SYSADMIN) | User lifecycle, role assignment, password resets; zero access to financial ledgers or student personal records | BRD §4.4, SRS §2.2 | `identity-access` | M3.1 | Needs Clarification (Open Item #15) |
| **RC-05** | Sensitive Field Isolation | Server-side redaction/masking for Aadhaar number, parent income, caste/category, and medical flags across API, search, and exports | BRD §4, SRS §2.2, §5 Mod 1 | `identity-access` | M4.5 | Confirmed |

---

## 5. System-Wide Business Invariants

| Invariant ID | Rule Description | Source Section | Target Module | Milestone | Status |
|---|---|---|---|---|---|
| **SBR-01** | **No Payment Prerequisite**: Admission approval and enrollment cannot require or enforce a fee payment or minimum first deposit | BRD §5.3, SRS §4 (Rule 1) | `admissions` | M4.2 | Confirmed |
| **SBR-02** | **Recording Only**: Application records payments offline; it never executes bank transfers or processes electronic funds | BRD §5.5, SRS §4 (Rule 2) | `fees-ledger` | M5.3 | Confirmed |
| **SBR-03** | **Exact Currency Precision**: All currency math uses exact decimal INR (`numeric(12,2)`); IEEE-754 binary floating-point prohibited | BRD §5.5, SRS §4 (Rule 3) | `fees-ledger` | M7.3 | Confirmed |
| **SBR-04** | **Immutable Ledger & No Deletes**: Core student, ledger, receipt, and audit rows cannot be hard-deleted or directly updated post-commit | BRD §5.5, SRS §4 (Rule 4) | `fees-ledger`, `infrastructure` | M5.3, M5.4 | Confirmed |
| **SBR-05** | **Strict Academic Year Scoping**: Records belong to explicit academic years; closed years are locked; no automatic fee carry-forward | BRD §5.2, SRS §4 (Rule 5) | `academic-years` | M3.4 | Confirmed |
| **SBR-06** | **Fixed Head Overpayment Protection**: Billed amounts for fixed heads represent a strict payment ceiling | BRD §5.4, SRS §4 (Rule 6) | `fees-ledger` | M5.3 | Confirmed |
| **SBR-07** | **Final Receipt Gating**: Final fees receipt is issued if and only if outstanding dues across all applicable fee heads equal ₹0.00 | BRD §5.7, SRS §4 (Rule 7) | `receipts` | M6.1 | Confirmed |
| **SBR-08** | **Unified Sequential Receipt Series**: Individual receipts and final receipts pull from one continuous, monotonic sequence per year | BRD §5.7, SRS §4 (Rule 8) | `receipts` | M6.1 | Confirmed |
| **SBR-09** | **Certificate Independence**: Generating an annual LC/TC does not mark a continuing student Left/Transferred in active school records | BRD §5.9, SRS §4 (Rule 9) | `certificates-lctc` | M6.3 | Confirmed |
| **SBR-10** | **Seat Capacity Gate**: When approved admissions reach configured capacity, further approvals are blocked by the system | BRD §5.3, SRS §4 (Rule 10) | `admissions` | M4.2 | Needs Clarification (Open Item #7) |

---

## 6. Non-Functional Requirements (NFR) Matrix

| NFR ID | Category | Requirement Specification | Source Section | Target Module | Milestone | Status |
|---|---|---|---|---|---|---|
| **NFR-01** | Security | Secure password hashing (Argon2id/bcrypt), HTTPS-only cookies, session expiry after 30 min idle, fail-closed RBAC on API routes | SRS §8.1 | `identity-access` | M3.2 | Confirmed |
| **NFR-02** | File Security | Private object storage for documents outside public root; authorized temporary presigned URL delivery only | SRS §8.1 | `documents` | M4.3 | Confirmed |
| **NFR-03** | Privacy | Sensitive fields encrypted at rest where required, redacted in logs, and stripped from unprivileged API responses | SRS §8.1 | `identity-access` | M4.5 | Confirmed |
| **NFR-04** | Performance | Common query screens render in <3.0 seconds with 2,000 active students and 10 historical years of data | SRS §8.2 | `shared` | M7.1 | Confirmed |
| **NFR-05** | Reliability / Atomicity | Multi-row financial transactions (payment, allocation lines, receipt generation) commit atomically or roll back completely | SRS §8.3 | `fees-ledger`, `receipts` | M5.3 | Confirmed |
| **NFR-06** | Auditability | Comprehensive audit log tracking entity ID, user ID, client IP, action type, timestamp, and pre/post state changes | SRS §8.4 | `audit-reporting` | M3.5 | Confirmed |
| **NFR-07** | Usability | Keyboard-navigable forms, plain-English error messages without stack traces, voucher-style receipt entry matching paper workflow | SRS §8.5 | `shared` | M2.4, M7.4 | Confirmed |
| **NFR-08** | Compatibility | Desktop browser support for latest Google Chrome on Windows at >=1366x768 resolution; print-ready A4/A5 PDF generation | SRS §2.3, §8.6 | `shared` | M6.2 | Confirmed |
| **NFR-09** | Data Safety | PostgreSQL schema enforces append-only constraints; application DB user role stripped of `DROP`, `TRUNCATE`, and core table `DELETE` | SRS §8.7 | `infrastructure` | M0.4 | Confirmed |
| **NFR-10** | Maintainability | Modular monolith structure with decoupled domain modules, typed schemas, and comprehensive documentation handover | SRS §8.8 | Architecture | M1.1, M8.2 | Confirmed |
| **NFR-11** | Accuracy | Arithmetic validation verifying line allocations equal payment total and head balances reconcile; amount in words verification | SRS §8.9 | `fees-ledger` | M7.3 | Confirmed |
| **NFR-12** | Portability | 100% configuration driven via environment variables; zero hardcoded secrets or environment endpoints | SRS §8.10 | `infrastructure` | M0.3 | Confirmed |

---

## 7. Reports and Screen Projections

| Report ID | Title & Description | Primary Consumers | Source Section | Target Module | Milestone | Status |
|---|---|---|---|---|---|---|
| **REP-01** | **Student Fee Breakdown**: Itemized list of billed heads, payments, adjustments, and balance | ACC, Principal | SRS §5 Mod 5 (US-20) | `fees-ledger` | M5.3 | Confirmed |
| **REP-02** | **Outstanding Dues Summary**: Filterable by standard, section, vehicle place, and amount threshold | ACC, Principal | SRS §5 Mod 5 (US-24) | `fees-ledger` | M5.5 | Confirmed |
| **REP-03** | **Student Payment Ledger**: Chronological transaction history listing receipt numbers and cashier | ACC, Principal | SRS §5 Mod 5 (US-25) | `fees-ledger` | M5.3 | Confirmed |
| **REP-04** | **Unnumbered Fee Statement**: Printable point-in-time statement available for parents at any time | ACC, Principal | SRS §5 Mod 7 (US-28) | `receipts` | M6.1 | Confirmed |
| **REP-05** | **Audit Log Stream**: System event journal filterable by module, actor, action, and date range | Principal, SYSADMIN | SRS §5 Mod 10 (US-38) | `audit-reporting` | M3.5 | Confirmed |
| **REP-06** | **Operational Dashboard**: Summary cards for student enrollment, seat occupancy, and fee totals | Principal, ADM, ACC | SRS §5 Mod 10 (US-39) | `audit-reporting` | M3.5 | Confirmed |

---

## 8. Scope Exclusions & System Boundaries

The following capabilities are explicitly declared **Out of Scope** in signed BRD v1.4 (§2.4) and signed SRS v1.4 (§1.2). They must not be implemented.

| Exclusion ID | Out-of-Scope Capability | Authority | Contractual Boundary Note |
|---|---|---|---|
| **OOS-01** | Online payment gateways (Razorpay, Paytm, UPI, Stripe, credit/debit card processing) | BRD §2.4, SRS §1.2 | School policy mandates offline cash/cheque/bank collection only. |
| **OOS-02** | Parent / Student self-service web portal or mobile logins | BRD §2.4, SRS §1.2 | System is strictly an internal back-office tool for school staff. |
| **OOS-03** | Automated notifications via SMS, WhatsApp, or email | BRD §2.4, SRS §1.2 | External messaging infrastructure excluded from engagement scope. |
| **OOS-04** | Mobile native applications (iOS / Android) | BRD §2.4, SRS §1.2 | Scope is desktop web browser on school administrative PCs only. |
| **OOS-05** | Student attendance, timetables, grading, and examination management | BRD §2.4, SRS §1.2 | Handled through separate school processes. |
| **OOS-06** | Automatic class promotion workflows at academic year-end | BRD §2.4, SRS §1.2 | Student progression across standards is manually recorded. |
| **OOS-07** | Automated fee balance carry-forward between academic years | BRD §2.4, SRS §1.2 | Arrears from prior years handled administratively outside software. |
| **OOS-08** | Legacy database data extraction, cleanup, or historical ETL migration | BRD §2.4, SRS §1.2 | Engagement delivers synthetic seed; Client enters live records. |
| **OOS-09** | US-43 Automatic year-end fee closure / balance sweep | SRS §5 Mod 10, §10 | Withdrawn by client during requirement finalization. |
| **OOS-10** | Production hosting, domain registration, SSL certificates, backup operations | BRD §1.3, SRS §1.3 | Client responsibility under signed handover agreement. |

---

## 9. Clarification Register & Open Client Decisions

Cross-referenced directly to [OPEN_ITEMS.md](OPEN_ITEMS.md). All 16 items require written client approval before implementation logic is finalized.

| Item # | Open Client Decision | Affected Requirements | Delivery Owner | Business Impact | Escalation Route |
|---|---|---|---|---|---|
| **1** | Additional receipt/form categories beyond Admission, Fees, Books, Transport | BR-14, US-17 | Shashidhar | Determines fee configuration tables & receipt template layouts | Client contracting lead |
| **2** | Definition of "Admin" authority for fee master setup (Principal vs ACC) | BR-14, RC-03 | Shashidhar | Impacts authorization guards on fee configuration APIs | Principal / Client |
| **3** | Uniform and Books fee heads: fixed vs variable per class | BR-13, US-18 | Shashidhar | Dictates fee assessment auto-generation rules upon admission | School Administration |
| **4** | Vehicle place tariff calculation basis (distance flat fee vs standard-specific) | BR-15, US-19 | Shashidhar | Impacts vehicle place schema and tariff computation logic | Transport Lead / Principal |
| **5** | Seat release protocol for approved applicants who fail to join | BR-38, US-14, US-42 | Shashidhar | Determines admission status state transitions (`Expired` / `Cancelled`) | Principal |
| **6** | Admission Fee refundability policy and partial correction workflows | BR-22, US-26A | Shashidhar | Affects financial reversal constraints and adjustment journal | Accounts Lead / Principal |
| **7** | Scope of 100-seat capacity limit (per section, per standard, or school-wide) | BR-38, US-42 | Shashidhar | Modifies admission approval validation triggers | Principal |
| **8** | Policy for issuing Leaving/Transfer Certificates with unpaid fee balances | BR-33, US-35 | Shashidhar | Determines hard block vs Principal warning override on TC issue | Principal |
| **9** | Inclusion and placement of sensitive fields (caste, parent income, occupation) | BR-04, US-03, US-08 | Shashidhar | Determines admission form schema and server privacy filters | Principal |
| **10** | Mandatory minimum age validation thresholds per grade level | BR-05, US-08 | Shashidhar | Controls client/server form validation warning triggers | School Administration |
| **11** | Finalized application status state machine transitions | BR-11, US-16 | Shashidhar | Determines allowable workflow actions per status in UI/API | Project Lead / Principal |
| **12** | Official format, serial numbering scheme, and duplicate rules for LC/TC | BR-34, US-36 | Shashidhar | Impacts PDF generator template and certificate counter table | Principal |
| **13** | High-resolution school letterhead, stamps, and physical receipt samples | BR-26, US-27, US-28 | Shashidhar | Prerequisite for pixel-perfect PDF report rendering | Client Admin |
| **14** | Mandatory vs optional document upload checklist per standard | BR-07, US-10 | Shashidhar | Impacts admission completeness validation rules | Admission Lead |
| **15** | Initial system administrator bootstrap and forced initial password change | RC-04, US-04 | Shashidhar | Controls initial authentication seed and user provisioning security | Technical Lead |
| **16** | Archival and retention schedule for audit logs and student file attachments | NFR-06, US-38 | Shashidhar | Influences storage bucket retention policies and database pruning | Client Compliance |

---

## 10. Review & Verification Receipt

- **Task Code:** M0.2 — Requirements Traceability
- **Deliverable:** Full Requirements Traceability Matrix covering Functional, Delivery, Roles, Business Invariants, NFRs, Reports, Exclusions, and Clarifications.
- **Story Coverage Attestation:** 43 active user stories (`US-01` to `US-42`, `US-26A`) + 1 withdrawn story (`US-43`, explicitly Out of Scope) verified against SRS v1.4 §5 and §10.
- **Database Safety Guardrail:** Confirmed **Read-only**. Preserved git baseline `5e1c47e` and existing schema intact.
- **Reviewer Assignment:** Submitted to **Ujwal** for independent review. Task author (Shashidhar) cannot self-approve.
