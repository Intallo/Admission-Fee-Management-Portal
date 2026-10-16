BEGIN;
-- Fictional demo seed for local development only. No real student or client data.
-- Safe to rerun: stable demo emails/codes/reference numbers are used as keys.
-- Fee amounts, document checklist, and template snapshots are illustrative only.

insert into public.staff_members (full_name, email, role, is_active)
values
 ('Demo System Administrator','system.admin@school-demo.example','system_admin',true),
 ('Demo Principal','principal@school-demo.example','principal',true),
 ('Demo Admission Officer','admissions@school-demo.example','admission_officer',true),
 ('Demo Clerk','clerk@school-demo.example','clerk',true),
 ('Demo Accountant','accounts@school-demo.example','accountant',true)
on conflict (email) do update set full_name=excluded.full_name, role=excluded.role, is_active=excluded.is_active;

insert into public.academic_years (label,start_date,end_date,status,notes)
values
 ('2025-2026',date '2025-06-01',date '2026-05-31','closed','Synthetic prior year for year-scope testing.'),
 ('2026-2027',date '2026-06-01',date '2027-05-31','current','Synthetic active year; fee data is illustrative.')
on conflict (label) do update
set start_date=excluded.start_date,end_date=excluded.end_date,status=excluded.status,notes=excluded.notes;

insert into public.grade_levels (code,name,group_name,sort_order,is_active)
values
 ('NUR','Nursery','pre_primary',1,true),('LKG','LKG','pre_primary',2,true),('UKG','UKG','pre_primary',3,true),
 ('STD1','Standard 1','primary',4,true),('STD2','Standard 2','primary',5,true),
 ('STD3','Standard 3','primary',6,true),('STD4','Standard 4','primary',7,true),
 ('STD5','Standard 5','primary',8,true),('STD6','Standard 6','primary',9,true),
 ('STD7','Standard 7','primary',10,true),('STD8','Standard 8','high_school',11,true),
 ('STD9','Standard 9','high_school',12,true),('STD10','Standard 10','high_school',13,true)
on conflict (code) do update
set name=excluded.name,group_name=excluded.group_name,sort_order=excluded.sort_order,is_active=excluded.is_active;

insert into public.sections (academic_year_id,grade_level_id,name,max_capacity,is_active)
select ay.id,gl.id,'A',30,true
from public.academic_years ay cross join public.grade_levels gl
where ay.label='2026-2027'
on conflict (academic_year_id,grade_level_id,name) do update
set max_capacity=excluded.max_capacity,is_active=excluded.is_active;

insert into public.students (first_name,last_name,date_of_birth,gender,email,phone,address_line_1,city,state,postal_code)
select v.first_name,v.last_name,v.dob::date,v.gender,v.email,v.phone,v.address_line_1,'Bengaluru','Karnataka',v.postal_code
from (values
 ('Aarav','Sharma','2019-10-12','male','aarav.sharma@student-demo.example','9000000101','12 Demo Garden Road','560001'),
 ('Aanya','Rao','2019-06-03','female','aanya.rao@student-demo.example','9000000102','24 Sample Lake View','560002'),
 ('Rohan','Iyer','2015-09-23','male','rohan.iyer@student-demo.example','9000000103','8 Fictional Park Lane','560003'),
 ('Anika','Kulkarni','2012-11-14','female','anika.kulkarni@student-demo.example','9000000104','19 Mock Residency','560004'),
 ('Vihaan','Desai','2021-02-02','male','vihaan.desai@student-demo.example','9000000105','6 Example Cross','560005'),
 ('Myra','Shetty','2020-02-02','female','myra.shetty@student-demo.example','9000000106','31 Demo Circle','560006'),
 ('Ishaan','Verma','2018-05-17','male','ishaan.verma@student-demo.example','9000000107','14 Placeholder Street','560007'),
 ('Kiara','Joshi','2019-03-03','female','kiara.joshi@student-demo.example','9000000108','3 Sample Orchid Road','560008'),
 ('Nikhil','Bhat','2017-04-19','male','nikhil.bhat@student-demo.example','9000000109','27 Fiction Court','560009')
) v(first_name,last_name,dob,gender,email,phone,address_line_1,postal_code)
where not exists (select 1 from public.students s where s.email=v.email);

insert into public.guardians (full_name,relationship_to_student,phone,email,occupation,address_line_1,city,state,postal_code)
select v.full_name,v.relationship_to_student,v.phone,v.email,v.occupation,v.address_line_1,'Bengaluru','Karnataka',v.postal_code
from (values
 ('Priya Sharma','Mother','9100000101','priya.sharma@guardian-demo.example','Teacher','12 Demo Garden Road','560001'),
 ('Rahul Sharma','Father','9100000111','rahul.sharma@guardian-demo.example','Engineer','12 Demo Garden Road','560001'),
 ('Kavya Rao','Mother','9100000102','kavya.rao@guardian-demo.example','Designer','24 Sample Lake View','560002'),
 ('Vikram Iyer','Father','9100000103','vikram.iyer@guardian-demo.example','Accountant','8 Fictional Park Lane','560003'),
 ('Neha Kulkarni','Mother','9100000104','neha.kulkarni@guardian-demo.example','Doctor','19 Mock Residency','560004'),
 ('Sanjay Desai','Father','9100000105','sanjay.desai@guardian-demo.example','Business owner','6 Example Cross','560005'),
 ('Deepa Shetty','Mother','9100000106','deepa.shetty@guardian-demo.example','Consultant','31 Demo Circle','560006'),
 ('Manoj Verma','Father','9100000107','manoj.verma@guardian-demo.example','Technician','14 Placeholder Street','560007'),
 ('Amit Joshi','Father','9100000108','amit.joshi@guardian-demo.example','Analyst','3 Sample Orchid Road','560008'),
 ('Pooja Bhat','Mother','9100000109','pooja.bhat@guardian-demo.example','Nurse','27 Fiction Court','560009')
) v(full_name,relationship_to_student,phone,email,occupation,address_line_1,postal_code)
where not exists (select 1 from public.guardians g where g.email=v.email);

insert into public.student_guardians (student_id,guardian_id,relationship_type,is_primary_contact,can_collect_student)
select s.id,g.id,g.relationship_to_student,true,true
from (values
 ('Aarav','Sharma','priya.sharma@guardian-demo.example'),
 ('Aanya','Rao','kavya.rao@guardian-demo.example'),
 ('Rohan','Iyer','vikram.iyer@guardian-demo.example'),
 ('Anika','Kulkarni','neha.kulkarni@guardian-demo.example'),
 ('Vihaan','Desai','sanjay.desai@guardian-demo.example'),
 ('Myra','Shetty','deepa.shetty@guardian-demo.example'),
 ('Ishaan','Verma','manoj.verma@guardian-demo.example'),
 ('Kiara','Joshi','amit.joshi@guardian-demo.example'),
 ('Nikhil','Bhat','pooja.bhat@guardian-demo.example')
) v(first_name,last_name,guardian_email)
join public.students s on s.first_name=v.first_name and s.last_name=v.last_name
join public.guardians g on g.email=v.guardian_email
on conflict (student_id,guardian_id) do update
set relationship_type=excluded.relationship_type,is_primary_contact=excluded.is_primary_contact,can_collect_student=excluded.can_collect_student;

insert into public.student_guardians (student_id,guardian_id,relationship_type,is_primary_contact,can_collect_student)
select s.id,g.id,'Father',false,true from public.students s cross join public.guardians g
where s.email='aarav.sharma@student-demo.example' and g.email='rahul.sharma@guardian-demo.example'
on conflict (student_id,guardian_id) do nothing;

insert into public.student_academic_records
(student_id,academic_year_id,grade_level_id,section_id,admission_number,status,admission_date,roll_number,transport_opted_in,notes)
select s.id,ay.id,gl.id,sec.id,v.admission_number,'active',v.admission_date::date,v.roll_number,v.transport_opted_in,
       'Synthetic enrollment for development and integration testing.'
from (values
 ('Aarav','Sharma','STD1','DEMO-2026-0001','2026-06-05','01',true),
 ('Rohan','Iyer','STD5','DEMO-2026-0002','2026-06-08','12',false),
 ('Anika','Kulkarni','STD8','DEMO-2026-0003','2026-06-10','04',false),
 ('Vihaan','Desai','NUR','DEMO-2026-0004','2026-06-12','03',true)
) v(first_name,last_name,grade_code,admission_number,admission_date,roll_number,transport_opted_in)
join public.students s on s.first_name=v.first_name and s.last_name=v.last_name
join public.academic_years ay on ay.label='2026-2027'
join public.grade_levels gl on gl.code=v.grade_code
join public.sections sec on sec.academic_year_id=ay.id and sec.grade_level_id=gl.id and sec.name='A'
on conflict (student_id,academic_year_id) do update
set grade_level_id=excluded.grade_level_id,section_id=excluded.section_id,admission_number=excluded.admission_number,
    status=excluded.status,admission_date=excluded.admission_date,roll_number=excluded.roll_number,
    transport_opted_in=excluded.transport_opted_in,notes=excluded.notes;

insert into public.admission_applications
(student_id,academic_year_id,requested_grade_level_id,requested_section_id,status,application_number,
 submitted_at,reviewed_at,reviewed_by,decision_reason,admission_fee_recorded_at,seat_reserved_until,created_by)
select s.id,ay.id,gl.id,sec.id,v.status::public.admission_application_status,v.application_number,
       v.submitted_at::timestamptz,v.reviewed_at::timestamptz,reviewer.id,v.decision_reason,
       v.admission_fee_recorded_at::timestamptz,v.seat_reserved_until::timestamptz,ao.id
from (values
 ('Aarav','Sharma','STD1','approved','DEMO-ADM-2026-0001','2026-06-02 09:00:00+05:30','2026-06-05 10:00:00+05:30','principal@school-demo.example','Approved after synthetic admission fee receipt','2026-06-05 09:00:00+05:30',null),
 ('Aanya','Rao','STD1','under_review','DEMO-ADM-2026-0002','2026-10-06 09:00:00+05:30','2026-10-07 11:00:00+05:30','admissions@school-demo.example','Synthetic application awaiting document review',null,null),
 ('Rohan','Iyer','STD5','approved','DEMO-ADM-2026-0003','2026-06-04 09:00:00+05:30','2026-06-08 11:00:00+05:30','principal@school-demo.example','Approved after synthetic admission fee receipt','2026-06-08 10:00:00+05:30',null),
 ('Anika','Kulkarni','STD8','approved','DEMO-ADM-2026-0004','2026-06-06 10:00:00+05:30','2026-06-10 12:00:00+05:30','principal@school-demo.example','Approved after synthetic admission fee receipt','2026-06-10 11:00:00+05:30',null),
 ('Vihaan','Desai','NUR','approved','DEMO-ADM-2026-0005','2026-06-09 09:00:00+05:30','2026-06-12 10:00:00+05:30','principal@school-demo.example','Approved after synthetic admission fee receipt','2026-06-12 09:00:00+05:30',null),
 ('Myra','Shetty','UKG','submitted','DEMO-ADM-2026-0006','2026-10-13 09:00:00+05:30',null,null,'Synthetic application awaiting review',null,null),
 ('Ishaan','Verma','STD3','draft','DEMO-ADM-2026-0007',null,null,null,'Synthetic incomplete application',null,null),
 ('Kiara','Joshi','STD1','rejected','DEMO-ADM-2026-0008','2026-09-17 09:00:00+05:30','2026-09-20 14:00:00+05:30','principal@school-demo.example','Synthetic rejection for workflow testing',null,null),
 ('Nikhil','Bhat','STD4','on_hold','DEMO-ADM-2026-0009','2026-10-14 10:00:00+05:30','2026-10-15 12:00:00+05:30','principal@school-demo.example','Synthetic seat hold pending school decision',null,'2026-10-30 17:00:00+05:30')
) v(first_name,last_name,grade_code,status,application_number,submitted_at,reviewed_at,reviewer_email,decision_reason,admission_fee_recorded_at,seat_reserved_until)
join public.students s on s.first_name=v.first_name and s.last_name=v.last_name
join public.academic_years ay on ay.label='2026-2027'
join public.grade_levels gl on gl.code=v.grade_code
join public.sections sec on sec.academic_year_id=ay.id and sec.grade_level_id=gl.id and sec.name='A'
join public.staff_members ao on ao.email='admissions@school-demo.example'
left join public.staff_members reviewer on reviewer.email=v.reviewer_email
on conflict (student_id,academic_year_id) do update
set requested_grade_level_id=excluded.requested_grade_level_id,requested_section_id=excluded.requested_section_id,
    status=excluded.status,application_number=excluded.application_number,submitted_at=excluded.submitted_at,
    reviewed_at=excluded.reviewed_at,reviewed_by=excluded.reviewed_by,decision_reason=excluded.decision_reason,
    admission_fee_recorded_at=excluded.admission_fee_recorded_at,seat_reserved_until=excluded.seat_reserved_until;

insert into public.admission_status_history (admission_application_id,from_status,to_status,changed_by,reason,changed_at)
select aa.id,null,aa.status,coalesce(aa.reviewed_by,aa.created_by),
       'Synthetic seed initial status: '||aa.decision_reason,coalesce(aa.reviewed_at,aa.submitted_at,aa.created_at)
from public.admission_applications aa
where aa.application_number like 'DEMO-ADM-2026-%'
and not exists (
 select 1 from public.admission_status_history h
 where h.admission_application_id=aa.id and h.to_status=aa.status and h.reason='Synthetic seed initial status: '||aa.decision_reason
);

insert into public.document_types (code,name,description,is_active)
values
 ('BIRTH_CERTIFICATE','Birth Certificate','Synthetic checklist item; file stored only in private object storage.',true),
 ('STUDENT_PHOTOGRAPH','Student Photograph','Synthetic checklist item; upload required in application workflow.',true),
 ('PARENT_ID_PROOF','Parent/Guardian ID Proof','Conditional requirement pending client-approved checklist.',true),
 ('PREVIOUS_SCHOOL_TC','Previous School Transfer Certificate','Conditional for applicable applicants.',true),
 ('PREVIOUS_MARKSHEET','Previous School Marksheet','Conditional for applicable applicants.',true)
on conflict (code) do update set name=excluded.name,description=excluded.description,is_active=excluded.is_active;

insert into public.document_requirements (academic_year_id,grade_level_id,document_type_id,is_required,applies_to_new_admission,notes)
select ay.id,null,dt.id,v.is_required,true,
       'Synthetic starter setting only; confirm against school-approved checklist.'
from public.academic_years ay
cross join (values ('BIRTH_CERTIFICATE',true),('STUDENT_PHOTOGRAPH',true),('PARENT_ID_PROOF',false),
                   ('PREVIOUS_SCHOOL_TC',false),('PREVIOUS_MARKSHEET',false)) v(document_code,is_required)
join public.document_types dt on dt.code=v.document_code
where ay.label='2026-2027'
on conflict (academic_year_id,document_type_id) where grade_level_id is null
do update set is_required=excluded.is_required,notes=excluded.notes;

insert into public.fee_heads (code,name,category,is_variable,is_optional,is_active,description)
values
 ('ADMISSION_FEE','Admission Fee','school_fee',true,false,true,'Variable amount; no fixed amount/percentage in the specification.'),
 ('TUITION_FEE','Tuition Fee','school_fee',false,false,true,'Synthetic annual tuition assessment.'),
 ('DEVELOPMENT_FEE','Development Fee','school_fee',false,false,true,'Synthetic annual development fee.'),
 ('EXAM_FEE','Examination Fee','school_fee',false,false,true,'Synthetic annual examination charge.'),
 ('BOOKS','Books','books',false,false,true,'Synthetic books receipt category.'),
 ('SCHOOL_BUS','School Bus / Vehicle Fee','vehicle',true,true,true,'Optional; use approved transport rate and student selection.')
on conflict (code) do update set name=excluded.name,category=excluded.category,is_variable=excluded.is_variable,
is_optional=excluded.is_optional,is_active=excluded.is_active,description=excluded.description;

insert into public.fee_structures (academic_year_id,grade_level_id,version,status,approval_notes,created_by,approved_by,approved_at)
select ay.id,gl.id,1,'approved','Synthetic demo fee structure; illustrative values only.',
       clerk.id,principal.id,now()
from public.academic_years ay cross join public.grade_levels gl
join public.staff_members clerk on clerk.email='clerk@school-demo.example'
join public.staff_members principal on principal.email='principal@school-demo.example'
where ay.label='2026-2027'
on conflict (academic_year_id,grade_level_id,version) do update
set status=excluded.status,approval_notes=excluded.approval_notes,approved_by=excluded.approved_by,approved_at=excluded.approved_at;

insert into public.fee_structure_lines (fee_structure_id,fee_head_id,amount,applicability_rule,display_order)
select fs.id,fh.id,
       case fh.code when 'ADMISSION_FEE' then null::numeric when 'SCHOOL_BUS' then null::numeric
         when 'TUITION_FEE' then case gl.group_name when 'pre_primary' then 8500.00 when 'primary' then 14000.00 else 18000.00 end
         when 'DEVELOPMENT_FEE' then 2000.00 when 'EXAM_FEE' then 1200.00 when 'BOOKS' then 2500.00 end,
       case fh.code when 'ADMISSION_FEE' then 'Variable; enter approved student-specific amount.'
         when 'SCHOOL_BUS' then 'Optional; use approved route rate for students opting in.'
         else 'Synthetic illustrative amount; confirm before production.' end,
       case fh.code when 'ADMISSION_FEE' then 1 when 'TUITION_FEE' then 2 when 'DEVELOPMENT_FEE' then 3
         when 'EXAM_FEE' then 4 when 'BOOKS' then 5 else 6 end
from public.fee_structures fs
join public.grade_levels gl on gl.id=fs.grade_level_id
join public.fee_heads fh on fh.code in ('ADMISSION_FEE','TUITION_FEE','DEVELOPMENT_FEE','EXAM_FEE','BOOKS','SCHOOL_BUS')
join public.academic_years ay on ay.id=fs.academic_year_id and ay.label='2026-2027'
on conflict (fee_structure_id,fee_head_id) do update
set amount=excluded.amount,applicability_rule=excluded.applicability_rule,display_order=excluded.display_order;

insert into public.transport_rates (academic_year_id,mode,place_label,amount,is_active)
select ay.id,v.mode::public.transport_mode,v.place_label,v.amount,true
from public.academic_years ay
cross join (values ('school_bus','Jayanagar',1800.00),('school_bus','Malleshwaram',1600.00),
                   ('private_vehicle','Jayanagar',900.00),('private_vehicle','Malleshwaram',800.00)) v(mode,place_label,amount)
where ay.label='2026-2027'
on conflict (academic_year_id,mode,place_label) do update set amount=excluded.amount,is_active=excluded.is_active;

insert into public.student_transport_assignments (student_academic_record_id,transport_rate_id,effective_from,notes)
select sar.id,tr.id,date '2026-06-01','Synthetic transport assignment; rate is illustrative.'
from public.student_academic_records sar
join public.students s on s.id=sar.student_id
join public.academic_years ay on ay.id=sar.academic_year_id and ay.label='2026-2027'
join public.transport_rates tr on tr.academic_year_id=ay.id and tr.mode='school_bus'
where (s.email='aarav.sharma@student-demo.example' and tr.place_label='Jayanagar')
   or (s.email='vihaan.desai@student-demo.example' and tr.place_label='Malleshwaram')
on conflict (student_academic_record_id) do update
set transport_rate_id=excluded.transport_rate_id,effective_from=excluded.effective_from,notes=excluded.notes;

insert into public.student_fee_assessments (student_academic_record_id,fee_structure_id,assessment_number,status,assessed_at,issued_at,issued_by,snapshot)
select sar.id,fs.id,v.assessment_number,'issued',timestamptz '2026-06-01 09:00:00+05:30',
       timestamptz '2026-06-01 09:00:00+05:30',clerk.id,
       jsonb_build_object('demo',true,'student',s.first_name||' '||s.last_name,'academic_year',ay.label,
       'note','Synthetic assessment snapshot; amounts are illustrative.')
from (values
 ('aarav.sharma@student-demo.example','DEMO-ASMT-2026-0001'),
 ('rohan.iyer@student-demo.example','DEMO-ASMT-2026-0002'),
 ('anika.kulkarni@student-demo.example','DEMO-ASMT-2026-0003'),
 ('vihaan.desai@student-demo.example','DEMO-ASMT-2026-0004')
) v(student_email,assessment_number)
join public.students s on s.email=v.student_email
join public.student_academic_records sar on sar.student_id=s.id
join public.academic_years ay on ay.id=sar.academic_year_id and ay.label='2026-2027'
join public.fee_structures fs on fs.academic_year_id=ay.id and fs.grade_level_id=sar.grade_level_id and fs.version=1
join public.staff_members clerk on clerk.email='clerk@school-demo.example'
on conflict (assessment_number) do update
set status=excluded.status,issued_at=excluded.issued_at,issued_by=excluded.issued_by,snapshot=excluded.snapshot;

insert into public.student_fee_assessment_lines (student_fee_assessment_id,fee_head_id,assessed_amount,description_snapshot)
select a.id,fh.id,case fh.code when 'ADMISSION_FEE' then 1500.00 when 'SCHOOL_BUS' then 1800.00 else fsl.amount end,
       fh.name||' â€” synthetic 2026â€“2027 assessment'
from public.student_fee_assessments a
join public.student_academic_records sar on sar.id=a.student_academic_record_id
join public.fee_structure_lines fsl on fsl.fee_structure_id=a.fee_structure_id
join public.fee_heads fh on fh.id=fsl.fee_head_id
where fh.code<>'SCHOOL_BUS' or sar.transport_opted_in
on conflict (student_fee_assessment_id,fee_head_id) do update
set assessed_amount=excluded.assessed_amount,description_snapshot=excluded.description_snapshot;

insert into public.payments
(student_academic_record_id,transaction_type,amount,currency,method,transaction_date,payer_name,reference_number,notes,recorded_by)
select sar.id,'collection',v.amount,'INR',v.method::public.payment_method,v.transaction_date::timestamptz,
       v.payer_name,v.reference_number,'DEMO_FEE_HEAD='||v.fee_head_code,recorder.id
from (values
 ('aarav.sharma@student-demo.example','ADMISSION_FEE',1500.00,'2026-06-05 09:00:00+05:30','Priya Sharma','DEMO-PAY-0001','cash','clerk@school-demo.example'),
 ('aarav.sharma@student-demo.example','TUITION_FEE',5000.00,'2026-06-20 10:00:00+05:30','Priya Sharma','DEMO-PAY-0002','cash','clerk@school-demo.example'),
 ('aarav.sharma@student-demo.example','BOOKS',2000.00,'2026-06-21 10:30:00+05:30','Priya Sharma','DEMO-PAY-0003','cash','clerk@school-demo.example'),
 ('aarav.sharma@student-demo.example','SCHOOL_BUS',900.00,'2026-06-22 11:00:00+05:30','Priya Sharma','DEMO-PAY-0004','cash','accounts@school-demo.example'),
 ('rohan.iyer@student-demo.example','ADMISSION_FEE',1500.00,'2026-06-08 10:00:00+05:30','Vikram Iyer','DEMO-PAY-0005','cash','clerk@school-demo.example'),
 ('rohan.iyer@student-demo.example','TUITION_FEE',9000.00,'2026-06-25 10:00:00+05:30','Vikram Iyer','DEMO-PAY-0006','cheque','accounts@school-demo.example'),
 ('anika.kulkarni@student-demo.example','ADMISSION_FEE',1500.00,'2026-06-10 11:00:00+05:30','Neha Kulkarni','DEMO-PAY-0007','cash','clerk@school-demo.example'),
 ('anika.kulkarni@student-demo.example','TUITION_FEE',15000.00,'2026-07-01 11:30:00+05:30','Neha Kulkarni','DEMO-PAY-0008','cheque','accounts@school-demo.example'),
 ('vihaan.desai@student-demo.example','ADMISSION_FEE',1500.00,'2026-06-12 09:00:00+05:30','Sanjay Desai','DEMO-PAY-0009','cash','clerk@school-demo.example'),
 ('vihaan.desai@student-demo.example','BOOKS',2500.00,'2026-06-18 10:00:00+05:30','Sanjay Desai','DEMO-PAY-0010','cash','accounts@school-demo.example')
) v(student_email,fee_head_code,amount,transaction_date,payer_name,reference_number,method,recorder_email)
join public.students s on s.email=v.student_email
join public.student_academic_records sar on sar.student_id=s.id
join public.academic_years ay on ay.id=sar.academic_year_id and ay.label='2026-2027'
join public.staff_members recorder on recorder.email=v.recorder_email
where not exists (select 1 from public.payments p where p.reference_number=v.reference_number);

insert into public.payment_allocations (payment_id,student_fee_assessment_line_id,amount)
select p.id,line.id,p.amount
from public.payments p
join public.student_academic_records sar on sar.id=p.student_academic_record_id
join public.academic_years ay on ay.id=sar.academic_year_id and ay.label='2026-2027'
join public.student_fee_assessments a on a.student_academic_record_id=sar.id
join public.student_fee_assessment_lines line on line.student_fee_assessment_id=a.id
join public.fee_heads fh on fh.id=line.fee_head_id
where p.reference_number like 'DEMO-PAY-%'
  and fh.code=split_part(p.notes,'DEMO_FEE_HEAD=',2)
  and not exists (select 1 from public.payment_allocations pa where pa.payment_id=p.id);

insert into public.receipts
(payment_id,category,receipt_number,issued_at,issued_by,template_version,rendered_snapshot,reprint_count)
select p.id,max(fh.category::text)::public.fee_category,'RCT-2026-'||right(p.reference_number,4),
       p.transaction_date,issuer.id,'demo-v1',
       jsonb_build_object('demo',true,'student',s.first_name||' '||s.last_name,'admission_number',sar.admission_number,
         'academic_year',ay.label,'receipt_number','RCT-2026-'||right(p.reference_number,4),'category',max(fh.category::text),
         'amount_inr',p.amount,'payer_name',p.payer_name,
         'fee_lines',jsonb_agg(jsonb_build_object('fee_head',fh.name,'amount_inr',pa.amount) order by fh.code),
         'payer_signature_line',true,'cashier_signature_line',true,'manager_signature_line',true,
         'note','Synthetic receipt; layout and CR-002 approval must be confirmed.'),
       0
from public.payments p
join public.student_academic_records sar on sar.id=p.student_academic_record_id
join public.students s on s.id=sar.student_id
join public.academic_years ay on ay.id=sar.academic_year_id
join public.payment_allocations pa on pa.payment_id=p.id
join public.student_fee_assessment_lines line on line.id=pa.student_fee_assessment_line_id
join public.fee_heads fh on fh.id=line.fee_head_id
join public.staff_members issuer on issuer.email='clerk@school-demo.example'
where p.reference_number like 'DEMO-PAY-%'
group by p.id,p.reference_number,p.transaction_date,issuer.id,s.first_name,s.last_name,sar.admission_number,ay.label,p.amount,p.payer_name
on conflict (payment_id) do update set rendered_snapshot=excluded.rendered_snapshot;

insert into public.consolidated_receipts
(student_academic_record_id,receipt_number,generated_at,generated_by,template_version,rendered_snapshot)
select sar.id,v.consolidated_number,now(),clerk.id,'demo-v1',
       jsonb_build_object('demo',true,'student',s.first_name||' '||s.last_name,'academic_year',ay.label,
         'receipt_number',v.consolidated_number,'included_receipts',v.included_numbers,'total_amount_inr',v.total_amount,
         'payer_signature_line',true,'cashier_signature_line',true,'manager_signature_line',true,
         'note','Synthetic summary; source receipts are not new payments.')
from (values
 ('aarav.sharma@student-demo.example','RCT-2026-0011',array['RCT-2026-0001','RCT-2026-0002','RCT-2026-0003','RCT-2026-0004']::text[],9400.00),
 ('rohan.iyer@student-demo.example','RCT-2026-0012',array['RCT-2026-0005','RCT-2026-0006']::text[],10500.00)
) v(student_email,consolidated_number,included_numbers,total_amount)
join public.students s on s.email=v.student_email
join public.student_academic_records sar on sar.student_id=s.id
join public.academic_years ay on ay.id=sar.academic_year_id and ay.label='2026-2027'
join public.staff_members clerk on clerk.email='clerk@school-demo.example'
on conflict (receipt_number) do nothing;

insert into public.consolidated_receipt_items
(consolidated_receipt_id,receipt_id,receipt_number_snapshot,amount_snapshot,display_order)
select cr.id,r.id,r.receipt_number,p.amount,
       row_number() over (partition by cr.id order by r.receipt_number)::smallint
from public.consolidated_receipts cr
join (values
 ('RCT-2026-0011','RCT-2026-0001'),('RCT-2026-0011','RCT-2026-0002'),
 ('RCT-2026-0011','RCT-2026-0003'),('RCT-2026-0011','RCT-2026-0004'),
 ('RCT-2026-0012','RCT-2026-0005'),('RCT-2026-0012','RCT-2026-0006')
) v(consolidated_number,individual_number) on v.consolidated_number=cr.receipt_number
join public.receipts r on r.receipt_number=v.individual_number
join public.payments p on p.id=r.payment_id
on conflict (consolidated_receipt_id,receipt_id) do nothing;

insert into public.receipt_number_counters (series_code,next_value)
values ('RCT',13)
on conflict (series_code) do update set next_value=greatest(public.receipt_number_counters.next_value,excluded.next_value);

insert into public.fee_adjustments
(student_fee_assessment_line_id,adjustment_type,amount,status,reason,requested_by,requested_at,approved_by,approved_at)
select line.id,v.adjustment_type::public.adjustment_kind,v.amount,v.status::public.approval_state,
       v.reason,requester.id,v.requested_at::timestamptz,approver.id,v.approved_at::timestamptz
from (values
 ('rohan.iyer@student-demo.example','DEVELOPMENT_FEE','concession',300.00,'pending','Synthetic concession awaiting approval','2026-07-05 10:00:00+05:30','clerk@school-demo.example',null,null),
 ('anika.kulkarni@student-demo.example','DEVELOPMENT_FEE','concession',500.00,'approved','Synthetic Principal-approved concession','2026-07-06 10:00:00+05:30','clerk@school-demo.example','principal@school-demo.example','2026-07-07 09:00:00+05:30')
) v(student_email,fee_head_code,adjustment_type,amount,status,reason,requested_at,requester_email,approver_email,approved_at)
join public.students s on s.email=v.student_email
join public.student_academic_records sar on sar.student_id=s.id
join public.student_fee_assessments a on a.student_academic_record_id=sar.id
join public.student_fee_assessment_lines line on line.student_fee_assessment_id=a.id
join public.fee_heads fh on fh.id=line.fee_head_id and fh.code=v.fee_head_code
join public.staff_members requester on requester.email=v.requester_email
left join public.staff_members approver on approver.email=v.approver_email
where not exists (select 1 from public.fee_adjustments fa where fa.student_fee_assessment_line_id=line.id and fa.reason=v.reason);

insert into public.student_year_certificates
(student_academic_record_id,certificate_type,certificate_number,status,generated_by,approved_by,approved_at,issued_at)
select sar.id,'LC',
       case when s.email='aarav.sharma@student-demo.example' then 'DEMO-LC-2026-0001' else null end,
       case when s.email='aarav.sharma@student-demo.example' then 'issued'::public.certificate_state else 'draft'::public.certificate_state end,
       clerk.id,case when s.email='aarav.sharma@student-demo.example' then principal.id else null end,
       case when s.email='aarav.sharma@student-demo.example' then timestamptz '2026-06-25 09:00:00+05:30' else null end,
       case when s.email='aarav.sharma@student-demo.example' then timestamptz '2026-06-25 09:00:00+05:30' else null end
from public.student_academic_records sar
join public.students s on s.id=sar.student_id
join public.academic_years ay on ay.id=sar.academic_year_id and ay.label='2026-2027'
join public.staff_members clerk on clerk.email='clerk@school-demo.example'
left join public.staff_members principal on principal.email='principal@school-demo.example'
on conflict (student_academic_record_id,certificate_type) do update
set certificate_number=excluded.certificate_number,status=excluded.status,generated_by=excluded.generated_by,
    approved_by=excluded.approved_by,approved_at=excluded.approved_at,issued_at=excluded.issued_at;

insert into public.certificate_versions
(student_year_certificate_id,version_number,content_snapshot,template_version,issue_or_reissue_reason,generated_by,approved_by,generated_at)
select syc.id,1,jsonb_build_object('demo',true,'student',s.first_name||' '||s.last_name,
       'academic_year',ay.label,'certificate_type',syc.certificate_type,'certificate_number',syc.certificate_number,
       'student_academic_status',sar.status,'note','Synthetic sample; certificate does not change leaving status.'),
       'demo-v1','Synthetic annual certificate version.',syc.generated_by,syc.approved_by,coalesce(syc.issued_at,now())
from public.student_year_certificates syc
join public.student_academic_records sar on sar.id=syc.student_academic_record_id
join public.students s on s.id=sar.student_id
join public.academic_years ay on ay.id=sar.academic_year_id and ay.label='2026-2027'
where not exists (select 1 from public.certificate_versions cv where cv.student_year_certificate_id=syc.id and cv.version_number=1);

insert into public.audit_logs (actor_staff_id,action,entity_type,outcome,reason,after_snapshot)
select clerk.id,'DEMO_SEED_LOADED','database_seed','success',
       'Synthetic demo dataset; no real student records or file uploads.',
       jsonb_build_object('academic_year','2026-2027','seed_version',1)
from public.staff_members clerk
where clerk.email='clerk@school-demo.example'
and not exists (select 1 from public.audit_logs where action='DEMO_SEED_LOADED' and entity_type='database_seed');
COMMIT;
