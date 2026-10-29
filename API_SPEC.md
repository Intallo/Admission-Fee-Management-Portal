# API Specification & Service Contracts

**Document Code:** API-SPEC-001  
**Version:** 1.0 (Phase 1 Architecture Lock)  
**Baseline References:** Signed BRD v1.4, Signed SRS v1.4 (Approved 22 October 2026), ADR-001, ARCHITECTURE.md  
**Implementation Owner:** Senior Software Engineer  

---

## 1. Global API Standards & Conventions

### 1.1 Transport & Content Negotiation
- **Base URL:** `/api/v1`
- **Protocol:** HTTPS only (TLS 1.3 recommended)
- **Data Format:** `application/json` (UTF-8 encoded)
- **Monetary Format:** Exact decimal strings (e.g. `"1500.00"`) or integer paise (e.g. `150000`). Floating point numbers are strictly forbidden.
- **Dates & Timestamps:** ISO 8601 extended format with UTC offset (e.g. `"2026-10-29T13:30:00+05:30"`). Date-only fields formatted as `"YYYY-MM-DD"`.

### 1.2 Standard Request Headers

| Header | Type | Required | Description |
|---|:---:|:---:|---|
| `Cookie` | `string` | Yes | Encrypted session cookie managed by `@supabase/ssr`. |
| `X-Academic-Year-Id` | `UUID` | Yes (for year-scoped operations) | Explicit target academic year. Validates that mutations only apply to the active/current year. |
| `Idempotency-Key` | `UUID` | Conditional (Mandatory for Payments & Approvals) | Client-generated UUID ensuring retry safety. Protects against duplicate payments or numbers. |
| `X-Correlation-Id` | `UUID` | Optional | Client/Gateway trace identifier for distributed request tracking in audit logs. |

### 1.3 Standard Error Response (RFC 7807 Compliant)

All non-2xx responses return a consistent Problem Details payload. Stack traces and sensitive internal identifiers are never leaked:

```json
{
  "type": "https://api.schoolportal.local/errors/BUSINESS_RULE_VIOLATION",
  "title": "Business Rule Violation",
  "status": 422,
  "code": "FIXED_HEAD_OVERPAYMENT_PROHIBITED",
  "detail": "Payment allocation of ₹15,000.00 exceeds remaining payable dues of ₹10,000.00 for Tuition Fee.",
  "instance": "/api/v1/fees/payments",
  "correlationId": "c8f9b2d1-4e2b-48d6-9f4a-8d6a71e290f1",
  "timestamp": "2026-10-29T13:35:00.000Z",
  "invalidParams": [
    {
      "name": "allocations[0].amount",
      "reason": "Exceeds remaining assessed dues"
    }
  ]
}
```

### 1.4 Standard HTTP Status Codes

| Status Code | Description | Typical Use Case |
|:---:|---|---|
| `200 OK` | Successful query or synchronous update. | Entity retrieval, search, dashboard queries. |
| `201 Created` | Successful creation or atomic transaction release. | Payment recorded, receipt issued, admission created. |
| `204 No Content` | Successful operation returning no body. | User logout, session revocation. |
| `400 Bad Request` | Malformed JSON or input schema validation failure. | Missing required fields, invalid UUID, malformed dates. |
| `401 Unauthorized` | Missing, invalid, or expired session cookie. | Session timeout (30 min idle), unauthenticated request. |
| `403 Forbidden` | Authenticated actor lacks required role or is inactive. | Cashier attempting admission approval; SYSADMIN attempting payment. |
| `404 Not Found` | Requested resource does not exist or out of year scope. | Student ID not found in active academic year. |
| `409 Conflict` | Concurrency collision or duplicate business number. | Duplicate application number; concurrent allocation collision. |
| `422 Unprocessable` | Input schema valid, but business invariant violated. | Allocation exceeds dues; final receipt with pending dues; closed year write. |
| `500 Server Error` | Unexpected unhandled server exception. | Database unreachable, internal unrecoverable fault. |

---

## 2. Contracts for the Eight Required Atomic Business Operations

---

### Operation 1: Admission Approval (`admit_student_atomic`)
- **SRS Reference:** US-15, US-42 (BR-12, BR-37, BR-38)
- **Role Authority:** `principal` strictly. (`admission_officer`, `clerk`, `accountant`, `system_admin` return `403 Forbidden`).
- **Endpoint:** `POST /api/v1/admissions/applications/{id}/approve`
- **Idempotency:** Enforced via `Idempotency-Key` header and application status check.

#### Pre-conditions & Invariants:
1. `admission_applications.status` must be `submitted` or `under_review`.
2. Section capacity check: `count(enrolled_students in section) < sections.max_capacity`.
3. An approved fee structure (`fee_structures.status = 'approved'`) must exist for the grade level in the active academic year.
4. **Non-Negotiable Rule:** Admission approval requires **ZERO payment**. Fee assessment is initialized with zero payments recorded.

#### Request Payload:
```json
{
  "sectionId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "remarks": "Approved after interview verification."
}
```

#### Response Payload (`201 Created`):
```json
{
  "applicationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "applicationNumber": "161/2026-27",
  "admissionNumber": "ADM-2026-0001",
  "studentId": "b8f2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e",
  "studentAcademicRecordId": "c9f3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
  "sectionId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "status": "approved",
  "approvedBy": "d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a",
  "approvedAt": "2026-10-29T13:40:00.000Z",
  "initialAssessmentId": "e2f3a4b5-c6d7-8e9f-0a1b-2c3d4e5f6a7b",
  "initialBilledAmountInr": "42500.00"
}
```

#### Error Scenarios:
- `403 Forbidden`: `PRINCIPAL_AUTHORITY_REQUIRED` (Actor is not Principal).
- `409 Conflict`: `APPLICATION_ALREADY_DECIDED` (Status is already approved/rejected).
- `422 Unprocessable Entity`: `SECTION_CAPACITY_EXCEEDED` (Section has reached `max_capacity`).
- `422 Unprocessable Entity`: `FEE_STRUCTURE_NOT_APPROVED` (No approved fee schedule found for grade).

---

### Operation 2: Payment Recording & Receipt Issuance (`record_payment_and_issue_receipt`)
- **SRS Reference:** US-21, US-22, US-27 (BR-17, BR-18, BR-24, BR-43, BR-45)
- **Role Authority:** `accountant` or `principal`.
- **Endpoint:** `POST /api/v1/fees/payments`
- **Idempotency:** Enforced via `Idempotency-Key` header mapped to `payments.idempotency_key`.

#### Pre-conditions & Invariants:
1. `student_academic_records.status` must be `admitted` or `active`.
2. All allocation lines must belong to the exact same `fee_category` (`school_fee`, `vehicle`, or `books`). Multi-category mixing is strictly prohibited.
3. `payment.amount` must exactly equal the arithmetic sum of `allocations[].amount`.
4. Fixed fee heads cannot be overpaid: each allocation amount must not exceed the remaining unpaid balance on that assessment line.
5. Receipt number is generated atomically from the shared monotonic series (`RCT-YYYY-NNNNNN`, **6 digits**).
6. Payment, allocations, receipt number, rendered JSON snapshot, and audit event commit atomically in a single database transaction.

#### Request Payload:
```json
{
  "studentAcademicRecordId": "c9f3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
  "category": "school_fee",
  "amount": "15000.00",
  "method": "cash",
  "payerName": "Suresh Sharma",
  "referenceNumber": null,
  "remarks": "Term 1 installment",
  "allocations": [
    {
      "assessmentLineId": "11111111-2222-3333-4444-555555555555",
      "amount": "5000.00"
    },
    {
      "assessmentLineId": "66666666-7777-8888-9999-000000000000",
      "amount": "10000.00"
    }
  ]
}
```

#### Response Payload (`201 Created`):
```json
{
  "paymentId": "77777777-8888-9999-0000-111111111111",
  "receiptId": "88888888-9999-0000-1111-222222222222",
  "receiptNumber": "RCT-2026-000001",
  "category": "school_fee",
  "amountInr": "15000.00",
  "amountInWords": "Rupees Fifteen Thousand Only",
  "method": "cash",
  "payerName": "Suresh Sharma",
  "receivedAt": "2026-10-29T13:45:00.000Z",
  "renderedSnapshot": {
    "schoolName": "ABC English Medium School",
    "receiptNumber": "RCT-2026-000001",
    "studentName": "Aarav Sharma",
    "admissionNumber": "ADM-2026-0001",
    "standard": "STD 1",
    "totalAmountInr": "15000.00",
    "signatories": ["Payer", "Cashier", "Manager"]
  }
}
```

#### Error Scenarios:
- `422 Unprocessable Entity`: `MULTI_CATEGORY_PAYMENT_PROHIBITED` (Allocations span multiple categories).
- `422 Unprocessable Entity`: `ALLOCATION_SUM_MISMATCH` (Sum of allocations != payment amount).
- `422 Unprocessable Entity`: `FIXED_HEAD_OVERPAYMENT_PROHIBITED` (Allocation exceeds remaining due balance).
- `422 Unprocessable Entity`: `ACADEMIC_YEAR_CLOSED` (Target year is closed).

---

### Operation 3: Fee Concession Approval (`approve_fee_concession_atomic`)
- **SRS Reference:** US-26 (BR-21, BR-40)
- **Role Authority:** `principal` strictly.
- **Endpoint:** `POST /api/v1/fees/adjustments/{id}/approve`

#### Pre-conditions & Invariants:
1. `fee_adjustments.status` must be `pending`.
2. Concession amount must not exceed the remaining net payable balance on the targeted assessment line.
3. Once approved, concession row is permanently frozen by trigger `protect_approved_financial_adjustments()`.

#### Request Payload:
```json
{
  "approvalNotes": "Approved 10% sibling concession based on parent formal application."
}
```

#### Response Payload (`200 OK`):
```json
{
  "adjustmentId": "22222222-3333-4444-5555-666666666666",
  "assessmentLineId": "11111111-2222-3333-4444-555555555555",
  "adjustmentType": "concession",
  "amountInr": "2500.00",
  "status": "approved",
  "approvedBy": "d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a",
  "approvedAt": "2026-10-29T13:50:00.000Z",
  "newRemainingDuesInr": "7500.00"
}
```

---

### Operation 4: Payment Reversal (`reverse_payment_atomic`)
- **SRS Reference:** US-26A (BR-22)
- **Role Authority:** `principal` strictly.
- **Endpoint:** `POST /api/v1/fees/payments/{id}/reversal`
- **Idempotency:** Enforced via `Idempotency-Key` header.

#### Pre-conditions & Invariants:
1. Target payment `transaction_type` must be `collection`.
2. Target payment must not have been previously reversed (`reverses_payment_id` check).
3. Reversal creates a new payment record (`transaction_type = 'reversal'`) with negative allocations restoring line balances. Zero physical row deletion.

#### Request Payload:
```json
{
  "reason": "Payment recorded under wrong student account by Cashier error. Authorized by Principal."
}
```

#### Response Payload (`201 Created`):
```json
{
  "reversalPaymentId": "33333333-4444-5555-6666-777777777777",
  "originalPaymentId": "77777777-8888-9999-0000-111111111111",
  "reversalAmountInr": "15000.00",
  "transactionType": "reversal",
  "reversedBy": "d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a",
  "reversedAt": "2026-10-29T13:55:00.000Z",
  "auditLogId": "44444444-5555-6666-7777-888888888888"
}
```

---

### Operation 5: Monotonic Receipt Number Issuance (`issue_receipt_number_atomic`)
- **SRS Reference:** SBR-07, US-27 (BR-45)
- **Format:** `RCT-YYYY-NNNNNN` (**6 zero-padded digits**).
- **Internal Helper:** Invoked within `record_payment_and_issue_receipt` and `issue_final_receipt_atomic`.
- **Concurrency Safety:** `SELECT next_value FROM receipt_number_counters WHERE series_code = 'RCT' FOR UPDATE`.

---

### Operation 6: Final Fees Receipt Issuance (`issue_final_receipt_atomic`)
- **SRS Reference:** US-28 (BR-25, BR-26, BR-46, BR-47)
- **Role Authority:** `accountant` or `principal`.
- **Endpoint:** `POST /api/v1/receipts/final`

#### Pre-conditions & Invariants:
1. Total net balance across all applicable fee heads for the student in the academic year must equal **₹0.00 exactly**.
2. If any net balance > ₹0.00, request is strictly rejected with `422 Unprocessable Entity (OUTSTANDING_DUES_EXIST)`. (An unnumbered Statement of Account is available via `GET /api/v1/receipts/statement/{id}`).
3. Gathers all prior individual payment receipt IDs and binds them into `consolidated_receipt_items`.
4. Allocates next receipt number from the unified monotonic sequence (`RCT-YYYY-NNNNNN`).

#### Request Payload:
```json
{
  "studentAcademicRecordId": "c9f3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e"
}
```

#### Response Payload (`201 Created`):
```json
{
  "consolidatedReceiptId": "55555555-6666-7777-8888-999999999999",
  "receiptNumber": "RCT-2026-000015",
  "studentAcademicRecordId": "c9f3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
  "totalAmountInr": "42500.00",
  "totalAmountInWords": "Rupees Forty-Two Thousand Five Hundred Only",
  "itemizedReceiptsCount": 3,
  "signatories": [
    "Payer Signature",
    "Cashier Signature",
    "Manager Signature (Principal)"
  ],
  "generatedAt": "2026-10-29T14:00:00.000Z"
}
```

---

### Operation 7: Certificate Issuance (`issue_certificate_atomic`)
- **SRS Reference:** US-36 (BR-34, BR-36)
- **Role Authority:** `principal` strictly.
- **Endpoint:** `POST /api/v1/certificates/{id}/issue`
- **Identifier Format:** `TC-YYYY-NNNN` (e.g. `TC-2026-0001`).

#### Pre-conditions & Invariants:
1. `student_year_certificates.status` must be `draft`.
2. Principal approval must be verified.
3. Generates next sequential certificate number (`TC-YYYY-NNNN`) and creates immutable `certificate_versions` (Version 1).
4. **Non-Negotiable Rule:** Issuing a certificate does **NOT** alter the student's enrollment status to Left.

#### Request Payload:
```json
{
  "reasonForLeaving": "Completed 10th Standard curriculum.",
  "conduct": "Good",
  "progress": "Satisfactory"
}
```

#### Response Payload (`201 Created`):
```json
{
  "certificateId": "66666666-7777-8888-9999-000000000001",
  "certificateNumber": "TC-2026-0001",
  "certificateType": "TC",
  "status": "issued",
  "versionNumber": 1,
  "studentName": "Aarav Sharma",
  "approvedBy": "d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a",
  "issuedAt": "2026-10-29T14:05:00.000Z",
  "pdfStorageKey": "certificates/2026-2027/TC-2026-0001-v1.pdf"
}
```

---

### Operation 8: Student-Left Status Change (`mark_student_left_atomic`)
- **SRS Reference:** US-32 (BR-30)
- **Role Authority:** `principal` strictly.
- **Endpoint:** `POST /api/v1/students/{id}/status`

#### Pre-conditions & Invariants:
1. `student_academic_records.status` transitions from `admitted` or `active` to `left` or `transferred`.
2. Exit date and exit reason are mandatory.
3. Protected core records remain immutable; zero physical deletion.

#### Request Payload:
```json
{
  "academicRecordId": "c9f3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
  "newStatus": "transferred",
  "exitDate": "2026-10-29",
  "exitReason": "Relocation to another district."
}
```

#### Response Payload (`200 OK`):
```json
{
  "academicRecordId": "c9f3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
  "studentId": "b8f2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e",
  "previousStatus": "active",
  "newStatus": "transferred",
  "exitDate": "2026-10-29",
  "updatedBy": "d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a",
  "updatedAt": "2026-10-29T14:10:00.000Z"
}
```

---

## 3. General REST Endpoints Overview

| Area | HTTP Method | Path | Role Access | Purpose |
|---|---|---|---|---|
| **Auth** | `POST` | `/api/v1/auth/login` | Anonymous | Authenticate email/password, issue HTTP-only cookie. Enforce 5-attempt lockout. |
| | `POST` | `/api/v1/auth/logout` | Authenticated | Revoke session and clear cookies. |
| | `GET` | `/api/v1/auth/me` | Authenticated | Retrieve current active staff identity and permissions. |
| **Admin** | `GET` | `/api/v1/admin/staff` | SYSADMIN | List staff directory. |
| | `POST` | `/api/v1/admin/staff` | SYSADMIN | Invite new staff member. |
| | `PATCH` | `/api/v1/admin/staff/{id}` | SYSADMIN | Deactivate staff account or update role. |
| **Academic Years** | `GET` | `/api/v1/academic-years` | All Roles | List academic years. |
| | `POST` | `/api/v1/academic-years` | Principal, SYSADMIN | Create new academic year in `planning` state. |
| | `PATCH` | `/api/v1/academic-years/{id}/close` | Principal | Formally close academic year. |
| **Admissions** | `GET` | `/api/v1/admissions/applications` | ADM, Principal | Filter and list admission intake applications. |
| | `POST` | `/api/v1/admissions/applications` | ADM, Principal | Create draft application; auto-assigns `{seq}/{year}`. |
| | `PATCH` | `/api/v1/admissions/applications/{id}` | ADM, Principal | Update draft application fields. |
| | `POST` | `/api/v1/admissions/applications/{id}/submit` | ADM, Principal | Submit application for Principal review. |
| **Documents** | `POST` | `/api/v1/documents/upload-url` | ADM, Principal | Generate private presigned upload URL for student document. |
| | `GET` | `/api/v1/documents/{id}/download-url` | ADM, Principal | Generate 15-minute presigned download URL with audit logging. |
| **Fees Config** | `GET` | `/api/v1/fee-config/structures` | ACC, ADM, Principal | View annual grade fee schedules. |
| | `POST` | `/api/v1/fee-config/structures` | ACC, Principal | Create draft fee structure. |
| | `POST` | `/api/v1/fee-config/structures/{id}/approve` | Principal | Approve and freeze fee schedule. |
| **Fees & Ledger** | `GET` | `/api/v1/students/{id}/dues` | ACC, Principal | Fetch itemized fee assessment lines, paid sums, and net dues. |
| | `GET` | `/api/v1/reports/dues` | ACC, Principal | Section-wise and standard-wise outstanding dues summary. |
| **Receipts** | `GET` | `/api/v1/receipts/{id}` | ACC, ADM, Principal | Fetch receipt snapshot and verification metadata. |
| | `POST` | `/api/v1/receipts/{id}/reprint` | ACC, Principal | Record reprint audit event and increment duplicate count. |
| | `GET` | `/api/v1/receipts/statement/{id}` | ACC, Principal | Generate unnumbered statement of account. |
| **Student Records** | `GET` | `/api/v1/students` | All Roles | Multi-criteria search (Name, Admission No, STS No, Grade). |
| | `GET` | `/api/v1/students/{id}` | All Roles | View student profile (Sensitive tab restricted to ADM/Principal). |
| **Certificates** | `GET` | `/api/v1/certificates` | ADM, Principal | List annual draft/issued certificates. |
| | `POST` | `/api/v1/certificates/prepopulate` | Principal, ADM | Batch pre-populate annual LC/TC draft records. |
| **Audit Logs** | `GET` | `/api/v1/audit-logs` | Principal, SYSADMIN | Query system-wide immutable audit trail. |
| **Dashboard** | `GET` | `/api/v1/dashboard/metrics` | Principal, ACC, ADM | Operational KPI counts (admissions, seat fill, fees collected). |
