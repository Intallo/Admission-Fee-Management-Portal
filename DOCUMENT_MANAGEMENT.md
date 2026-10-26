# Document Storage and Official PDF Rules

## Admission documents
- Store in configurable private storage outside public web path.
- Validate approved document type and size. SRS A-16 says PDF/JPG/PNG and 5 MB; document requirements by section remain open.
- Record type, version, uploader and timestamp.
- Replacing a file preserves earlier version/history; no silent deletion.
- Preview/download requires a server-side permission check on every request.
- Sensitive supporting documents are available only to authorized roles; ACC/SYSADMIN cannot access them even with a direct URL.

## Official receipts
- Each payment produces one receipt in the shared receipt sequence; reversals/refunds do not produce payment receipts.
- Receipt content includes receipt number/date, student/admission/class, receipt type's paid heads, total, amount in words, payer name/contact, Payer/Cashier/Manager signature lines.
- Final fees receipt is issued once per student fee only after all applicable fees are fully paid; list component receipt numbers and unique final receipt number.
- Fee statement can be printed at any time, labelled STATEMENT and not numbered.
- Reprints marked DUPLICATE, date/user recorded.
- Never put sensitive fields on receipts/statement.

## LC/TC
- Use approved Client-provided TC template/field list.
- Generate values server-side from authorized stored data; store issued snapshot.
- One certificate record per student/academic year; original issue data remains unchanged if student profile changes later.
- Reprints are marked DUPLICATE COPY and logged.
- Certificate issue must not change student status.

## Security and QA
Use synthetic values only for sample files. Test long names, page breaks, amount-in-words, signatures, header/footer, duplicate labels and unauthorized download. Final receipt/TC layout acceptance depends on Client-approved letterhead and complete print assets.
