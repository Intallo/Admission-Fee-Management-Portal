# Logical Data Dictionary

**Derived from SRS v1.4, not a physical database schema.** Column names, data types, constraints and current schema must be confirmed by M0.4 read-only inventory. Do not run migrations from this dictionary.

| Logical record | Important fields/concepts | Sensitivity / integrity |
|---|---|---|
| User | username, password hash, role, active flag, must-change-password | No plaintext password; no deletion |
| AcademicYear | label, start date, end date, is-current, Open/Closed | exactly one current year; no overlap; close restricts edits |
| Standard/Section | standard name/order, broad section, optional minimum age | age rule remains open |
| SeatLimit | year, section, limit, changed by/time | exact grouping of “100” remains open |
| Student | name, gender, DOB, religion, blood group, STS number, address/pincode | year-specific relationships; STS unique |
| StudentSensitive | Aadhaar, caste/sub-caste, certificate numbers, bank name/account/IFSC | restricted to ADM/Principal; encrypt where stored |
| Parent/Guardian | father/mother name, contacts, occupation where approved | income is a separate sensitive concern |
| ParentSensitive | income | restricted access and no log values |
| Application | number/date, year, standard/placement, status, transport/place, prior school/DISE/TC, admission number/date, decision | status history and actor/time/remarks |
| ApplicationStatusHistory | application, from/to, user, time, remarks | append-only decision history |
| Document / type / requirement | file ref, version, uploader/time, type, requiredness by section | private path, auth per read, old versions preserved |
| TransportRoute / place | name, active flag | tariff policy requires confirmation |
| FeeCategory / receipt type | code, print title, vehicle-only flag, order, active | catalog requires confirmation |
| FeeHead | category, name, Fixed/Variable, Admission Fee flag, order, active | receipt-type relationship enforced |
| FeeStructure / item | year, version, approval, standard/head/place amounts | approved values only |
| StudentFee / item | student/year/structure, head amount, source | no cross-year carry-forward |
| Adjustment | type, head, amount, reason, requester, approver, state | Principal authority; no silent edit |
| Payment | student fee/year, receipt type, Payment/Reversal/Refund, total/date/mode/reference, payer, actor, original link | append-only; precise decimal; exact approval flow |
| PaymentLine | payment, fee head, amount | sum equals total; all lines match receipt type |
| PaymentCorrection | original payment, amount, reason, requester, approver, state | linked reversal/refund history |
| Receipt | number, kind, student fee/payment, printed snapshot incl amount in words | unique shared sequence; immutable snapshot |
| FinalReceiptItem | final receipt + included receipt numbers | final receipt only at fully paid state |
| DocumentPrint | document kind, duplicate flag, user, date | reprint log |
| TCRequest / Certificate | student/year, reason, approvals, TC number/date, snapshot | one record per student/year; status separate |
| NumberSequence | kind/year/prefix/digits/template/counter | transactional, unique, no reused number |
| AuditLog | user, action, entity, allowed old/new values, timestamp | no sensitive values; immutable |

## Integrity requirements
No cascade deletes; no core hard deletes; year scoping; snapshot official PDFs; allocate numbers in the same transaction; payment lines sum to total; derived balances from one calculation; restrict DB role so core deletes and protected ledger/receipt/audit updates are denied.
