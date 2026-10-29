# Comprehensive Role & Permission Matrix (Phase 7 Handover)

**Document Code:** P7-RBAC-MATRIX-001  
**Project:** School Admission & Fee Management Portal  
**Target Organization:** ABC English Medium School  
**Baseline References:** Signed BRD v1.4, Signed SRS v1.4 §2.2, System-Wide Rule R-05, Milestone M0.5 Decision Register §2  
**Verification Date:** 29 October 2026  
**Status:** **Enforced & Verified** (Server-Side Session Guards & Centralized Policy Engine)  

---

## 1. Executive Summary & Governance Invariants

The School Admission & Fee Management Portal enforces a strict **Role-Based Access Control (RBAC)** architecture mediated exclusively through server-side session tokens and domain policy guards ([`src/policy/guards.ts`](file:///src/policy/guards.ts), [`src/policy/permissions.ts`](file:///src/policy/permissions.ts)).

### Core Institutional Governance Principles:
1. **Institutional Separation of Powers:**
   - **The Principal (`principal`)** is the sole institutional authority for admission approvals, fee concessions, payment reversals, fee structure approvals, Transfer Certificate issuance, and Manager signature authority.
   - **The System Administrator (`system_admin`)** is strictly an operational operator responsible for staff account provisioning and system health. The System Administrator has **zero business authority**, cannot admit students, cannot waive fees, cannot alter ledger records, and cannot view sensitive student demographics (Rule `R-05`).
2. **Privacy by Design (DPDP Act Compliance):**
   - Sensitive student demographics (`student_sensitive_details`: full Aadhaar, household income, caste/sub-caste, bank details) are restricted strictly to the **Principal** and **Admission Officer** (Rule `R-06`).
   - The Accounts Officer and System Administrator receive redacted/masked views only (`••••-••••-1234`).
3. **Defense Against Forged Roles & Identifiers:**
   - Client-provided request headers (`x-role`, `x-staff-id`) and request body fields (`role`, `actorStaffId`) are **never trusted**.
   - All permissions are evaluated strictly against the verified, server-decrypted session token.

---

## 2. Definitive Role-Permission Capability Matrix

| Permission Code | Business Capability / Operation | Principal | Admission Officer | Accounts Officer | System Admin | Architectural Guard & Boundary |
|---|---|:---:|:---:|:---:|:---:|---|
| **`auth:manage_sessions`** | Log in, refresh session, log out | **YES** | **YES** | **YES** | **YES** | Active session token required |
| **`auth:change_password`** | Change own password | **YES** | **YES** | **YES** | **YES** | Must satisfy password complexity |
| **`users:manage_accounts`** | Provision/deactivate staff, reset passwords | NO | NO | NO | **YES** | SYSADMIN operational mandate (REG-01) |
| **`academic_years:view`** | View academic years & select active year | **YES** | **YES** | **YES** | **YES** | Scopes session cookie |
| **`academic_years:manage`** | Create academic year, close academic year | **YES** | NO | NO | NO | Principal calendar prerogative |
| **`admissions:create_draft`** | Create new draft admission application | NO | **YES** | NO | NO | Intake desk operation (US-07) |
| **`admissions:edit_draft`** | Edit student/guardian details in draft | NO | **YES** | NO | NO | Gated to draft status (US-12) |
| **`admissions:submit_verification`**| Submit application for Principal review | NO | **YES** | NO | NO | Validates document checklist (US-13) |
| **`admissions:review`** | Place on hold or reject application | **YES** | NO | NO | NO | Principal review authority (US-14) |
| **`admissions:approve_decision`** | Formally approve admission & admit student | **YES** | NO | NO | NO | **Principal sole authority** (DEC-01, US-15) |
| **`admissions:view_sensitive_pii`**| Access unmasked Aadhaar, income, caste | **YES** | **YES** | NO | NO | **DPDP Act boundary** (US-03, R-06) |
| **`admissions:upload_documents`** | Upload student intake verification docs | NO | **YES** | NO | NO | Validates PDF/JPG/PNG < 5MB (US-10) |
| **`admissions:download_documents`**| Generate presigned document download URLs | **YES** | **YES** | NO | NO | Restricted to authorized roles |
| **`students:search`** | Search student directory by name/adm/STS | **YES** | **YES** | **YES** | **YES** | Redacts sensitive fields for ACC/SYS |
| **`students:view_profile`** | View comprehensive student profile | **YES** | **YES** | **YES** | NO | SYSADMIN has zero student view rights |
| **`students:mark_status`** | Transition status to left/transferred | **YES** | NO | NO | NO | Principal approval & reason (US-32) |
| **`fees:configure_heads`** | Create fee heads (school, vehicle, books) | NO | NO | **YES** | NO | Accounts Officer drafting (US-17) |
| **`fees:configure_structure`** | Draft yearly fee structures per standard | NO | NO | **YES** | NO | Accounts Officer drafting (US-18) |
| **`fees:approve_structure`** | Formally approve annual fee schedule | **YES** | NO | NO | NO | **Principal sole authority** (REG-05) |
| **`fees:manage_tariffs`** | Configure vehicle transport rates by place | NO | NO | **YES** | NO | Accounts Officer management (US-19) |
| **`fees:view_dues`** | View student dues breakdown & reports | **YES** | NO | **YES** | NO | Accounts & Principal visibility (US-20) |
| **`fees:record_payment`** | Record offline fee payment & allocations | NO | NO | **YES** | NO | **Accounts Officer desk only** (US-21) |
| **`fees:request_concession`** | Draft fee concession request | NO | NO | **YES** | NO | Accounts Officer initiation (US-26) |
| **`fees:approve_concession`** | Formally approve fee concession / waiver | **YES** | NO | NO | NO | **Principal sole authority** (US-26) |
| **`fees:request_reversal`** | Draft payment reversal / refund request | NO | NO | **YES** | NO | Accounts Officer initiation (US-26A) |
| **`fees:approve_reversal`** | Formally approve financial refund/reversal | **YES** | NO | NO | NO | **Principal sole authority** (US-26A) |
| **`receipts:view`** | View and print fee payment receipts | **YES** | NO | **YES** | NO | Payer, Cashier, Manager lines (US-27) |
| **`receipts:issue_final`** | Issue zero-dues Final Fees Receipt | NO | NO | **YES** | NO | **Strict ₹0.00 dues gate** (DEC-04, US-28) |
| **`receipts:reprint`** | Re-issue receipt with duplicate watermark | **YES** | NO | **YES** | NO | Logs reprint audit (US-29) |
| **`certificates:prepopulate`**| Batch pre-populate annual LC/TC drafts | NO | **YES** | NO | NO | Admission Officer desk (US-34) |
| **`certificates:review_tc`** | Step 1 review of conduct & remarks | NO | **YES** | NO | NO | Admission Officer review (US-35) |
| **`certificates:issue_tc`** | Step 2 Principal approval & TC issuance | **YES** | NO | NO | NO | **Principal sole authority** (US-35, 36) |
| **`certificates:reprint`** | Re-issue certificate with duplicate banner | **YES** | **YES** | NO | NO | Increments reprint count (US-37) |
| **`audit:view_logs`** | Inspect append-only audit trail | **YES** | NO | NO | **YES** | Principal & SYSADMIN oversight (US-38) |
| **`dashboard:view_metrics`** | View enrollment, capacity, and dues | **YES** | **YES** | **YES** | **YES** | Read-only aggregates (US-39) |

---

## 3. Negative Authorization Test Coverage

The following negative authorization tests run on every build and are fully verified in [`tests/rbac_enforcement.test.ts`](file:///tests/rbac_enforcement.test.ts) and [`tests/security_verification.test.ts`](file:///tests/security_verification.test.ts):
1. **Accounts Officer Role Escalation:** Attempts to approve admissions (`admissions:approve_decision`), approve fee structures (`fees:approve_structure`), approve concessions (`fees:approve_concession`), or sign receipts as Manager are rejected with `403 Forbidden` (`AuthorizationError`).
2. **Admission Officer Financial Restriction:** Attempts to record offline payments (`fees:record_payment`), approve fee structures, or grant concessions are rejected with `403 Forbidden`.
3. **System Administrator Business Override:** Attempts to approve admissions, view student sensitive PII, record payments, grant waivers, or issue Transfer Certificates are rejected with `403 Forbidden`.
4. **Forged Actor Identity:** Passing a forged `staffId` or `role` in request payloads or HTTP headers is rejected; the server enforces identity strictly from the cryptographically verified session token.
