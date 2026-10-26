# Software Requirements Specification (SRS)

## School Admission & Fee Management Portal

|  |  |
| --- | --- |
| **Client (contracting party)** | Rakesh Aralikatti, acting for ABC English Medium School |
| **Prepared by** | Shashidhar Pawadashetti, CEO and Project Manager, Intallo |
| **Version** | 1.4 (Change Request CR-001) |
| **Date** | 15 October 2026 |
| **Based on** | BRD v1.4 (BR-01 to BR-47) |
| **Status** | **Approved** by the client on 22 October 2026 (remote approval) |

### Revision history

| Version | Date | Summary of change |
| --- | --- | --- |
| 1.0 | 13 October 2026 | Initial draft based on BRD v1.0 |
| 1.1 | 13 October 2026 | Roles merged; seat limit (US-42); number formats confirmed |
| 1.2 | 13 October 2026 | Code-only delivery model. Year-end closure (US-43) withdrawn |
| 1.3 | 14 October 2026 | Version issued for signature |
| 1.4 | 15 October 2026 | **CR-001.** *Updated 22 October: the receipt and admission form layouts are confirmed as the exact forms in use, and the Manager who signs receipts is the Principal. The final fees receipt is issued only when all fees are fully paid.* *Aligned with the project change record of 14 October: no payment is required for admission, and a year-specific LC/TC is generated for every student each academic year (US-15, US-21, US-34 to US-37).* Fixed 10% first payment removed; Admission Fee is any amount. Payments recorded per fee head and receipt type (Fees, Books, Vehicle). Final fees receipt and a unique number for every receipt. Vehicle fee by place. New admission form fields (STS number, DISE number, certificate number, bank details, application date). Application number follows the school's format. Receipts carry payer, Cashier, and Manager signature lines. Stories changed: US-07, 08, 10, 15, 17 to 29, 30, 31, 41. US-19 now manages vehicle places. US-28 is now the final fees receipt and statement |

---

## 1. Introduction

### 1.1 Purpose

This SRS translates the BRD into detailed, testable software requirements. It is written for the development team, designer, and QA, and gives the Client a precise view of how the system will behave. Each user story links back to a BRD requirement ID.

### 1.2 Scope

A web application for ABC English Medium School covering year-based admissions, seat control, fee assignment by fee head and receipt type, offline payment recording, receipts and a final fees receipt, student records, and Transfer/Leaving Certificates. It does not process online payments. See BRD Section 6 for in-scope and out-of-scope items.

### 1.3 Delivery model

Intallo delivers **project source code and a handover package** (BRD Section 6.3). The Client and school deploy, host, secure, back up, operate, and maintain the system. Requirements in this document describe what the **code** must do.

### 1.4 How to read this document

- **US-xx**: a user story, written as "As a \[role\], I want \[goal\], so that \[benefit\]".
- **AC**: acceptance criteria, written so QA can turn each one into a test case.
- **BR-xx**: the BRD requirement that the story satisfies.
- **P1 / P2 / P3**: build priority. P1 is the MVP core, P2 is required for release, P3 is a should-have.
- Amounts are shown in rupees as "Rs.".

---

## 2. Overall Description

### 2.1 Product perspective

A standalone web application with a database and a file store, accessed through a desktop browser (latest Chrome) on school computers with internet. The Client deploys and operates it.

### 2.2 User classes

| Role | Code | Summary |
| --- | --- | --- |
| Principal | PRINCIPAL | Final authority on admissions, seat limits, fee decisions, concessions, refunds, and TCs |
| Admission Officer | ADM | Creates and processes applications, requests and reviews TCs, sees sensitive data |
| Accounts Officer | ACC | Enters fee heads, places, and amounts; records all payments; issues receipts and the final fees receipt; raises concession and refund requests |
| System Administrator (technical) | SYSADMIN | Creates user accounts and resets passwords. Cannot view sensitive student data or delete anything. *(Added by the project team, to confirm)* |

### 2.3 Operating environment

Desktop browsers (latest Chrome), screen width 1366 px and above, internet connection. The server, database, and hosting are chosen and operated by the Client.

### 2.4 Constraints

- English only
- No deletion of student, fee, or payment data under any circumstance
- Payments are recorded only. No money is processed by the system
- Source code delivery only; deployment and operations are outside Intallo's scope

---

## 3. Decisions and Working Assumptions

**Status key:** *Confirmed* = decided by the Client. *Working* = our default, to be confirmed. *Open* = no answer yet.

| ID | Topic | Decision or assumption | Status |
| --- | --- | --- | --- |
| A-01 | Admission Clerk vs Officer | One role: **Admission Officer** (ADM) | Confirmed |
| A-02 | Fee Clerk vs Accounts Officer | One role: **Accounts Officer** (ACC) | Confirmed |
| A-03 | Accounts Officer data visibility | Sees student name, admission number, class, and photo, but no sensitive fields | Working |
| A-04 | First payment and installments | **No fixed first payment and no installment schedule.** The Admission Fee is any amount the parent pays; later payments are any amount at any time within the academic year, added to the particular fee head. **There is no mandatory initial payment**, and no payment is required for admission | Confirmed (15 Oct; project change record 14 Oct) |
| A-05 | Further fees | Concessions, extra charges, and exceptions are approved **only by the Principal**, with a reason | Confirmed |
| A-06 | Refunds and corrections | Parents can negotiate the remaining fee with the Principal; the agreed reduction is a Principal-approved concession on a fee head. Refunds and corrections use reversal entries approved by the Principal. The Principal may also record a negotiated concession directly (logged) | Negotiation confirmed; refund policy Working |
| A-07 | Carry-forward and year end | The system **never carries balances across years**. Handling of unpaid fees at year end is done by the school outside the system | Confirmed |
| A-08 | Seat limit | Maximum **100 seats per section** (Pre-primary, Primary, High School) per academic year, configurable by the Principal | Confirmed (interpretation to be verified) |
| A-09 | Age limits | No age rule supplied. Age is calculated and recorded. A configurable minimum-age warning exists but is switched off until the school provides rules | Open |
| A-10 | Number formats | Admission ADM-YYYY-NNNN, receipt RCT-YYYY-NNNNNN, TC TC-YYYY-NNNN. YYYY is the year the academic year starts. **Application number follows the school's form: sequence/academic year (161/2026-27).** Sequences restart each academic year. Configurable | Confirmed |
| A-11 | Application statuses | Draft, Submitted, On Hold, Approved, Rejected, Admitted, Left/Transferred | Working |
| A-12 | Promotion of students | Handled by the school outside the system. Not built | Confirmed |
| A-13 | TC with unpaid dues | System warns and shows dues; Principal may override with a recorded reason | Working |
| A-14 | TC format | Standard format drafted by us; Client or education department reviews and approves before build | Working |
| A-15 | Letterhead and receipts | The layouts of the receipts and the admission form are **confirmed as the exact forms in use** (mock-ups approved 22 Oct). The Client still provides the high-resolution letterhead and how each receipt's header and footer print (the samples are cropped) | Layouts Confirmed; letterhead Open |
| A-16 | Documents | Allowed types PDF, JPG, PNG; max 5 MB per file. Mandatory: DOB proof, Aadhaar, passport photo. Conditional: caste and income certificates, previous school documents. Optional: signed form scan, other. Configurable per section | Working |
| A-17 | Admission confirmation | A student becomes **Admitted** and receives an admission number **when the Principal approves** the application. No payment is required for admission | Confirmed (project change record 14 Oct) |
| A-18 | Seat counting | A seat is used by an application that is Approved or Admitted. Left/Transferred frees the seat. Approval is blocked when a section is full. If an approved student never joins, the Admission Officer marks the student Left/Transferred to free the seat | Working |
| A-19 | Delivery model | Source code and handover package only. Deployment, hosting, backups, security of the live environment, and operations are handled by the Client | Confirmed |
| A-20 | Demo environment | Demos and acceptance testing run on a temporary Intallo environment or screen-share, closed after handover | Working |
| A-21 | First administrator | The first administrator account is created by a setup script run by whoever deploys the system, and the password must be changed at first login | Working |
| A-22 | Receipt types | The school's receipts are **Fees, Books, and Vehicle**. More can be added in the application. Each fee head belongs to one receipt type | Confirmed (15 Oct); full list of forms Open |
| A-23 | Who maintains fee data | The Principal decides; the Accounts Officer enters and updates; the Principal approves. "Admin" in the client's answer is taken to mean the Accounts Officer | Working |
| A-24 | Variable heads | The Admission Fee and the Misc. heads have no fixed price. The amount paid is the amount billed | Working |
| A-25 | One receipt per payment | A payment covers one receipt type. Fees and books paid together are recorded as two payments and get two receipts | Working |
| A-26 | Payment order | The Admission Fee is normally paid first in the school's process, but the system does not enforce any order. Any fee head can be paid at any time after the student's fee is generated | Confirmed (project change record 14 Oct) |
| A-27 | Vehicle "Place" | The "Place" on the vehicle receipt is the student's place; the vehicle fee is priced per place (and per standard where needed). It is billed only if the student uses the school vehicle | Working |
| A-28 | Final fees receipt | Issued when the fee is fully paid, with its own number from the same receipt series and the numbers of all the other receipts. A statement (not numbered) can be printed at any time | Confirmed (22 Oct) |
| A-29 | Receipt layout | Serial number, particulars, amount, total, "Rupees in Words", and signature lines for the **payer, the Cashier, and the Manager**. The payer's signature is signed by hand on the printout. The Manager is the Principal | Confirmed (15 Oct payer signature; 22 Oct Manager) |
| A-30 | Books and uniform | Fixed per standard and compulsory for every student of the standard | Working |
| A-31 | Concessions | A concession or extra charge is applied to one fee head | Working |
| A-32 | Sample data | The school's real admission form contains personal data. It is not stored in the code, tests, or project tools. Demo data is fake | Confirmed |
| A-33 | Annual certificate | An LC/TC is generated for every student for each academic year and kept for later retrieval. Generating it does not mark a continuing student as Left/Transferred. The final template and field list come from the school's approved TC format | Confirmed (project change record 14 Oct); template Open |

---

## 4. System-Wide Business Rules

| ID | Rule |
| --- | --- |
| R-01 | **No hard delete.** No screen, API, or database role used by the application may delete student, parent, document, fee, payment, approval, or certificate records. Removal is represented by a status (inactive, archived, reversed, cancelled). |
| R-02 | **Append-only ledger.** A payment and its fee head lines, once saved, cannot be edited or removed. Corrections are new entries linked to the original. |
| R-03 | **Everything is year-scoped.** Admissions, fee assignments, payments, and certificates belong to one academic year. |
| R-04 | **Every action is dated.** Creation, status changes, payments, approvals, and certificate issue store date, time, and user. |
| R-05 | **No self-approval.** The user who raises a concession, refund, or exception cannot approve it. The only exception is the Principal, who may record a negotiated concession directly; it is logged with a reason. |
| R-06 | **Sensitive fields.** Aadhaar, caste, sub-caste, income details, caste/income certificate number, the student's bank details, and the related document files are accessible only to ADM and PRINCIPAL. |
| R-07 | **Fee calculation.** For each fee head: Billed = fee structure amount (or amount entered for a variable head) + approved extra charges − approved concessions. Paid = payments − approved reversals/refunds. Balance = Billed − Paid. For the student: Net Payable is the sum of Billed over all heads, Net Paid the sum of Paid, and Balance = Net Payable − Net Paid. |
| R-08 | **Fee status.** *Not Paid* if Net Paid = 0; *Fully Paid* if Balance = 0; otherwise *Partly Paid*. |
| R-09 | **Vehicle fee.** Billed only when transportation mode is "School Bus" and a place is set; the amount is the price for that place. Adding the vehicle later adds the fee as a new billed item. Removing it later is a Principal-approved concession, not a silent edit. |
| R-10 | **Money handling.** All amounts are stored as exact decimals in INR (two decimals), never floating-point. |
| R-11 | **No overpayment of a fixed head.** A payment on a fixed head cannot exceed that head's outstanding balance. |
| R-12 | **Admission Fee.** The Admission Fee is a variable head: any amount the parent pays is accepted and billed as paid. It is normally paid first, but there is no mandatory initial payment and no payment is required for admission. |
| R-13 | **Flexible payments.** After admission, any amount can be paid on any fixed head up to its outstanding balance, on any date. The payment date must fall within the selected academic year's start and end dates and not be in the future. There are no installment schedules, due dates, or reminders. Variable heads (Admission Fee, Misc.) accept any amount. |
| R-14 | **No carry-forward.** The system never adds an unpaid balance from one year to another year's fee. |
| R-15 | **Seat limit.** An approval that would exceed the section's seat limit is blocked (see A-18). |
| R-16 | **Number formats.** Application, admission, receipt, and TC numbers follow the confirmed formats (A-10), are unique, and are never reused. All receipts, including the final fees receipt, use one receipt series. |
| R-17 | **One receipt type per payment.** A payment belongs to one receipt type, every fee head line must belong to that type, and the lines add up to the payment amount. |
| R-18 | **Final fees receipt.** Issued only when the fee is fully paid, once per student fee, listing every receipt number it includes (A-28). |
| R-19 | **Reversals by head.** A reversal or refund names the fee heads it reverses and cannot exceed what the original payment paid on each head. |

---

## 5. Functional Requirements and User Stories

### Module 1: Authentication and Access Control

**US-01 Login** (BR-01, P1) As any user, I want to log in with my own username and password so that my actions are attributed to me.

- AC1: Given valid credentials, when I log in, then I reach the year-selection screen.
- AC2: Given invalid credentials, then I see a generic error and no account hint.
- AC3: After 5 consecutive failed attempts the account locks for 15 minutes.
- AC4: Sessions expire after 30 minutes of inactivity.

**US-02 Role-based menus** (BR-03, P1) As a user, I want to see only the screens and actions that match my role so that I don't make unauthorized changes.

- AC1: Menu items outside my role are hidden.
- AC2: Direct URL or API access to a forbidden action returns "Access denied" and is logged.
- AC3: The permission matrix in BRD 7.1 is enforced on the server, not only in the interface.

**US-03 Sensitive data protection** (BR-04, P1) As the Principal, I want Aadhaar, caste, sub-caste, income, certificate number, and bank details hidden from unauthorized roles so that student privacy is protected.

- AC1: ACC and SYSADMIN users see none of these fields anywhere, including search results, receipts, and exports.
- AC2: Sensitive document files return "Access denied" to ACC and SYSADMIN even with a direct link.
- AC3: Every view of a sensitive field by an authorized user is written to the audit log.
- AC4: Aadhaar and bank account numbers are stored encrypted by the application and never appear in the audit log.

**US-04 Account management** (BR-01, P1) As a system administrator, I want to create users, assign one role each, deactivate users, and reset passwords so that access follows staff changes.

- AC1: Deactivating a user blocks login but preserves all of their history.
- AC2: Users cannot be deleted.
- AC3: Passwords are stored hashed; a minimum strength rule applies.
- AC4: A setup script creates the first administrator account, and the password must be changed at first login (A-21).

### Module 2: Academic Year

**US-05 Select academic year** (BR-02, P1) As a user, I want to select the academic year after login so that I only see and edit data for that year.

- AC1: The selected year is always visible in the header.
- AC2: Switching year reloads all lists and totals for that year.
- AC3: New records are created inside the selected year.

**US-06 Manage academic years** (BR-02, BR-39, P2) As the Principal, I want to create an academic year and mark one as current so that the school can start each year cleanly.

- AC1: A year has a label (for example 2026-27), start date, and end date.
- AC2: Years cannot be deleted. The Principal may mark a year as closed, after which it is read-only for payments, fee adjustments, and new applications.
- AC3: Only one year is "current" at a time, and years cannot overlap.
- AC4: Nothing is copied or carried from one year to another automatically (R-14).
- AC5: Creating a year creates its number sequences and a default seat limit of 100 for each section.

### Module 3: New Admission

**US-07 Create application** (BR-05, BR-09, P1) As an Admission Officer, I want to start a new application and choose the standard so that the right section and fee apply.

- AC1: Standard is chosen from Nursery, LKG, UKG, 1 to 10. Section (Pre-primary, Primary, High School) is derived automatically.
- AC2: A draft can be saved with only the minimum fields (student name and standard).
- AC3: A draft receives an application number on first save, in the school's format (for example 161/2026-27), and an application date that defaults to today and can be set to the date written on the form.
- AC4: The seats used and available for the section are shown on the screen (US-42).

**US-08 Enter student details** (BR-05, P1) As an Admission Officer, I want to record the details from the school's admission form so that the admission record is complete.

- AC1: Fields follow the school's form: student name, father's and mother's names, date of birth, gender (Male/Female), religion, sub-caste, blood group, Aadhaar number, caste/income certificate number, bank name, account number and IFSC code, STS number, address with pincode, class to be admitted, and transportation mode (School Bus, Public, Private, Walking).
- AC2: Previous school details: school name, previous class, and the previous school's DISE number (and TC number if any).
- AC3: Age is auto-calculated. A minimum-age warning appears only if the school has configured one (A-09).
- AC4: Required fields are marked, and invalid values (future DOB, non-numeric phone) are rejected with a clear message.
- AC5: The STS number must be unique; a duplicate shows a message naming the existing student.
- AC6: Aadhaar, caste, sub-caste, certificate number, and bank details are visible only to authorized roles (R-06).
- AC7: Religion is optional. No nationality or mother-tongue field is shown, since the school's form does not have them.

**US-09 Enter parent details** (BR-06, P1) As an Admission Officer, I want to record both parents' details so that the school can contact them and verify identity.

- AC1: Father's full name, mother's full name, and occupation of each where the school requires it.
- AC2: Parent mobile: two numbers can be entered (primary and alternate), as on the form.
- AC3: At least one valid 10-digit contact number is required before submission.
- AC4: Income details, if collected, are visible only to authorized roles.

**US-10 Upload documents** (BR-07, P1) As an Admission Officer, I want to attach the required proofs so that each application has verified documents.

- AC1: Document types: DOB proof, Aadhaar, caste certificate, income certificate, passport photo, previous school documents, signed admission form (scan), and others from the configurable list.
- AC2: Only PDF, JPG, PNG up to 5 MB are accepted (A-16); others are rejected with a message.
- AC3: A file can be replaced; the earlier file is kept as a previous version, not removed (R-01).
- AC4: Each upload stores the uploader and date.
- AC5: Files can be previewed and downloaded only by authorized roles.
- AC6: The folder where files are stored is set in the configuration and documented in the setup guide.

**US-11 Track missing documents** (BR-08, P1) As an Admission Officer, I want a checklist of required and missing documents so that I can follow up with parents.

- AC1: The application shows each required document as Received or Missing.
- AC2: A list view shows applications with missing documents, filterable by standard.
- AC3: Submission is blocked until mandatory documents are received. The officer may override only by marking a reason and sending the application to the Principal as "documents pending".

**US-12 Save and edit draft** (BR-09, P1) As an Admission Officer, I want to save my work and return later so that I don't lose partial entries.

- AC1: Drafts can be edited any number of times until submitted.
- AC2: Submitted applications are read-only for the officer. The Principal may return an application to Draft with a reason.

**US-13 Submit for verification** (BR-10, P1) As an Admission Officer, I want to submit a complete application so that the Principal can review it.

- AC1: Submission runs a completeness check and lists any missing fields.
- AC2: On success, the status becomes Submitted and the date, time, and user are recorded.
- AC3: The Principal's review queue shows the new application.

**US-14 Principal decision** (BR-10, BR-11, P1) As the Principal, I want to review a submitted application and approve, reject, or hold it so that admissions follow school policy.

- AC1: The review screen shows student details, parents, documents, seat availability for the section, and a short summary.
- AC2: I can choose Approve (with grade placement), Reject (reason required), or On Hold (reason required).
- AC3: Approve is blocked, with a clear message, if the section's seat limit is reached (R-15).
- AC4: Decision date, time, user, and remarks are saved to the status history.
- AC5: An On Hold application can later be moved to Approved or Rejected.
- AC6: Only the Principal can make this decision.

**US-15 Admission and fee generation on approval** (BR-12, BR-37, P1) As an Admission Officer, I want an approved application to become an admitted student with an admission number and a generated fee, so that payments can be recorded whenever the parent pays.

- AC1: On approval, the student's fee is generated from the year's approved fee structure for the standard the Principal placed the student in: every fixed fee head with an amount, and the Vehicle fee for the student's place if the school vehicle is used (R-09).
- AC2: In the same save, the system assigns the admission number (for example ADM-2026-0001) and sets the status to Admitted. **No payment is required.**
- AC3: Rejected applications stay in the records with their full history.
- AC4: Students who have not paid anything yet appear in the outstanding dues list (US-24) like any other student with a balance.
- AC5: If there is no approved fee structure for the year, approval and admission still complete. The student appears in a "Fee not generated" list, and the fee is generated as soon as a structure is approved.

**US-16 Application list and status view** (BR-08, BR-11, P1) As an Admission Officer or Principal, I want to filter applications by status, standard, and date so that I can see what is pending.

- AC1: Filters for status, standard, section, date range, and "Fee not generated".
- AC2: Counts per status are shown at the top of the list.
- AC3: Opening an application shows its complete status history with dates and users.

**US-42 Seat limits** (BR-38, P1) As the Principal, I want to set and monitor the seat limit for each section so that admissions never exceed the school's capacity.

- AC1: The Principal sets a seat limit per section per academic year. The default is 100 for each of Pre-primary, Primary, and High School (A-08).
- AC2: Seats used = applications that are Approved or Admitted in that section for that year (A-18). Seats available = limit − used.
- AC3: Seats used and available are visible on the application screen, the review screen, and the dashboard.
- AC4: Approval is blocked when seats available is zero (US-14 AC3).
- AC5: Changing a seat limit is logged with the old and new value, user, and date.
- AC6: Marking a student Left/Transferred frees the seat.

### Module 4: Receipt Types, Fee Heads, and Fee Structure

**US-17 Manage receipt types and fee heads** (BR-14, BR-41, BR-42, P1) As the Accounts Officer or Principal, I want to maintain the school's receipt types and fee heads in the application so that new forms and fees can be added without changing the software.

- AC1: The starting receipt types are Fees, Books, and Vehicle, and the starting fee heads are those on the school's receipts (BR-42).
- AC2: I can add a receipt type, rename it, and set its print title (for example "Books Receipt").
- AC3: Each fee head belongs to exactly one receipt type, and has a type: **Fixed** (price from the fee structure) or **Variable** (no fixed price; the amount paid is billed).
- AC4: Exactly one head is marked as the Admission Fee, and it is Variable. Each receipt type's Misc. head is Variable.
- AC5: The receipt type for the vehicle is marked "school vehicle only".
- AC6: Heads and types can be deactivated, never deleted (R-01). A head already billed keeps its history.

**US-18 Set yearly fee structure** (BR-13, BR-14, BR-44, P1) As the Accounts Officer, I want to enter fee amounts per standard per year so that every student of a standard gets the same breakdown, and the Principal can approve it.

- AC1: A grid lists each fixed fee head, grouped by receipt type, with an amount for each standard. Vehicle fees are entered per place.
- AC2: The structure belongs to one academic year and can differ from year to year.
- AC3: The Principal can view the structure and approve it. Once approved, changes require a new version, and earlier versions are preserved. Existing student fees are not changed unless an approved adjustment is made.
- AC4: Variable heads (Admission Fee, Misc.) have no amount in the grid.
- AC5: A head with amount 0 is not billed to students.

**US-19 Manage vehicle places** (BR-15, BR-44, P1) As the Accounts Officer or Principal, I want to add and update the places served by the school vehicle so that the vehicle fee matches the student's place.

- AC1: A place has a name and can be deactivated, never deleted.
- AC2: The price for each place is set in the fee structure (US-18).
- AC3: A place can be chosen on the application only when the transportation mode is School Bus.
- AC4: The Vehicle fee is billed only to students who use the school vehicle and have a place. If a student takes the vehicle later, the fee is added as a new billed item (R-09).

### Module 5: Student Fee and Payments

**US-20 View student fee breakdown** (BR-14, BR-15, BR-16, BR-39, P1) As an Accounts Officer, I want to see each student's fee grouped by receipt type and fee head so that I can tell the parent exactly what is due.

- AC1: For every fee head the screen shows Billed, Paid, and Balance (R-07), grouped under Fees, Books, and Vehicle, with the student's total payable, total paid, and balance.
- AC2: The Vehicle fee appears only for students who use the school vehicle, at their place's price (R-09).
- AC3: Concessions and extra charges appear on the head they apply to, with approval details.
- AC4: No line for previous-year dues exists (R-14).
- AC5: The Admission Fee and Misc. lines appear once an amount has been paid on them.

**US-21 Record a payment** (BR-17, BR-18, BR-19, BR-37, BR-43, P1) As an Accounts Officer, I want to record a payment received at the office, filled in like the paper receipt, so that the balance stays accurate.

- AC1: I choose the student and the receipt type. The screen lists that receipt's fee heads in the school's order, with Billed, Paid so far, and Outstanding for each.
- AC2: I enter the amount against one or more heads. The total is added up automatically and shown in words.
- AC3: A fixed head cannot be paid more than its outstanding balance. Variable heads (Admission Fee, Misc.) accept any amount, and the amount is billed as it is paid (R-11, R-12, R-13).
- AC4: Any fee head can be paid at any time after the student's fee has been generated. There is no required first payment and no required order (A-26).
- AC5: Other fields: payment date (inside the academic year, not in the future), mode (Cash, UPI, Card, Other), reference number (required for UPI and Card), payer name, relationship, and contact.
- AC6: On save, the head balances, Net Paid, and fee status update immediately (R-07, R-08).
- AC7: The payment and its lines are stored with the user and timestamp and cannot be edited or deleted (R-02).
- AC8: A numbered receipt is generated automatically (US-27).

**US-22 Later payments on fee heads** (BR-17, BR-43, P1) As an Accounts Officer, I want to accept payments of any amount at any time in the year and add them to the right fee head so that parents can pay when they can.

- AC1: Any fixed head can be paid in parts across several payments, as long as the total paid stays within the head's billed amount.
- AC2: The payment screen shows the head balances before and after the entry.
- AC3: No installment schedule, due dates, or reminders exist.

**US-23 Fee status and balance display** (BR-19, BR-20, P1) As an Accounts Officer, I want to see Paid, Partly Paid, or Not Paid with the remaining balance so that I can answer parents quickly.

- AC1: Status and balance appear on the student profile and in the fee list, in total and per fee head.
- AC2: Example: billed Rs. 29,350 (fees, books, vehicle, plus Admission Fee Rs. 1,000 and Misc. Rs. 250), paid Rs. 9,750 → status Partly Paid, balance Rs. 19,600.
- AC3: When the balance reaches Rs. 0, status becomes Fully Paid.

**US-24 Outstanding dues list** (BR-19, BR-39, P2) As an Accounts Officer or Principal, I want a list of students with outstanding dues for the selected year so that I can follow up.

- AC1: Filters by standard, status, receipt type, and year.
- AC2: The list shows student name, class, net payable, paid, balance, and last payment date.
- AC3: The list can be printed or exported. Sensitive fields are never included.
- AC4: The list covers only the selected year; balances are not combined across years.

**US-25 Payment history** (BR-18, P1) As an Accounts Officer, I want to see the full list of payments for a student with dates and payer details so that disputes can be settled.

- AC1: Each entry shows date, receipt type, the amount on each fee head, total, mode, reference, payer, recorded by, and receipt number.
- AC2: Reversal and refund entries appear in the same history, clearly labelled and linked to the original entry.

### Module 6: Concessions, Negotiation, Refunds, and Exceptions

**US-26 Concession, negotiated fee, or extra charge** (BR-21, BR-23, BR-40, P2) As an Accounts Officer or Principal, I want to record a concession, negotiated reduction, or extra charge on a fee head so that approved changes to a student's fee are tracked.

- AC1: The request has the student, the fee head, type (Concession, Negotiated reduction, Extra charge, Exception), amount, and a mandatory reason.
- AC2: Status flow: Requested → Approved or Rejected. **Only the Principal** can approve or reject.
- AC3: After the Admission Fee, the Principal can record the fee agreed after negotiation with the parent directly. This is logged with the reason and is the only case where the approver and recorder are the same person (R-05).
- AC4: On approval, the head's Billed amount, the student's Net Payable, and the balance are recalculated, and the entry appears in the breakdown with approver and date.
- AC5: A reduction can never make a fee head's Billed amount lower than what has already been paid on it.

**US-26A Refund or payment correction** (BR-22, BR-23, P2) As an Accounts Officer, I want to request a refund or reversal of a wrong entry so that mistakes are corrected without erasing history.

- AC1: The request links to the original payment and states the reason and amount.
- AC2: Only the Principal can approve it.
- AC3: On approval, a new reversal/refund entry is added for the fee heads concerned, the balances are recalculated, and the original payment remains untouched (R-19).
- AC4: Rejected requests are kept with their remarks.
- AC5: Whether the Admission Fee is refundable is a school policy still to be confirmed (BRD Section 16.2).

### Module 7: Receipts

**US-27 Receipt for each receipt type** (BR-24, BR-26, BR-45, BR-47, P1) As an Accounts Officer, I want to print a receipt immediately after recording a payment, in the school's format for that receipt type, so that the parent has proof.

- AC1: The receipt uses the school letterhead and the receipt type's title (Fees Receipt, Books Receipt, Vehicle Receipt).
- AC2: Contents: receipt number (for example RCT-2026-000001), date, student name, admission number, class, a numbered list of the receipt type's fee heads with the amount paid on each, the total, **the total in words** ("Rupees ... Only"), the payer's name and contact, and signature lines for the **payer, the Cashier, and the Manager** (the Principal signs as Manager).
- AC3: Every receipt has a unique number from one series shared by all receipt types and the final fees receipt (R-16).
- AC4: The receipt generates as an A4 or A5 PDF in the layout approved by the Client (A-15).
- AC5: Reversals and refunds do not produce a receipt.

**US-28 Final fees receipt and fee statement** (BR-25, BR-45, BR-46, BR-47, P1) As an Accounts Officer, I want one final fees receipt that includes all the other receipts, and a statement I can print at any time, so that the parent has the complete position.

- AC1: The final fees receipt can be issued only when the student's fee is fully paid (R-18).
- AC2: It shows the student and class, every fee head grouped by receipt type with its amount, the grand total, the total in words, and the **receipt numbers of all the other receipts** it includes.
- AC3: It has its own unique number from the receipt series, and one is issued per student fee.
- AC4: It has signature lines for the payer, the Cashier, and the Manager (the Principal signs as Manager).
- AC5: The **fee statement** can be printed at any time. It is marked "STATEMENT", is not numbered, and shows every fee head with billed, paid, and balance, and each payment with date, mode, payer name and contact, and receipt number.
- AC6: Neither document shows sensitive fields.

**US-29 Reprint documents** (BR-27, P3) As an Accounts Officer, I want to reprint a receipt, the final fees receipt, or a statement so that parents can get copies.

- AC1: Reprints carry the label "DUPLICATE", and the reprint date and user are logged.

### Module 8: Student Records

**US-30 Search students** (BR-28, P1) As any staff user, I want to search by name, admission number, STS number, standard, or year so that I can find a student quickly.

- AC1: Search returns results within 3 seconds for a typical year of records on the demo environment.
- AC2: Results show only fields permitted for my role (R-06, A-03).
- AC3: Left/Transferred students are included and clearly labelled.

**US-31 Student profile** (BR-29, P1) As a staff user, I want a single profile page so that I can see everything about a student I am allowed to view.

- AC1: Tabs: Details, Parents, Documents, Fees and Payments (by fee head), Receipts, Status History, Certificates.
- AC2: Tabs and fields not allowed for my role are hidden.

**US-32 Mark student as left** (BR-30, P2) As an Admission Officer, I want to mark a student as Left/Transferred with a date and reason so that records stay but the student is no longer active.

- AC1: The status change is dated and logged.
- AC2: All records, payments, receipts, and documents remain accessible.
- AC3: There is no delete option anywhere (R-01).
- AC4: The student's seat is freed (US-42 AC6).
- AC5: This is the only way a student becomes Left/Transferred. Generating a certificate never changes the status (US-36).

**US-33 Immutable records** (BR-30, P1) As the Principal, I want assurance that no record can be deleted so that the school's history is permanent.

- AC1: No delete button or endpoint exists for core records.
- AC2: The database scripts create an application database user that has no DELETE permission on core tables and no UPDATE permission on the payment ledger, receipts, and audit log, and the setup guide tells the deployer to use it.
- AC3: Attempts to remove or change protected data are rejected and logged.

### Module 9: Leaving / Transfer Certificate

**US-34 Create the year's certificate records** (BR-32, P2) As an Admission Officer, I want a certificate record created for every student of the academic year so that each student has a year-specific LC/TC.

- AC1: At year end, one action creates a certificate record for every admitted student of the selected year who does not have one yet. Left/Transferred students of that year are included.
- AC2: A record can also be created for a single student at any time, for example when a student leaves during the year, with the reason and intended leaving date.
- AC3: A list shows each student's certificate status for the year (not created, requested, reviewed, approved, issued), filterable by standard.
- AC4: Each student can have only one certificate record per academic year.
- AC5: The record shows the student's current unpaid balance (A-13).

**US-35 Review and approve TC** (BR-33, BR-36, P2) As an Admission Officer and Principal, I want a two-step approval so that TCs are issued under proper authority.

- AC1: Step 1: the Admission Officer reviews student data and conduct/remarks fields, then forwards or returns the request.
- AC2: Step 2: the Principal approves or rejects with remarks.
- AC3: If dues are pending, the Principal sees a warning and may approve only with an override reason (A-13).
- AC4: Each step stores user, date, and remarks.
- AC5: Several records can be selected and forwarded or approved together, each keeping its own remarks and dues override.

**US-36 Generate the LC/TC** (BR-34, P2) As an Admission Officer, I want the approved certificate generated automatically from stored data, in the school's approved template, so that no details are retyped.

- AC1: The TC pulls student name, STS number, parents' names, DOB (in figures and words), admission number and date, class in the year, last class studied, caste/sub-caste where the approved format requires it, previous school, leaving date, reason, conduct remarks, and the issue date.
- AC2: A unique TC number is assigned (for example TC-2026-0001).
- AC3: The layout follows the format approved by the Client (A-14), with signature and seal areas.
- AC4: Generating or issuing a certificate **does not change the student's status**. A continuing student stays Admitted; leaving is recorded separately (US-32).

**US-37 Retrieve and reprint LC/TC** (BR-35, P2) As an Admission Officer or Principal, I want to open any student's certificate for any academic year at any time so that copies can be issued years later.

- AC1: Certificates are searchable by student, TC number, and academic year, and appear on the student's profile under that year.
- AC2: Reprints are labelled "DUPLICATE COPY" with the reprint date, and every reprint is logged.
- AC3: The original issued data is preserved even if the student record changes later.

### Module 10: Audit, Dashboard, and Handover

**US-38 Audit log** (BR-31, BR-11, P1) As the Principal, I want to see who did what and when so that every change is accountable.

- AC1: The log records user, role, action, record, before/after values for key fields, and timestamp.
- AC2: The log cannot be edited or deleted by any user.
- AC3: It can be filtered by user, date, student, and action type.
- AC4: Sensitive values are never written to the log, only the names of the fields that changed.

**US-39 Basic dashboard** (P2) As the Principal, I want a summary so that I can see the school's position at a glance.

- AC1: Counts of applications by status, admitted students by section, seats used and available by section, and total fees billed, collected, and outstanding for the selected year, with a split by receipt type.
- AC2: Dashboard figures match the underlying lists exactly.

**US-40 Developer handover package** (Delivery, P2) As the Client's deployment team, I want clear setup instructions and scripts so that we can deploy and run the code ourselves.

- AC1: The setup guide (README) lists requirements, configuration settings, database setup steps, how to run the application, how to create the first administrator, and where uploaded files are stored.
- AC2: Database scripts create all tables, load the school's reference data (sections, standards, receipt types, fee heads), and set up the restricted application user on an empty database.
- AC3: A database test script checks the business rules and can be re-run after deployment.
- AC4: The setup guide includes a short recommendation on backups and HTTPS. Performing them is the Client's responsibility.
- AC5: Technical notes describe the architecture, roles and permissions, data model, and number formats.
- AC6: A person who has not worked on the project can follow the guide to run the application on a clean machine. This is tested before handover.

**US-41 Demo data** (Delivery, P1) As the project team, I want a seed script that loads realistic fake data so that demos and tests don't depend on real records.

- AC1: Includes all three sections, all roles, students with and without the school vehicle at different places, an approved application awaiting its Admission Fee, Admission Fees of different amounts, payments on Fees, Books, and Vehicle receipts, part-paid and fully paid students with a final fees receipt, a negotiated concession, a reversal, a section close to its seat limit, and a TC.
- AC2: The script can be run on a clean database in one step and contains no real personal data. The school's real forms are never used as demo data.

**US-43 Withdrawn.** Year-end fee closure is handled by the school outside the system (BRD v1.2). The number is not reused.

---

## 6. Data Requirements

### 6.1 Main entities

| Entity | Key contents |
| --- | --- |
| **User** | Username, hashed password, role, active flag, must-change-password flag |
| **AcademicYear** | Label, start/end dates, is_current, status (Open, Closed) |
| **Standard / Section** | Name, section (Pre-primary, Primary, High School), order, optional minimum age |
| **SeatLimit** | Year, section, maximum seats, changed by, date |
| **Student** | Name, gender, DOB, religion, blood group, **STS number**, address, pincode |
| **StudentSensitive** | Aadhaar number, caste, sub-caste, **caste/income certificate number, bank name, account number, IFSC** (encrypted by the application) |
| **Parent/Guardian** | Linked to student, father and mother details, two contact numbers, occupation |
| **ParentSensitive** | Income |
| **Application** | Application no. (school format), **application date**, year, standard, placed standard, status, transport mode and place, previous school (name, class, **DISE number**, TC no.), admission no. and date, decision details |
| **ApplicationStatusHistory** | Application, from/to status, user, timestamp, remarks |
| **Document / DocumentType / DocumentRequirement** | File reference, version, uploader, date; types and per-section requirement levels |
| **TransportRoute (place)** | Name, active flag |
| **FeeCategory (receipt type)** | Code, print title, school-vehicle-only flag, order, active flag |
| **FeeHead** | Receipt type, name, **billing type (Fixed or Variable)**, Admission Fee flag, order, active flag |
| **FeeStructure / FeeStructureItem** | Year, version, approval; amount per standard and fixed head, and per place for the vehicle fee |
| **StudentFee / StudentFeeItem** | Student, year, structure used; each billed head and amount, with its source (structure or entered) |
| **Adjustment** | Concession, negotiated reduction, extra charge, or exception **on one fee head**: amount, reason, requester, approver, status |
| **Payment (ledger)** | Student fee, year, **receipt type**, type (Payment, Reversal, Refund), total amount, date, mode, reference, payer name/contact/relationship, recorded by, linked original |
| **PaymentLine** | **Payment, fee head, amount** (what the receipt shows) |
| **PaymentCorrection** | Refund or reversal request: original payment, amount, reason, requester, approver, status |
| **Receipt** | Number, kind (receipt-type receipt or final fees receipt), student fee, payment, snapshot of the printed content including amount in words |
| **FinalReceiptItem** | Final fees receipt and the receipt numbers it includes |
| **DocumentPrint** | Receipt, statement, or certificate, duplicate flag, printed by, date |
| **TCRequest / Certificate** | Student, reason, step approvals, TC number, issue date, data snapshot |
| **NumberSequence** | Type (application, admission, receipt, TC), year, prefix, digits, format template, last number |
| **AuditLog** | User, action, entity, old/new values, timestamp |

### 6.2 Data integrity

- Receipts and TCs store a **snapshot** of the data at issue so that a later edit cannot change a printed document's history.
- Foreign keys are used with no cascading deletes.
- Sensitive fields are stored in separate tables so access can be controlled and, if required, encrypted.
- Number sequences are generated inside the same database transaction as the record they number, so numbers are never duplicated or skipped by failed saves.
- A payment's fee head lines must add up to its total, checked when the transaction commits.
- Totals (net payable, paid, balance, status) are calculated by one set of database functions and views, never stored.

---

## 7. Status Models

**Application:** Draft → Submitted → (Approved | Rejected | On Hold). Approved → Admitted in the same save as approval (kept as two states so the history is clear), with no payment required. On Hold → Approved or Rejected. Principal may return Submitted → Draft with a reason. Admitted → Left/Transferred only when the student is marked as left (US-32); issuing a certificate does not change the status.

**Fee:** Not Paid → Partly Paid → Fully Paid. A reversal can move the status backward, and the history shows why. Each fee head also shows its own balance.

**Receipts:** a receipt is issued once per payment; the final fees receipt is issued once per student fee, when it is fully paid.

**Adjustment (concession, negotiated reduction, refund, correction):** Requested → Approved | Rejected. A Principal-recorded negotiated concession is saved as Approved with a logged reason.

**TC:** Requested → Officer Reviewed → Principal Approved | Rejected → Issued.

---

## 8. Non-Functional Requirements

These describe what the **delivered code** must achieve. Items that depend on the Client's hosting are marked.

| ID | Category | Requirement |
| --- | --- | --- |
| NFR-01 | Security | Passwords hashed; role checks on the server for every request; the application works correctly behind HTTPS (certificate and server setup by the Client) |
| NFR-02 | Security | Uploaded files are stored in a configurable folder outside the public web path and served only after permission checks |
| NFR-03 | Privacy | Sensitive fields restricted by role (R-06), encrypted where stored, and access logged |
| NFR-04 | Performance | Normal screens load in under 3 seconds with 2,000 students per year and 10 years of data on the demo environment. Production speed depends on the Client's hosting |
| NFR-05 | Reliability | A payment save is atomic: the payment, its fee head lines, any variable-head billing, the receipt number, and any admission-number assignment are all saved or none are |
| NFR-06 | Auditability | Audit log is written for every create, update, status change, approval, and sensitive view |
| NFR-07 | Usability | Forms are keyboard-friendly; errors are specific and in plain English; payment entry looks like the paper receipt |
| NFR-08 | Compatibility | Latest Chrome on Windows. Printing on the school's physical printers is checked by the school |
| NFR-09 | Data safety | No-delete and append-only rules enforced in the application and in the database scripts (US-33) |
| NFR-10 | Maintainability | Code in version control; documented setup; configuration for numbering, document list, receipt types, fee heads, places, and seat limits without code changes |
| NFR-11 | Accuracy | All money values use exact decimals; every fee calculation, including per-head balances and amount in words, is covered by automated tests |
| NFR-12 | Portability | Configuration through environment settings, with no hard-coded server addresses or passwords, so the Client can deploy it anywhere |

---

## 9. External Interface Requirements

- **User interface:** Layout for desktop screens (1366 px and above), consistent navigation, role-based menus.
- **Printing:** HTML-to-PDF output on the school letterhead for receipts, the final fees receipt, and TCs; A4 default. Fonts must support the rupee sign or use "Rs." so that amounts print correctly. The amount in words follows the Indian system (lakh, crore).
- **Storage:** A configurable file store for uploads and generated PDFs.
- **Third-party integrations:** None in this phase.

---

## 10. Traceability Matrix (BRD to User Stories)

| BRD ID | Covered by |
| --- | --- |
| BR-01 | US-01, US-04 |
| BR-02 | US-05, US-06 |
| BR-03 | US-02 |
| BR-04 | US-03 |
| BR-05 | US-07, US-08 |
| BR-06 | US-09 |
| BR-07 | US-10 |
| BR-08 | US-11, US-16 |
| BR-09 | US-07, US-12 |
| BR-10 | US-13, US-14 |
| BR-11 | US-14, US-16, US-38 |
| BR-12 | US-15 |
| BR-13 | US-18 |
| BR-14 | US-17, US-18, US-20 |
| BR-15 | US-19, US-20 |
| BR-16 | US-20 |
| BR-17 | US-21, US-22 |
| BR-18 | US-21, US-25 |
| BR-19 | US-21, US-23, US-24 |
| BR-20 | US-23 |
| BR-21 | US-26 |
| BR-22 | US-26A |
| BR-23 | US-26, US-26A |
| BR-24 | US-27 |
| BR-25 | US-28 |
| BR-26 | US-27, US-28 |
| BR-27 | US-29 |
| BR-28 | US-30 |
| BR-29 | US-31 |
| BR-30 | US-32, US-33 |
| BR-31 | US-38 |
| BR-32 | US-34 |
| BR-33 | US-35 |
| BR-34 | US-36 |
| BR-35 | US-37 |
| BR-36 | US-35 |
| BR-37 | US-15, US-21 |
| BR-38 | US-14, US-42 |
| BR-39 | US-06, US-20, US-21, US-24 |
| BR-40 | US-26 |
| BR-41 | US-17 |
| BR-42 | US-17 |
| BR-43 | US-21, US-22 |
| BR-44 | US-18, US-19 |
| BR-45 | US-27, US-28 |
| BR-46 | US-28 |
| BR-47 | US-27, US-28 |

All 47 BRD requirements are covered. Stories US-04, US-39, US-40, and US-41 support delivery and are added by the project team. The SRS contains 43 active stories (US-01 to US-42 and US-26A).

---

## 11. Suggested Release Plan

| Sprint | Goal | Stories |
| --- | --- | --- |
| 0 | Setup, design, data model, seed data skeleton | Environment, CI, database scripts, UI kit |
| 1 | Access and year | US-01 to US-06 |
| 2 | Admission part 1 | US-07 to US-10 |
| 3 | Admission part 2 and seats | US-11 to US-16, US-42 |
| 4 | Receipt types, fee heads, structure, and places | US-17 to US-20 |
| 5 | Payments by fee head and receipts | US-21 to US-25, US-27 |
| 6 | Final receipt, adjustments, records | US-26, US-26A, US-28 to US-33 |
| 7 | Certificates | US-34 to US-37 |
| 8 | Audit, dashboard, handover package | US-38 to US-41, performance and security checks |
| 9 | Full testing, client acceptance, code handover | Defects, final handover |

CR-001 adds work mainly in Sprints 4 to 6 (head-wise payments, three receipt layouts, final receipt). The effort and the total of roughly 18 weeks will be re-estimated with the development team.

---

## 12. Definition of Done (per story)

1. Code reviewed and merged.
2. Acceptance criteria tested and passed.
3. Role permissions verified for every affected role.
4. Fee and money logic covered by automated tests.
5. Audit log entries confirmed.
6. Demonstrated to the Client at the sprint demo.

---

## 13. Open Items Carried From the BRD

These remain unanswered and may change the stories noted. See BRD Section 16.2 for the full wording.

| # | Open item | Stories affected |
| --- | --- | --- |
| 1 | Other forms or receipts besides admission, fees, books, and vehicle | US-17, US-27 |
| 2 | Closed (22 Oct): the final fees receipt is given only after all fees are fully paid | US-28 |
| 3 | Who the "admin" is that maintains fee heads, places, and amounts | US-17, US-18, US-19 |
| 4 | Books and uniform compulsory and fixed per standard | US-18, US-20 |
| 5 | Vehicle "Place" meaning, and pricing per place or per place and standard | US-18, US-19 |
| 6 | Closed (22 Oct): the Manager who signs the receipts is the Principal | US-27, US-28 |
| 7 | How an approved student who never joins is released (proposed: marked Left/Transferred) | US-32, US-42 |
| 8 | Refund policy for the Admission Fee | US-26A |
| 9 | Meaning of "100 seats for the 3 sections" | US-42 |
| 10 | Whether a TC can be issued when fees are unpaid | US-35 |
| 11 | Separate caste field; where parent occupation, income, and transport mode are collected | US-08, US-09 |
| 12 | Age limits per class | US-08 |
| 13 | Final application statuses | Status model |
| 14 | TC format | US-36 |
| 15 | Letterhead file and how each receipt's header and footer print (layouts confirmed 22 Oct); blank admission form | US-27, US-28 |
| 16 | Mandatory documents per section | US-10, US-11 |

---

## 14. Approval

| Name | Role | Signature | Date |
| --- | --- | --- | --- |
| Shashidhar Pawadashetti | CEO and Project Manager, Intallo | SP | 22 October 2026 |
| Rakesh Aralikatti | Client, acting for ABC English Medium School | RA (approved remotely) | 22 October 2026 |

*Approved remotely on 22 October 2026. SP and RA are the signatories' initials, recorded because physical signing was not possible.*