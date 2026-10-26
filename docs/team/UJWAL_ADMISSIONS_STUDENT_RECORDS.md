# Ujwal — Admissions & Student Records Owner

**Email:** bilagiujwal505@gmail.com  
**Team role:** Admission workflow, student records, academic-year scoping support, admission-document process and LC/TC workflow owner.  
**Primary Notion work:** M0.4, M3.4, M4.2–M4.4, M6.3, M8.2 (plus reviews explicitly assigned by the task tracker; respect dependencies/status).

## Mission

Translate the signed admission and student-record requirements into an auditable workflow that office staff can use, while keeping admission decisions under Principal authority and preserving year scope, privacy and non-deletion rules.

## Responsibilities now — read-only discovery

- Own M0.4: inventory existing database tables, columns, keys, constraints, indexes, RLS settings, trigger/function behavior and migration history using read-only inspection.
- Map observed tables to the logical concepts in the SRS: `academic_years`, `students`, `student_academic_records`, `admission_applications`, status history, guardians, sensitive details, documents and annual certificates.
- Separate observed schema facts from proposed data-model gaps. Attach queries and metadata evidence, not real student rows.
- Support Shashidhar's requirement traceability by identifying admission fields, workflows and ambiguities from the signed SRS.
- Before implementation, confirm the intended application source tree exists. Do not create an assumed application layout solely because the proposed architecture mentions one.

## Admissions and student-record responsibilities after approval

- Implement the admission workflow from draft/intake through submission, Principal decision, admission-number assignment and student-record linkage according to approved state transitions.
- Maintain required admission fields and the approved document checklist. Validate files by type/size and use private storage/authorized download paths only after the storage design is approved.
- Enforce school-year and student-record scoping; ensure year switching does not leak data across academic years.
- Ensure admission is not blocked by payment and does not require any minimum first payment. Admission Fee is variable and the system must not impose payment ordering.
- Keep student lifecycle transitions explicit and auditable. Issuing an LC/TC does not itself set status to Left/Transferred.
- Own LC/TC business workflow implementation once approved: year-specific certificate records, review/Principal approval, retrieval and reprint, while open template/dues/reissue policies remain unresolved until written approval.

## Deliverables

- M0.4 schema inventory, key/relationship diagram and read-only attestation.
- Admission fields-to-SRS mapping and approved state-transition table.
- Student/year lifecycle and access-scope test cases.
- Private document flow and admission validation evidence.
- LC/TC lifecycle and annual issuance test evidence.
- Handover package index listing delivered artifacts, known limitations and required client inputs.

## Explicit non-responsibilities

- Do not decide the meaning of the 100-seat limit, unspecified minimum-age policy, unconfirmed admission statuses or TC-with-unpaid-dues policy without written client/Principal approval.
- Do not change schema/migrations during M0.4 or silently repair retained data.
- Do not determine financial adjustment/refund authority; coordinate with Jeevan and the Principal/client.
- Do not expose sensitive student fields/documents to roles not authorized by the signed requirements.

## Handoffs

- **With Shashidhar:** report schema facts and open decisions; obtain approved API contracts/RBAC before wiring workflows.
- **With Sujal:** provide approved form field list, validation behavior, state transitions and safe screen states.
- **With Jeevan:** agree student/academic-year identifiers and certificate/payment integration boundaries; don't make certificate issue mutate student status.

## Ready-to-submit checklist

- [ ] Requirement references and approved states are clear.
- [ ] Read-only inspection has no writes; implementation uses isolated test DBs.
- [ ] No payment prerequisite has been added to admission.
- [ ] Personal/sensitive data are masked in evidence and authorized server-side.
- [ ] Academic-year isolation and certificate/status separation are tested.
- [ ] PR/artifact, tests, evidence, blockers and documentation links are recorded.
