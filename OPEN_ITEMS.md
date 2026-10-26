# Open Client Decisions and Dependencies

Track written answers in Notion's Decision & Risk Register. Do not silently decide these in code.

| # | Open item | Affected areas |
|---:|---|---|
| 1 | Other receipt/form types besides admission, fees, books and vehicle. | Fee config, receipt layouts |
| 2 | Who “admin” is for fee heads/places/amounts: ACC, Principal or another role. | Roles, fee configuration |
| 3 | Whether books/uniform are compulsory and fixed per standard. | Fee structure/generation |
| 4 | Vehicle “Place” meaning and tariff by place only or place+standard. | Vehicle fee |
| 5 | How a previously approved student who never joins releases a seat. | Status/seat capacity |
| 6 | Whether Admission Fee is refundable; correction/reversal details. | Financial policy |
| 7 | Whether 100 seats is per broad section, total or per class/standard. | Seat-limit enforcement |
| 8 | Whether TC can be issued with unpaid dues; proposed warning/Principal override is a working assumption. | TC approval |
| 9 | Separate caste/category field and where occupation/income/transport details are collected. | Admission form/privacy |
| 10 | Minimum age per class; currently age calculated, warning disabled until rules supplied. | Validation |
| 11 | Final application statuses/transitions (some marked working). | Admission lifecycle |
| 12 | Approved TC format, numbering/duplicate requirements and fields. | LC/TC/PDF |
| 13 | High-resolution letterhead, full-page receipt samples, blank admission form and print details. | Official layouts |
| 14 | Mandatory/optional document list per section. | Documents |
| 15 | Initial admin bootstrap / forced password change and exact SYSADMIN role. | Authentication |
| 16 | Audit/file retention duration if not specified in the signed terms. | Retention policy |

## Confirmed, not open
- Admission requires no payment; Admission Fee variable; no mandatory initial payment.
- Final fees receipt only when all applicable fees are fully paid; statement available anytime.
- Manager signature represents Principal; payer signature also required.
- LC/TC is yearly per student/year and does not itself set Left/Transferred.
- No carry-forward; year-end unpaid fees are handled by school outside software.
- Intallo provides source/handover; Client owns deployment/operations.

## Closure process
Record source section, question, options, recommendation, impact, decision-maker, date and written evidence. Close only after Client/Principal confirmation. Update affected story acceptance, traceability and tasks afterward.
