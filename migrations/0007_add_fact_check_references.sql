-- Add fact_check_references field to articles table
alter table articles 
add column fact_check_references text[];
