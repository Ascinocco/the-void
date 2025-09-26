-- Enable the pg_cron extension
create extension if not exists pg_cron with schema extensions;

-- Create a function to call our edge function
create or replace function call_fetch_feeds()
returns void
language plpgsql
as $$
begin
  -- Make HTTP request to the edge function
  perform
    net.http_post(
      url := 'https://your-project-ref.supabase.co/functions/v1/fetch-feeds',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || 'your-anon-key',
        'Content-Type', 'application/json'
      )
    );
end;
$$;

-- Schedule the function to run every hour
-- Note: Replace 'call_fetch_feeds' with your actual function call
-- This will only work when deployed to Supabase (pg_cron not available locally)
select cron.schedule(
  'fetch-feeds-hourly',
  '0 * * * *', -- Every hour
  'select call_fetch_feeds();'
);
