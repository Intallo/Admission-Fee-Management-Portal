# Business Requirement Document (BRD)

## School Admission & Fee Management Portal

|  |  |
| --- | --- |
| **Client (contracting party)** | Rakesh Aralikatti, acting for ABC English Medium School |
| **Prepared by** | Shashidhar Pawadashetti, CEO and Project Manager, Intallo |
| **Version** | 1.4 (Change Request CR-001, approved) |
| **Date** | 15 October 2026 |
| **Status** | **Approved** by the client on 22 October 2026 (remote approval) |

### Revision history

| Version | Date | Summary of change |
| --- | --- | --- |
| 1.0 | 13 October 2026 | Initial draft for client review |
| 1.1 | 13 October 2026 | Roles merged, admission payment model, Principal-only approvals, seat limit, number formats. BR-37 to BR-40 added |
| 1.2 | 13 October 2026 | Delivery model fixed: source code only. Client is the contracting party. Year-end handling moved to the school |
| 1.3 | 14 October 2026 | Version issued for signature |
| 1.4 | 15 October 2026 | **CR-001.** *Updated 22 October: the client confirmed that the mock-ups are the exact forms used in the current admission process, that the Manager who signs receipts is the Principal, and that the final fees receipt is given only after all fees are fully paid.* Records the client's answers of 15 October 2026 and the school's sample admission form and receipts. **Removed:** the fixed 10% first payment. **Changed:** the Admission Fee is any amount the parent pays; payments are recorded against fee heads; the fee breakdown follows the school's receipts. **Added:** receipt types (Fees, Books, Vehicle), vehicle fee by place, a unique number for every receipt, a final fees receipt, the school's receipt layout (with payer, Cashier, and Manager signature lines), new admission form fields. **Aligned with the project change record of 14 October:** no payment is required for admission, and a year-specific LC/TC is generated for every student each academic year without marking the student as left. **New requirements:** BR-41 to BR-47 |

---

## 1. Purpose of this document

This document records the business needs of ABC English Medium School, as communicated by the Client, Rakesh Aralikatti, and describes the software that Intallo will build. It is the agreed reference for scope, roles, workflows, rules, deliverables, and acceptance. Any change after sign-off follows the change request process in Section 14. Version 1.4 is such a change (CR-001).

---

## 2. Background

ABC English Medium School runs three sections: **Pre-primary** (Nursery, LKG, UKG), **Primary** (1st to 7th standard), and **High School** (8th to 10th standard). Admissions, fee collection, and certificate issuing are currently handled manually on paper.

The school collects admission details and fees through **separate paper forms and receipt books**: the admission form, a fees receipt, a books receipt, a vehicle receipt, and others. The information is collected from the admission form onwards, and at the end one final fees receipt shows the total of all the others.

### 2.1 Parties and delivery model

| Party | Role |
| --- | --- |
| **Intallo** | Designs, builds, tests, and delivers the **project source code**. Its contract is with the Client only. |
| **Rakesh Aralikatti (the Client)** | Commissions the project and is the contracting party. He is Intallo's single point of contact, supplies requirements and assets on behalf of the school, gives all approvals and sign-offs, and is responsible for deployment and operations. |
| **ABC English Medium School** | The end user of the system. It has no direct contract with Intallo. All communication with the school goes through the Client. |

**Delivery model (final decision):** Intallo delivers the working project code and handover package listed in Section 6.3. **Deployment, hosting, domain, security of the live environment, backups, operation, user training, and maintenance are handled by the Client and the school, not by Intallo.**

---

## 3. Problem Statement

The school's manual process causes the following problems:

1. **Scattered records.** Student, parent, and document details sit in paper files, making search and retrieval slow.
2. **No admission visibility.** Staff cannot easily see which applications are pending, on hold, approved, or missing documents.
3. **Error-prone fee handling.** Fees are collected on several separate receipts. Totals, part payments, and balances are calculated by hand, leading to mistakes and disputes.
4. **Weak payment history.** There is no reliable record of who paid, when, how much, on which fee, and what remains.
5. **Poor control of sensitive data.** Aadhaar, caste, income, and bank details are exposed to staff who do not need them.
6. **No seat control.** The number of students admitted in each section is not tracked against the school's seat limit.
7. **Risk of data loss.** Paper records can be lost or damaged, and the school requires that no student data is ever deleted.
8. **Slow certificate issuing.** Leaving/Transfer Certificates (LC/TC) are prepared manually every year with no standard format or approval trail.

---

## 4. Proposed Solution

A secure, English-language web application, delivered as source code, that runs in a browser on school computers and covers:

- **Academic-year-based workspace.** Every record is tied to a selected academic year.
- **Digital admission process.** The school's admission form (student details, parent details, document uploads) with a draft, submit, and Principal-decision workflow, controlled by a seat limit for each section.
- **Fee management that follows the school's own receipts.** Fee heads are grouped into receipt types (**Fees, Books, Vehicle**, and more if the school adds them). The Admission Fee is normally paid first, in any amount the parent pays, but **no payment is required for admission**. Later payments are added to the particular fee head, at any time within the academic year. Balances are shown for every head and in total.
- **The school's receipts.** A separate numbered receipt for each receipt type, and one **final fees receipt** that shows every fee head, the total, and the numbers of all the other receipts.
- **Vehicle fee by place.** The Principal or admin maintains the places and their amounts.
- **Annual Transfer/Leaving Certificate (LC/TC).** A year-specific certificate is generated for every student for each academic year from stored data, approved by the Admission Officer and Principal, kept, and available any time afterwards. Generating it does not mark the student as left.
- **Role-based access.** Each user sees and does only what their role allows, and sensitive data is restricted.
- **Permanent records.** No record is ever deleted. Changes are tracked in an audit log.

The system manages **student details and the admission process**, with the related fee records and certificates. Promotion of students to the next class and the handling of unpaid fees at year end are managed by the school outside the system.

---

## 5. Business Objectives

| # | Objective | How success is measured |
| --- | --- | --- |
| 1 | Replace paper-based admission with a digital process | All new admissions can be entered and tracked in the application |
| 2 | Give accurate, real-time fee status | Balance shown correctly per fee head and in total after every payment |
| 3 | Protect sensitive student data | Only authorized roles can view Aadhaar, caste, income, and bank details |
| 4 | Preserve all records permanently | No delete function exists for student, fee, or payment records |
| 5 | Standardize certificate issue | LC/TC generated for any student in under a minute, with approval history |
| 6 | Reduce staff effort and errors | Fee calculation, receipts, and the final fees receipt are automatic |
| 7 | Keep admissions within the seat limit | The system blocks approvals once a section's seats are full |
| 8 | Match the school's way of working | Receipts follow the school's three receipt books and the final receipt lists all receipt numbers |

---

## 6. Scope

### 6.1 In scope (functional scope of the software)

1. Login and role-based access control
2. Academic year selection
3. New admission: the school's admission form fields, parent details, document attachments
4. Application workflow with statuses and Principal decision
5. Seat limit per section, with seat availability tracking
6. Management of receipt types, fee heads, vehicle places, and the yearly fee structure
7. Fee assignment per student, including the vehicle fee by place
8. Payment recording by receipt type and fee head (any amount at any time within the year; the Admission Fee is normally first), with balance and status tracking
9. Numbered receipts for each receipt type, and the final fees receipt (PDF, printable)
10. Student record search, profile view, and history
11. Concession (including fee negotiation), extra-charge, and refund requests with Principal authorization
12. Annual LC/TC generation for every student each year, approval, and later retrieval
13. Audit log of all key actions with dates
14. Sample (fake) data for demonstration and testing
15. Code handover package (Section 6.3)

### 6.2 Out of scope

**Handled by the Client and school after delivery**

- Deployment, installation, server setup, hosting, and domain
- HTTPS certificates and security of the live environment
- Database setup and operation, backups, restore, and monitoring
- Operation, support, and maintenance of the live system
- User training and user manuals
- Importing real student data (fake data is used for now)

**Not part of the software**

- Promotion of students to the next class (handled by the school)
- Carry-forward of unpaid dues, and the school's handling of unpaid fees at year end (handled by the school)
- Online payment collection (payment gateway). Payments happen offline and are only **recorded**
- A fixed first payment or percentage of the total fee (removed by CR-001)
- Installment schedules with fixed due dates, and automatic fee reminders
- Parent/student login portal
- SMS, WhatsApp, or email notifications
- Attendance, exams, timetable, or other academic modules
- Languages other than English
- Mobile app (the application is for school computers only)

### 6.3 Deliverables

| # | Deliverable | Description |
| --- | --- | --- |
| 1 | **Source code** | Complete project code in a version-controlled repository, transferred to the Client |
| 2 | **Database scripts** | Schema, reference data, and permission scripts that create the database, plus an automated test script for the business rules |
| 3 | **Seed script** | One-step script that loads realistic fake data for demos and testing |
| 4 | **Setup guide (README)** | How to configure and run the application: requirements, environment settings, database setup, initial administrator account, and notes on file storage and backups |
| 5 | **Technical notes** | Short description of the architecture, roles and permissions, data model, and number formats |
| 6 | **Sprint demonstrations** | Demonstrations of progress to the Client, run from an Intallo-provided temporary environment or screen-share |
| 7 | **Defect fixing** | Fixing of defects in the delivered code reported during acceptance and the agreed warranty period (set in the contract) |

---

## 7. Stakeholders and User Roles

These are the **roles inside the application**. They are the school's staff, who will use the system after the Client deploys it.

| Role | Responsibility |
| --- | --- |
| **Principal / Head of School** | Admission authority. Approves, rejects, or holds applications; decides grade placement; sets seat limits; decides fee heads, vehicle places, and amounts; is the **only** approver of concessions, extra charges, exceptions, and refunds; negotiates remaining fees with parents; approves TCs. |
| **Admission Officer** | Processes applications: creates applications, enters details, uploads documents, tracks missing documents, submits for verification, requests TCs, reviews TCs with the Principal, and can view sensitive data. |
| **Accounts Officer** | Handles all fee work: enters and updates fee heads, vehicle places, and yearly amounts for the Principal's approval; records the Admission Fee and later payments; issues receipts and the final fees receipt; views outstanding dues; raises concession and refund requests. *(The client said "Principal/admin" maintains the fee data. We assume the admin is the Accounts Officer. To confirm.)* |
| **System Administrator (technical)** | Creates user accounts and resets passwords only. Cannot view sensitive data or delete anything. *(Added by the project team, to confirm.)* |

### 7.1 Permission matrix

| Action | Admission Officer | Accounts Officer | Principal |
| --- | --- | --- | --- |
| Create/edit draft application | Yes | No | Yes |
| Upload documents, track missing ones | Yes | No | Yes |
| Submit application for verification | Yes | No | No |
| Approve / reject / hold, set grade placement | No | No | Yes |
| Set seat limits | No | No | Yes |
| View sensitive data (Aadhaar, caste, income, certificate numbers, bank details) | Yes | No | Yes |
| Manage receipt types, fee heads, vehicle places, and yearly amounts | No | Yes | Approve |
| Record payments and issue receipts and the final fees receipt | No | Yes | View |
| View outstanding dues | No | Yes | Yes |
| Raise concession / extra-charge request | No | Yes | Yes (records directly) |
| Approve concession / extra charge / exception | No | No | Yes |
| Request refund or payment correction | No | Yes | Yes |
| Approve refund or payment correction | No | No | Yes |
| Request TC | Yes | No | Yes |
| Review TC (step 1) | Yes | No | No |
| Approve / issue TC (step 2) | No | No | Yes |
| Delete any record | No | No | No |

---

## 8. Business Requirements

Priority: **M** = Must have, **S** = Should have. Requirements marked *(CR-001)* were added or changed in version 1.4.

### 8.1 Access and academic year

| ID | Requirement | Priority |
| --- | --- | --- |
| BR-01 | Users log in with individual credentials; each user has one defined role. | M |
| BR-02 | After login, the user selects the academic year. All data shown and entered belongs to that year. | M |
| BR-03 | The system shows only the menus and actions permitted for the user's role. | M |
| BR-04 | Sensitive fields (Aadhaar, caste, sub-caste, income details, caste/income certificate number and files, and the student's bank details) are visible only to the Principal and Admission Officer. *(CR-001)* | M |

### 8.2 New admission

| ID | Requirement | Priority |
| --- | --- | --- |
| BR-05 | Capture the details on the school's **admission form**: application number and date, student name, father's and mother's names, date of birth, gender, religion, sub-caste, blood group, Aadhaar number, caste/income certificate number, bank name, account number and IFSC code, parent mobile numbers (two), **STS number**, previous school name, previous class and **previous school DISE number**, class to be admitted, address with pincode, and the transportation mode. Other details the school asks for can be added. *(CR-001)* | M |
| BR-06 | Capture **parent details**: father's full name, mother's full name, contact numbers, and occupation where the school requires it. | M |
| BR-07 | Allow **document attachments**: DOB proof, Aadhaar, caste certificate, income certificate, passport-size photo, a scan of the signed admission form, and other required documents. *(CR-001)* | M |
| BR-08 | Show which required documents are missing for each application. | M |
| BR-09 | Applications can be saved as **drafts** and edited until submitted. | M |
| BR-10 | The Admission Officer submits the application for verification; the Principal can **approve, reject, or put it on hold** and decides grade placement under school policy. | M |
| BR-11 | Every status change records the date, time, and user. | M |
| BR-12 | An approved application becomes an **admitted student** and receives a unique admission number in the format ADM-YYYY-NNNN (example: ADM-2026-0001). **No payment is required for admission.** *(CR-001)* | M |
| BR-38 | **Seat limit.** The maximum is **100 seats for each of the three sections** (Pre-primary, Primary, High School) per academic year. The Principal can change the limit. The system shows seats used and available, and blocks approval of an application when the section is full. *(Interpretation to be confirmed, see Section 16.2.)* | M |

**Application statuses:** Draft, Submitted, On Hold, Approved, Rejected, Admitted, Left/Transferred.

### 8.3 Fee management

| ID | Requirement | Priority |
| --- | --- | --- |
| BR-41 | **Receipt types.** The school collects fees through separate receipts: **Fees, Books, and Vehicle**. Each fee head belongs to one receipt type. The Principal or admin can add and update receipt types in the application, so other forms the school uses can be added without new software. *(CR-001)* | M |
| BR-42 | **Fee heads.** The starting fee heads come from the school's receipt books. **Fees:** Admission Fee, Tuition Fee, Medical Fee, Sports Fee, Library Fee, Lab Fee, Exam Fee, Student's Welfare Fund, Teacher Welfare Fee, Misc. **Books:** Note Book, Text Book, Private Book, Uniform, Stationery, Misc. **Vehicle:** Vehicle Fees (by place), Misc. The Principal or admin can add, rename, and re-price heads. *(CR-001)* | M |
| BR-13 | The Principal decides the fee amounts for each standard and year. The Accounts Officer enters and updates them in the application, and the Principal approves each yearly fee structure. Amounts can change from year to year. *(CR-001)* | M |
| BR-14 | The fee breakdown is grouped by receipt type and lists every fee head with its amount. *(CR-001)* | M |
| BR-15 | The vehicle fee applies **only** to students who use the school vehicle. *(Place-based pricing: see BR-44.)* | M |
| BR-44 | **Vehicle fee by place.** The vehicle fee depends on the student's place. The Principal or admin add and update the places and their amounts in the application. *(CR-001)* | M |
| BR-16 | The system displays each fee head and the **total payable amount** for the student. | M |
| BR-37 | **Admission Fee.** The Admission Fee has **no fixed amount or percentage**: the parent pays any amount, and that amount is recorded as the Admission Fee. In the school's process it is normally paid first, but there is **no mandatory initial payment** and no payment is required for admission. *(CR-001, replaces the earlier fixed first payment.)* | M |
| BR-17 | **Payments follow the school's process.** The Admission Fee is normally paid first (the system does not require it). Later, as parents pay the other fees, each amount is added to the particular fee head. Payments can be any amount at any time within the academic year. There is no installment schedule. *(CR-001)* | M |
| BR-43 | **Payments by fee head.** Each payment belongs to one receipt type and states the amount paid on each fee head, as on the paper receipt. The system tracks billed, paid, and balance for every head and in total. A fixed fee head cannot be overpaid. *(CR-001)* | M |
| BR-18 | The Accounts Officer records each payment: receipt type, amount per fee head, date, payment mode (cash, UPI, card), reference, and name and contact of the payer. *(CR-001)* | M |
| BR-19 | After each payment the system deducts the amounts and shows the **remaining balance** per fee head and in total. *(CR-001)* | M |
| BR-20 | Fee status is shown as **Not Paid, Partly Paid, or Fully Paid**. | M |
| BR-39 | **Fees are tracked within the academic year.** Fees are charged and paid within one academic year, and payment dates must fall inside that year. The system **never carries an unpaid balance into another year**. How unpaid fees are handled at year end is managed by the school outside the system. | M |
| BR-40 | **Fee negotiation.** Parents may negotiate the remaining fee with the Principal. Any agreed reduction is recorded as a Principal-approved concession on a fee head, with a reason. *(CR-001)* | M |
| BR-21 | Any concession, extra charge, or exception is approved **only by the Principal** and is recorded with a reason. | M |
| BR-22 | Mistakes and refunds are handled by **reversal/adjustment entries** approved by the Principal. Original payment entries are never edited or removed. *(Refund policy to be confirmed.)* | M |
| BR-23 | Users cannot authorize their own refunds or concessions, except that the Principal, as the final authority, may record a negotiated concession directly; this is logged. | M |

### 8.4 Receipts

| ID | Requirement | Priority |
| --- | --- | --- |
| BR-24 | A receipt is generated for every payment, one per receipt type, using that receipt's layout (Fees, Books, or Vehicle). *(CR-001)* | M |
| BR-45 | **Unique receipt numbers.** Every receipt, including the final fees receipt, has its own unique number in the format RCT-YYYY-NNNNNN (example: RCT-2026-000001), taken from one series. *(CR-001)* | M |
| BR-46 | **Final fees receipt.** One final fees receipt is issued for each student's fee. It lists every fee head with its amount, the total, and the **numbers of all the other receipts** it includes. It is issued **only when the fee is fully paid** (confirmed by the client). *(CR-001)* | M |
| BR-25 | A **fee statement** can be printed at any time. It shows every fee head with billed, paid, and balance, and each payment with date, mode, and who paid (name and contact). *(CR-001)* | M |
| BR-47 | **Receipt layout.** Receipts follow the school's format: serial number, particulars, amount, total, the total **in words** ("Rupees in Words"), and signature lines for the **payer, the Cashier, and the Manager (the Principal)**. The layouts are the school's exact forms, confirmed by the client. *(CR-001)* | M |
| BR-26 | Documents use the school's **letterhead and format** (supplied by the Client) and are printable. | M |
| BR-27 | Receipts and statements can be reprinted any time and are marked as duplicates when reprinted. | S |

### 8.5 Student records

| ID | Requirement | Priority |
| --- | --- | --- |
| BR-28 | Staff can search for students by name, admission number, STS number, standard, or year. *(CR-001)* | M |
| BR-29 | A student profile shows details, documents (subject to role), fee status by head, payment history, and status history. *(CR-001)* | M |
| BR-30 | No student, fee, or payment record can be deleted, even when a student leaves. Students who leave are marked inactive/left. | M |
| BR-31 | All creates and updates are recorded in an audit log (who, what, when). | M |

### 8.6 Leaving / Transfer Certificate (LC/TC)

| ID | Requirement | Priority |
| --- | --- | --- |
| BR-32 | **For every student, for each academic year,** an LC/TC record and document is generated and kept so that it can be retrieved later. A certificate for a student who leaves during the year is generated the same way. *(CR-001, per the project change record of 14 October)* | M |
| BR-33 | The TC request goes through **Admission Officer review and Principal approval**. | M |
| BR-34 | The TC is generated automatically from stored student data in a standard format, with a TC number in the format TC-YYYY-NNNN (example: TC-2026-0001) and issue date. Generating a certificate does **not** change the student's status; leaving the school is a separate event. | M |
| BR-35 | A generated TC can be found by student and academic year, viewed, and reprinted at any time; reprints are marked as duplicate copies. | M |
| BR-36 | Whether a TC can be issued with unpaid dues is decided by school policy and will be configured accordingly. *(Open item.)* | S |

---

## 9. Process Flows

### 9.1 Admission, from the first form to the final fee

**Admission form** (Admission Officer enters student, parent, and document details) → **Submitted** → **Principal review** (seat check) → **Approved / Rejected / On Hold** → fee generated from the fee structure (Fees, Books, and the Vehicle fee for the student's place if the school vehicle is used) → **Admitted** (admission number issued at approval; no payment required) → payments recorded as the parent pays, any amount on any fee head, the Admission Fee normally first → **final fees receipt**

### 9.2 Fee

**Principal decides fee heads, places, and amounts; Accounts Officer enters them; Principal approves** → fee assigned to student at approval → parent pays **at any time within the academic year**, the Admission Fee normally first, with **no mandatory initial payment**; each payment is recorded for one receipt type and added to the particular heads → balance updated per head and in total → a **numbered receipt** for each payment → when fully paid, the **final fees receipt** lists every head, the total, and all receipt numbers.

**Negotiation:** parent discusses remaining fee with the Principal → agreed reduction recorded as a Principal-approved concession on a fee head → balance recalculated.

**Refund or correction:** request → Principal approval → reversal entry recorded.

**Year end:** managed by the school outside the system. The system keeps each year's records separately and never adds a balance from one year to another.

### 9.3 Transfer/Leaving Certificate

**Year end:** a certificate record is created for every student of the academic year → dues check (per policy) → Admission Officer review → Principal approval → LC/TC generated and kept → retrievable by student and year at any time. A student who actually leaves is marked Left/Transferred as a separate event.

---

## 10. Data and Record-Keeping Rules

1. **No deletion.** Data is never deleted from the database. Records are archived or marked with a status.
2. **Payment ledger is append-only.** Corrections are made through reversal entries.
3. **Dates are recorded** for every admission, status change, payment, concession, and certificate.
4. **Year-wise storage.** Each year's data is separate and retrievable when that year is selected.
5. **No carry-forward.** Balances are never moved between years by the system.
6. **Audit trail.** Key actions are logged with user and timestamp. Sensitive values (Aadhaar, bank details) are never written into the log.
7. **Backups.** Database and file backups are the responsibility of the Client and school. The setup guide includes a recommendation, but Intallo does not operate backups.

### 10.1 Number formats (configurable)

| Item | Format | Example | Source |
| --- | --- | --- | --- |
| Application number | N/YYYY-YY (sequence, then academic year) | 161/2026-27 | School's admission form *(CR-001)* |
| Admission number | ADM-YYYY-NNNN | ADM-2026-0001 | Confirmed by the client |
| Receipt number | RCT-YYYY-NNNNNN | RCT-2026-000001 | Confirmed by the client. One series for every receipt, including the final fees receipt *(CR-001)* |
| TC number | TC-YYYY-NNNN | TC-2026-0001 | Confirmed by the client |

YYYY is the year in which the academic year starts (for 2026-27, it is 2026). Each sequence restarts at 1 every academic year.

---

## 11. Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| **Platform** | Web application for desktop browsers on school computers; latest Google Chrome supported |
| **Language** | English only |
| **Connectivity** | Requires internet access |
| **Security (application)** | Password-protected accounts, role-based and field-level access, secure file handling, and support for running behind HTTPS. The HTTPS certificate and server security are set up by the Client at deployment |
| **Usability** | Simple forms usable by non-technical office staff; clear error messages. Receipt entry mirrors the paper receipt |
| **Performance** | Common screens load within a few seconds under normal usage. Actual speed depends on the hosting chosen by the Client |
| **Printing** | Receipts and certificates generate as A4 PDFs matching the approved layout. Printing on the school's physical printers is checked by the school at deployment |
| **Reliability** | Data integrity is prioritized; no loss on failed or repeated actions. A payment, its receipt number, and any admission are saved together or not at all |

---

## 12. Assumptions, Constraints, Dependencies, and Responsibilities

**Assumptions**

- Payments are made offline; the system does not process money.
- The Client is the single decision-maker for approvals, feedback, and change requests, and is authorized to act for the school.
- The Admission Fee and the Misc. heads have no fixed price. The amount paid is the amount billed.
- Each payment covers one receipt type. A parent who pays for fees and books together gets two receipts, as with the paper receipt books.
- The vehicle receipt's "Place" is the student's place (village or stop) and determines the vehicle fee.
- Books and uniform items are fixed per standard. *(To confirm.)*
- The final fees receipt is issued only when the fee is fully paid (confirmed by the client), and a statement can be printed at any time.
- The admission number is issued when the Principal approves the application. No payment is required for admission (project change record, 14 October).
- Demonstrations and acceptance testing use a temporary environment provided by Intallo (or a screen-share), which is closed after handover.

**Constraints**

- The project delivers **source code only**. Intallo does not deploy, host, or operate the system.
- Fake data is used during development and demonstration. The school's real forms contain personal data and must not be placed in the code, test data, or shared project tools.

**Dependencies (provided by the Client)**

- School letterhead (high-resolution file) and **full-page images** of the fees, books, and vehicle receipts (the samples received are cropped at the top)
- A blank admission form and the list of required documents for each section
- The list of vehicle places and their amounts, and the fee amounts for each standard, when the school is ready to configure them
- Confirmation of the TC format (see open items)
- Timely feedback and sign-offs at each milestone

### 12.1 Responsibilities

| Area | Intallo | Client / School |
| --- | --- | --- |
| Requirements | Documents and clarifies them | Supplies them, confirms them, and signs off |
| Software development and testing | Yes | Acceptance testing and sign-off |
| Source code and handover package | Delivers | Receives and owns, as set in the contract |
| Deployment, hosting, domain, HTTPS | No | Yes |
| Database setup, backups, restore | No | Yes |
| Security of the live environment | No | Yes |
| Real data entry or migration | No | Yes |
| Entering fee heads, places, and amounts | Provides the screens | Yes |
| User training and manuals | No | Yes |
| Running and supporting the live system | No | Yes |
| Defects in the delivered code | Fixes within the warranty period | Reports them in writing |
| Protection of personal data in the live system | Provides access controls in the code | Responsible as the operator of the system |
| New features and changes | Quotes and builds via change request | Raises and approves via the Client |
| Promotion, year-end handling of unpaid fees | No | Yes (outside the system) |

---

## 13. Risks

| Risk | Impact | Mitigation | Owner |
| --- | --- | --- | --- |
| Requirements come through an intermediary; the school may later disagree | Rework or disputes after delivery | Client signs the BRD and SRS and confirms he is authorized to represent the school; all changes come only through the Client; consider one demo to school staff arranged by the Client | Project Manager |
| "And many more" forms are not yet listed | Scope growth | Receipt types are configurable, so new ones need no code. Ask the Client for the full list now | Project Manager |
| Receipt layouts are not fully known (samples are cropped) | Rework of printed documents | Obtain full-page images and a filled sample (with fake or masked data) before building the print layouts | Client |
| CR-001 adds effort (head-wise payments, three receipt types, final receipt) | Schedule and cost impact | Re-estimate with the tech lead and agree the commercial treatment in writing before building | Project Manager |
| No backups on the Client's hosting | Permanent data loss despite the "never delete" rule | Responsibility is the Client's in writing; the setup guide recommends backups | Client |
| Sensitive data (Aadhaar, caste, income, bank details) exposed in the live environment | Privacy and legal issues for the operator | Field-level permissions, encrypted fields, and audit log in the code; server security and legal compliance belong to the Client | Client |
| Real personal data in sample forms shared with the project | Privacy breach | Do not store real forms in the repository or tools; request blank forms or redacted copies | Project Manager |
| Differences between demo and the Client's environment (browser, printer, settings) | Issues found only after deployment | Setup guide with clear configuration; supported browser stated; printing checked by the school | Client |
| No existing TC format | Rework late in the project | Obtain the prescribed format early and approve a sample | Client |
| Accounts Officer both sets fees and records payments (accepted by the Client) | Weaker separation of duties | Client accepted this. The code keeps the Principal's approval of the fee structure and a full audit log | Client |
| Seat-limit meaning misunderstood | Wrong approvals blocked or allowed | Limit is configurable; Client to confirm interpretation | Client |
| Delayed client feedback | Schedule slip | Fixed demo days and a single decision-maker | Project Manager |

---

## 14. Change Management

Changes after sign-off must be submitted by the Client as a written change request. The project manager assesses the impact on cost and schedule, and work begins only after the Client approves in writing. Requests made directly by school staff are not accepted unless the Client confirms them.

**CR-001 (this version)** records the client's answers of 15 October 2026 and the sample forms. It removes one feature (the fixed first payment) and adds others (receipt types, head-wise payments, vehicle fee by place, final fees receipt, receipt numbering and layout, extra form fields). The effort and any change to cost or schedule will be confirmed in writing after the tech lead's estimate.

---

## 15. Acceptance Criteria

The software is accepted when the Client confirms the following on the delivered build:

1. All "Must have" requirements in Section 8 work as described.
2. Each role can perform only the actions permitted in the permission matrix.
3. A full test scenario passes end to end: admission form, Principal approval, payments on Fees, Books, and Vehicle receipts (including the Admission Fee), final fees receipt, and the year's LC/TC.
4. Fee totals, balances, and statuses are correct per fee head and in total in all tested cases, including a student with the school vehicle at a given place, a student without it, and after a Principal-approved concession.
5. The Admission Fee accepts any amount, and a student can be admitted and can pay any fee head without any required first payment.
6. A fixed fee head cannot be overpaid, and a payment is added to the correct fee head.
7. Every receipt has a unique number, and the final fees receipt lists the numbers of all the other receipts and shows the total in words.
8. The system blocks approval once a section reaches its seat limit.
9. No balance from one academic year appears in another year's fee.
10. No user interface or function allows deleting student, fee, or payment records.
11. Receipts, the final fees receipt, and TCs generate as A4 PDFs matching the layout approved by the Client.
12. The source code, database scripts, seed script, setup guide, and technical notes are delivered and the setup guide works on a clean machine.
13. The Client signs the acceptance in writing.

---

## 16. Client Decisions and Open Items

### 16.1 Decisions received from the client

| # | Topic | Client decision | Where applied |
| --- | --- | --- | --- |
| 1 | Clerk vs Admission Officer | Same role. Use **Admission Officer** | Section 7 |
| 2 | Fee Clerk vs Accounts Officer | Same role. Use **Accounts Officer** | Section 7 |
| 3 | Installments | Parents pay the rest any time within the academic year | BR-17 |
| 4 | Further fees | Approved **only by the Principal** | BR-21 |
| 5 | Refunds and corrections | Parents may negotiate the remaining fee with the Principal | BR-40 |
| 6 | Dues carry-forward | Fees must be paid within the academic year only | BR-39 |
| 7 | Seat limit | 100 seats maximum for the 3 sections | BR-38 |
| 8 | Number formats | ADM-YYYY-NNNN, RCT-YYYY-NNNNNN, TC-YYYY-NNNN; configurable | Section 10.1 |
| 9 | Continuing students | Carry-forward and promotion are handled by the school | Sections 4, 6.2 |
| 10 | Separation of duties and deployment | Deployment and operations are handled by the Client side | Sections 6.2, 12.1 |
| 11 | Delivery model | **Project source code only** | Sections 2.1, 6.3 |
| 12 | Contracting | Intallo's commitment is with the Client only | Section 2.1 |
| 13 | **Admission Fee** *(15 Oct)* | The parent pays any amount. The initial 10% fee is removed | BR-37 |
| 14 | **Forms and receipts** *(15 Oct)* | There are separate forms (admission, fees, books, vehicle, and more). Information is collected from the admission form to the end, and **one final fees receipt** contains the amounts of all the other receipts | BR-41, BR-46 |
| 15 | **Part payments** *(15 Oct)* | The Admission Fee is paid first; later payments are added to the particular fee head. The project change record (14 Oct) adds: no mandatory initial payment | BR-17, BR-43 |
| 16 | **Maintaining fee data** *(15 Oct)* | Decided by the Principal/admin, who add and update the data in their interface | BR-13, BR-42, BR-44 |
| 17 | **Receipt numbers** *(15 Oct)* | One unique number for each receipt; the final fees receipt lists the receipt numbers of all the others | BR-45, BR-46 |
| 18 | **Payer's signature** *(15 Oct)* | The payer's signature is needed on receipts, in addition to the Cashier and the Manager | BR-47 |
| 19 | **Annual LC/TC** *(project change record, 14 Oct)* | An LC/TC is generated for every student for each academic year and kept for later retrieval. Generating it does not mark a continuing student as Left/Transferred | BR-32, BR-34, BR-35 |
| 20 | **Form layouts** *(22 Oct)* | The mock-ups of the Fees, Books, and Vehicle receipts and of the admission form are the exact forms used in the current admission process | BR-05, BR-24, BR-47 |
| 21 | **Manager** *(22 Oct)* | The "Manager" who signs the receipts is the Principal | BR-47 |
| 22 | **Final fees receipt** *(22 Oct)* | The school gives the parent the final fees receipt **only after all fees are fully paid** | BR-46 |

### 16.2 Open items (to be confirmed with the client)

| # | Question | Impact |
| --- | --- | --- |
| 1 | **What other forms or receipts exist** besides admission, fees, books, and vehicle ("and many more")? | Receipt types, scope |
| 2 | *Closed on 22 October: the final fees receipt is given only after all fees are fully paid. A statement can still be printed at any time.* | BR-46 |
| 3 | Who is the **"admin"** who maintains fee heads, places, and amounts: the Accounts Officer, the Principal, or someone else? | Roles |
| 4 | Are **books and uniform items** compulsory and fixed for every student of a standard? | Fee structure |
| 5 | On the vehicle receipt, is **"Place"** the student's place, and is the fee set per place only, or per place and standard? | BR-44 |
| 6 | *Closed on 22 October: the Manager who signs the receipts is the Principal.* | BR-47 |
| 7 | If an approved student never joins, how is the seat released? (Proposed: the Admission Officer marks the student Left/Transferred, which frees the seat.) | Seat control |
| 8 | Is the **Admission Fee refundable** if the student withdraws? How are wrong entries corrected (proposed: Principal-approved reversal)? | Refunds |
| 9 | Does **"100 seats for the 3 sections"** mean 100 per section (300 in total), 100 in total, or 100 per class? | Seat limit |
| 10 | Can a **TC** be issued when fees are unpaid? (Proposed: system warns, and the Principal may override with a reason) | TC rules |
| 11 | The admission form has **religion and sub-caste but no separate caste**. Is a caste or category needed? Where are parent occupation, income, and transport mode collected? | Admission fields |
| 12 | Are there **minimum age limits** per class that the system should check? | Validation |
| 13 | Final list of **application statuses** (proposed list in Section 8.2)? | Workflow |
| 14 | **TC format**, numbering, and duplicate marking (check the Karnataka education department's prescribed format) | TC design |
| 15 | **Letterhead file**, and how the header and footer of each receipt print (the sample images are cropped), plus a blank admission form. *The layouts themselves were confirmed on 22 October.* | Print design |
| 16 | **Mandatory and optional documents** per section; allowed file types and sizes | Upload rules |

---

## 17. Glossary

| Term | Meaning |
| --- | --- |
| **LC / TC** | Leaving Certificate / Transfer Certificate issued when a student leaves the school |
| **Receipt type** | One of the school's receipt books: Fees, Books, Vehicle (more can be added) |
| **Fee head** | One line on a receipt, such as Tuition Fee or Uniform |
| **Admission Fee** | A fee head with no fixed amount: the parent pays any amount. Normally paid first, but never required for admission |
| **Final fees receipt** | The one receipt that shows every fee head, the total, and the numbers of all the other receipts |
| **STS number** | The state's Student Tracking System number of the student |
| **DISE number** | The identification number of the previous school |
| **Concession** | Reduction in fees approved by the Principal |
| **Reversal entry** | A new entry that cancels or corrects an earlier payment, instead of editing it |
| **Audit log** | A record of who did what and when in the system |
| **Seed script** | A script that loads fake sample data for demos and testing |
| **Soft delete** | Marking a record inactive instead of removing it from the database |
| **Handover package** | The set of deliverables listed in Section 6.3 |

---

## 18. Sign-off

By signing, the Client confirms that the requirements in this document reflect the needs of ABC English Medium School, that he is authorized to approve them on the school's behalf, and that he accepts the delivery model and responsibilities in Sections 2.1, 6.2, and 12.1, and the change request CR-001 described in Section 14.

| Name | Role | Signature | Date |
| --- | --- | --- | --- |
| Shashidhar Pawadashetti | CEO and Project Manager, Intallo | SP | 22 October 2026 |
| Rakesh Aralikatti | Client, acting for ABC English Medium School | RA (approved remotely) | 22 October 2026 |

*Approved remotely on 22 October 2026. SP and RA are the signatories' initials, recorded because physical signing was not possible.*