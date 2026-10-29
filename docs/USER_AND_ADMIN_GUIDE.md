# User and Administrator Operations Manual (Phase 7 Handover)

**Document Code:** P7-USER-ADMIN-GUIDE-001  
**Project:** School Admission & Fee Management Portal  
**Target Organization:** ABC English Medium School  
**Audience:** School Principal, Admission Officers, Accounts Officers, and System Administrators  
**Verification Date:** 29 October 2026  
**Status:** **Approved for Client Handover**  

---

## 1. Introduction & Getting Started

The School Admission & Fee Management Portal is an institutional web platform accessed via Google Chrome desktop browsers.

### Logging In:
1. Navigate to `http://localhost:3000/login` (or the school's internal domain).
2. Enter your registered school email address and password.
3. If logging in for the first time on an administratively provisioned account (or after a password reset), you will be prompted to set a new password satisfying complexity standards (minimum 8 characters, upper, lower, number, special character).
4. After 5 consecutive failed login attempts, the account will be automatically locked for 15 minutes to protect against brute-force attacks.

---

## 2. Institutional Role Guides

---

### 2.1 Principal Operations Guide

The Principal holds sole institutional authority for admissions, fee policies, concessions, refunds, and student certificates.

#### A. Reviewing and Approving Admissions
1. Navigate to **Admissions** in the main navigation menu.
2. Select the **Submitted** tab to view applications forwarded by Admission Officers.
3. Click on any student row to inspect the applicant profile, uploaded documents, and checklist status.
4. To make a decision:
   - **Approve:** Click **Approve Admission**. Select the assigned Section (e.g. Standard 1 - Section A). The system displays current seat capacity. Click **Confirm Approval**.
     - *System Behavior:* The student is admitted immediately. A permanent institutional admission number (`ADM-YYYY-NNNN`) is generated. Initial fee assessment lines are automatically assigned based on the approved fee schedule. **No initial fee payment is required for admission** (DEC-01).
   - **On Hold:** If additional certificates or tests are required, select **Place On Hold** and enter the mandatory recorded justification.
   - **Reject:** If ineligible, select **Reject Application** and enter the mandatory reason.

#### B. Approving Annual Fee Structures
1. Navigate to **Fees & Billing** -> **Fee Structures**.
2. Select any structure in `draft` status prepared by the Accounts Officer.
3. Review the itemized fee heads and amounts for the grade level.
4. Click **Approve Structure**.
   - *System Behavior:* The structure becomes active immediately. Any previous version for this standard is retired.

#### C. Granting Fee Concessions & Reversals
1. To approve a concession requested by the Accounts Officer, navigate to **Fees & Billing** -> **Concessions & Waivers**.
2. Review the student's assessed dues and the requested discount amount.
3. Enter your approval justification and click **Approve Concession**.
4. To reverse a mistyped payment or process a Principal-authorized refund, open the student's payment history, select the transaction, and click **Approve Reversal**.

#### D. Approving Transfer Certificates (LC/TC)
1. Navigate to **Certificates (LC/TC)**.
2. Select the **Reviewed** tab to view certificates that have passed Admission Officer review.
3. Click **Issue Certificate**.
   - *Dues Warning Gate (REG-03):* If the student has outstanding fee dues, the system will prominently display the unpaid balance. You must enter a **Mandatory Dues Override Justification** (e.g. *"Fee waiver sanctioned under Board Resolution #42"*) to proceed.
4. Click **Confirm & Issue**. The certificate is assigned sequential number `TC-YYYY-NNNN` and becomes printable.

---

### 2.2 Admission Officer Operations Guide

The Admission Officer manages intake, demographic documentation, and document checklists.

#### A. Creating a New Application
1. Navigate to **Admissions** and click **New Application**.
2. Enter the applicant's First Name, Last Name, Date of Birth, Gender, and Grade Standard applied for.
3. Enter demographic details (address, city, pincode, blood group, religion, STS/DISE numbers if available).
4. Enter Sensitive Information (Aadhaar number, caste, sub-caste, annual household income, bank account details).
5. Enter Primary Guardian details. Note: Exactly one primary contact guardian must be designated.
6. Click **Save as Draft**. The system generates an application number in school format (e.g. `161/2026-27`).

#### B. Uploading Documents & Tracking Checklist
1. Open the draft application and click **Document Checklist**.
2. Select the document type (e.g. Birth Certificate, Passport Photograph, Parent ID).
3. Upload the file (allowed formats: PDF, JPEG, PNG; maximum file size: 5 MB).
4. Once all mandatory documents are marked as received, click **Submit for Verification**.
   - *Override Exception:* If an original physical certificate is delayed, enter a mandatory **Missing Document Override Reason** to forward the application to the Principal.

#### C. Pre-populating Annual Certificates & Step 1 Review
1. Navigate to **Certificates (LC/TC)**.
2. At the start of the year or departure season, click **Pre-populate Year Certificates** to generate draft records for enrolled students.
3. For any student departing, click **Review Details** (Step 1).
4. Review student dates, enter conduct (e.g. *Good*), progress (e.g. *Satisfactory*), and remarks.
5. Select **Forward for Principal Approval** and click **Submit Review**.

---

### 2.3 Accounts Officer Operations Guide

The Accounts Officer manages fee structures, transport tariffs, payment recording, and receipts.

#### A. Setting Up Fee Heads & Structures
1. Navigate to **Fees & Billing** -> **Fee Heads**.
2. Click **Add Fee Head**. Enter code, name, and category:
   - `school_fee` (Tuition, Development, Exam)
   - `vehicle` (Transportation)
   - `books` (Books & Uniforms)
3. Navigate to **Fee Structures** -> **New Structure Draft**. Add itemized heads and amounts for the grade level. Submit for Principal approval.

#### B. Recording Offline Payments
1. Navigate to **Fees & Billing** -> **Record Payment**.
2. Search for the student by admission number, student name, or STS number.
3. Select the **Fee Category** (`school_fee`, `vehicle`, or `books`). *Note: Payments cannot mix heads across categories (DEC-10).*
4. Select the payment method (`cash`, `cheque`, `bank_transfer`, or `upi_manual`) and enter instrument details.
5. Allocate the paid amount across the student's assessed fee heads.
   - *Integrity Rule:* The sum of allocations must equal the total paid amount down to the exact paise.
6. Click **Confirm & Record Payment**.
   - *System Behavior:* The payment is recorded immutably. Monotonic receipt number `RCT-YYYY-NNNNNN` is issued. The receipt PDF opens immediately.

#### C. Printing and Re-printing Receipts
1. Open any receipt from **Receipts & History**.
2. Click **Print / Download PDF**.
3. Verify the 3 signature blocks:
   - Payer signs the physical printout.
   - Cashier (Accounts Officer) signs.
   - Manager (Principal) signs.
4. If a parent requests a duplicate copy, click **Re-print Receipt**. Enter the reprint reason. The generated PDF will bear a prominent watermark: `*** DUPLICATE COPY (Reprint #N) ***`.

#### D. Issuing the Final Fees Receipt
1. Open the student fee ledger in **Fees & Billing**.
2. Verify that **Net Balance Due** across all fee heads is exactly **INR 0.00**.
   - *Strict Rule (DEC-04, US-28):* The system will reject Final Fees Receipt generation if any balance remains unpaid.
3. Click **Issue Final Fees Receipt**. A consolidated receipt snapshot is generated and signed.

---

### 2.4 System Administrator Operations Guide

The System Administrator is strictly an infrastructure and account operator with zero financial or admission authority.

#### A. Provisioning New Staff Accounts
1. Navigate to **Settings** -> **Staff Management**.
2. Click **Invite / Provision Staff**.
3. Enter the staff member's full name, official school email, and assign their institutional role (`principal`, `admission_officer`, `accountant`, or `clerk`).
4. Set the initial temporary password and leave **Require Password Change on First Login** enabled.
5. Click **Save Staff Member**.

#### B. Deactivating Staff & Password Resets
1. If a staff member departs, find their entry in **Staff Management** and toggle their status to **Inactive**. They will be immediately blocked from logging in.
2. If a staff member forgets their password, click **Reset Password**. A temporary credential will be issued and the change-on-login flag activated.

#### C. Inspecting System Audit Logs
1. Navigate to **Audit Logs**.
2. Filter logs by Date Range, Action Type (e.g. `PAYMENT_RECORDED`, `ADMISSION_APPROVED`, `SENSITIVE_PII_VIEWED`), or Staff Member.
3. Inspect before/after snapshots and actor IP addresses to monitor institutional compliance.
