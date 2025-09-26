-- Change fact_check_references from text[] to jsonb
alter table articles 
alter column fact_check_references type jsonb using to_jsonb(fact_check_references);
