-- ════════════════════════════════════════════════════════════════
-- SEED · พี่ปุ๊ก — Lab results 3 ปี (PhyaThai 2 · 2566/2567/2568)
-- Lipid + Glucose + Liver + Kidney + CBC (thalassemia trait)
-- Run AFTER seed_pook_whoop.sql (uses same customer)
-- ════════════════════════════════════════════════════════════════

do $$
declare v_coach uuid; v_cust uuid; v_rec uuid;
begin
  -- match customer ที่มีอยู่ (ชื่อใหม่หรือเก่า) + เอา coach จาก record เดิม
  select id, coach_id into v_cust, v_coach from public.customers
    where name in ('พี่ปุ๊ก', 'พี่ปุ๊ก (พี่ตูน)') order by created_at limit 1;
  if v_cust is null then raise exception 'ไม่พบ customer พี่ปุ๊ก — run seed_pook_whoop.sql ก่อน'; end if;
  if v_coach is null then select id into v_coach from auth.users order by created_at limit 1; end if;

  delete from public.customer_lab_values where customer_id=v_cust;
  delete from public.customer_records where customer_id=v_cust;

  -- ตรวจสุขภาพ ปี พ.ศ.2566 (= ค.ศ.2023-03-17)
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
  values (v_cust, '2023-03-17', 'โรงพยาบาลพญาไท 2', 'annual_physical', 'ตรวจสุขภาพประจำปี', v_coach) returning id into v_rec;
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'lipid','cholesterol','คอเลสเตอรอลรวม','Total Cholesterol','197',197,'mg/dl',0,200,NULL,'normal','2023-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'lipid','hdl','เอชดีแอล (ไขมันดี)','HDL','81',81,'mg/dl',40,NULL,'>40','normal','2023-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'lipid','ldl','แอลดีแอล (ไขมันเลว)','LDL','108',108,'mg/dl',0,160,NULL,'normal','2023-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'lipid','triglyceride','ไตรกลีเซอไรด์','Triglyceride','39',39,'mg/dl',0,170,NULL,'normal','2023-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'glucose','fbs','น้ำตาลในเลือด','Fasting Blood Sugar','89',89,'mg/dl',70,100,NULL,'normal','2023-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'glucose','hba1c','น้ำตาลสะสม','HbA1c','5.6',5.6,'%',0,5.7,NULL,'normal','2023-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'liver','ast_sgot','เอนไซม์ตับ AST','SGOT/AST','21',21,'U/L',0,40,NULL,'normal','2023-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'liver','alt_sgpt','เอนไซม์ตับ ALT','SGPT/ALT','15',15,'U/L',0,40,NULL,'normal','2023-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'liver','alp','Alkaline Phosphatase','ALP','60',60,'U/L',0,117,NULL,'normal','2023-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'kidney','bun','การทำงานของไต BUN','BUN','17',17,'mg/dl',5,20,NULL,'normal','2023-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'kidney','creatinine','ครีอะตินิน','Creatinine','0.63',0.63,'mg/dl',0,0.95,NULL,'normal','2023-03-17');

  -- ตรวจสุขภาพ ปี พ.ศ.2567 (= ค.ศ.2024-04-20)
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
  values (v_cust, '2024-04-20', 'โรงพยาบาลพญาไท 2', 'annual_physical', 'ตรวจสุขภาพประจำปี', v_coach) returning id into v_rec;
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'lipid','cholesterol','คอเลสเตอรอลรวม','Total Cholesterol','214',214,'mg/dl',0,200,NULL,'high','2024-04-20');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'lipid','hdl','เอชดีแอล (ไขมันดี)','HDL','91',91,'mg/dl',40,NULL,'>40','normal','2024-04-20');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'lipid','ldl','แอลดีแอล (ไขมันเลว)','LDL','116',116,'mg/dl',0,160,NULL,'normal','2024-04-20');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'lipid','triglyceride','ไตรกลีเซอไรด์','Triglyceride','34',34,'mg/dl',0,170,NULL,'normal','2024-04-20');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'glucose','fbs','น้ำตาลในเลือด','Fasting Blood Sugar','86',86,'mg/dl',70,100,NULL,'normal','2024-04-20');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'liver','ast_sgot','เอนไซม์ตับ AST','SGOT/AST','28',28,'U/L',0,40,NULL,'normal','2024-04-20');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'liver','alt_sgpt','เอนไซม์ตับ ALT','SGPT/ALT','18',18,'U/L',0,40,NULL,'normal','2024-04-20');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'liver','alp','Alkaline Phosphatase','ALP','63',63,'U/L',0,117,NULL,'normal','2024-04-20');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'kidney','bun','การทำงานของไต BUN','BUN','15',15,'mg/dl',5,20,NULL,'normal','2024-04-20');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'kidney','creatinine','ครีอะตินิน','Creatinine','0.71',0.71,'mg/dl',0,0.95,NULL,'normal','2024-04-20');

  -- ตรวจสุขภาพ ปี พ.ศ.2568 (= ค.ศ.2025-03-17)
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
  values (v_cust, '2025-03-17', 'โรงพยาบาลพญาไท 2', 'annual_physical', 'ตรวจสุขภาพประจำปี', v_coach) returning id into v_rec;
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'lipid','cholesterol','คอเลสเตอรอลรวม','Total Cholesterol','205',205,'mg/dl',0,200,NULL,'high','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'lipid','hdl','เอชดีแอล (ไขมันดี)','HDL','82',82,'mg/dl',40,NULL,'>40','normal','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'lipid','ldl','แอลดีแอล (ไขมันเลว)','LDL','115',115,'mg/dl',0,160,NULL,'normal','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'lipid','triglyceride','ไตรกลีเซอไรด์','Triglyceride','40',40,'mg/dl',0,170,NULL,'normal','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'glucose','fbs','น้ำตาลในเลือด','Fasting Blood Sugar','86',86,'mg/dl',70,100,NULL,'normal','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'glucose','hba1c','น้ำตาลสะสม','HbA1c','5.1',5.1,'%',0,5.7,NULL,'normal','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'uric','uric_acid','กรดยูริค','Uric Acid','5.1',5.1,'mg/dl',0,7.2,NULL,'normal','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'liver','ast_sgot','เอนไซม์ตับ AST','SGOT/AST','56',56,'U/L',0,40,NULL,'high','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'liver','alt_sgpt','เอนไซม์ตับ ALT','SGPT/ALT','33',33,'U/L',0,40,NULL,'normal','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'liver','alp','Alkaline Phosphatase','ALP','52',52,'U/L',0,117,NULL,'normal','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'kidney','bun','การทำงานของไต BUN','BUN','16',16,'mg/dl',5,20,NULL,'normal','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'kidney','creatinine','ครีอะตินิน','Creatinine','0.64',0.64,'mg/dl',0,0.95,NULL,'normal','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'cbc','hb','ฮีโมโกลบิน','Hemoglobin','11.4',11.4,'g/dl',12.0,16.0,NULL,'low','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'cbc','hct','ฮีมาโตคริต','Hematocrit','35.7',35.7,'%',35.0,48.0,NULL,'normal','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'cbc','mcv','ขนาดเม็ดเลือดแดง MCV','MCV','68.7',68.7,'fL',80,100,NULL,'low','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'cbc','mch','MCH','MCH','21.9',21.9,'pg',27,33,NULL,'low','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'cbc','wbc','เม็ดเลือดขาว','WBC','5390',5390,'/mm3',3700,10000,NULL,'normal','2025-03-17');
  insert into public.customer_lab_values (record_id,customer_id,category,metric_key,metric_label_th,metric_label_en,value,value_num,unit,ref_low,ref_high,ref_text,status,recorded_at) values (v_rec,v_cust,'cbc','platelet','เกล็ดเลือด','Platelet','242000',242000,'/mm3',138000,400000,NULL,'normal','2025-03-17');

  raise notice 'พี่ปุ๊ก labs seeded: cust=%', v_cust;
end $$;