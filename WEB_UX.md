# Web UX and Interaction Contract

## Admission journey
1. ADM selects the academic year and creates a draft.
2. First save assigns application number/date; draft can be revisited.
3. Student/parent fields and documents are entered; Received/Missing status is visible.
4. Submit only after completeness checks, or use the allowed documented “documents pending” path with reason to Principal.
5. Principal reviews permitted fields, documents and seat availability; approves with placement, rejects/holds with reason.
6. Approval creates Admitted status/admission number and fee generation when a fee structure exists. Admission does not require payment. If no approved structure exists, show Fee not generated.

## Fee journey
1. Principal decides/approves fee settings; ACC enters data as permitted.
2. ACC selects student/year/receipt type and head lines.
3. Server validates role, year, dates, fixed-head limits, receipt type and totals.
4. Atomic save records payment, lines, billing for variable head if needed, sequence and receipt.
5. UI confirms committed outcome and shows updated head/total balances and payment history.
6. Final fees receipt stays unavailable until all applicable fees are fully paid; statement can be printed anytime.

## Adjustment and reversal
ACC submits request with affected fee head and reason; Principal approves/rejects (with explicit direct negotiated-concession exception from SRS). Original ledger facts persist. New adjustment/reversal controls balance; history remains visible to authorized users.

## LC/TC journey
Create one record per student/academic year if absent, including Left/Transferred students for that year. ADM reviews; Principal approves/rejects. Generate using approved template and stored data; unique TC number and issue snapshot. Retrieve/reprint later; duplicate label and reprint audit required. Issuance does not change status.

## Interaction contract
- UI validation aids UX; server validation and authorization are mandatory.
- Never assume write success until server confirms commit.
- Prevent double-submission and support safe retries for payment/numbering.
- Switching year invalidates stale lists/totals and updates context.
- Permission-denied/error responses must not leak sensitive values or record existence to unauthorized users.
- Confirmation UI does not replace server permission checks.
- Critical payment uncertainty must not cause blind resubmission; check transaction state or idempotently retry per approved API design.

## Lists and search
Application filters include status, standard, section, date range and Fee not generated; counts per status. Student search supports name, admission number, STS, standard or year, with SRS target under 3 seconds in demo environment. Dues are selected-year scoped. TC filters by year/status/standard; audit filters by user/date/student/action. Field selection applies to lists, detail and exports alike.

## Error and empty states
Explain empty state and only offer authorized actions. Distinguish validation, permission, not-found, conflict and server errors. Preserve entered form values after validation where safe. Payment/approval/receipt/certificate failure must never be presented as committed if it was not.

## Browser and printing
Latest Chrome on Windows; 1366px+ baseline. Test keyboard flow, long text, table overflow, date/INR formats, all signature lines, amount-in-words, receipt-number series, approved letterhead/layout and A4/A5 PDF. Client checks physical printers in its own environment.
