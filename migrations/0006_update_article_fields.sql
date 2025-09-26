-- Update articles table: remove content, add summary, fact_check, and related_content
alter table articles 
drop column content,
add column summary text,
add column fact_check text,
add column related_content text[];
