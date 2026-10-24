-- Izvršiti nakon objavljivanja aplikacije. Tajne prethodno uneti u Supabase Vault:
-- streberaj_app_url = https://vas-domen
-- streberaj_cron_secret = ista vrednost kao serverski CRON_SECRET
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('streberaj-google-uvoz','* * * * *',$$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='streberaj_app_url') || '/api/sync',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='streberaj_cron_secret')),
  body:='{}'::jsonb,
  timeout_milliseconds:=55000
 );
$$);
