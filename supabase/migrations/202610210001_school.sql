-- Privatna serverska evidencija: klijenti nemaju direktan pristup podacima.
-- Jedan atomski snimak sprečava trke između rezervacija, uplata i brojača.
create table if not exists public.school_state (
  id boolean primary key default true check (id),
  revision bigint not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.school_state enable row level security;
revoke all on public.school_state from anon, authenticated;
grant all on public.school_state to service_role;
insert into public.school_state(id) values(true) on conflict do nothing;

create or replace function public.save_school_state(p_expected_revision bigint,p_data jsonb)
returns boolean language plpgsql security invoker set search_path = public as $$
declare changed integer;
begin
  if jsonb_typeof(p_data) <> 'object' then raise exception 'Neispravan snimak'; end if;
  update public.school_state set data=p_data,revision=revision+1,updated_at=now()
    where id=true and revision=p_expected_revision;
  get diagnostics changed = row_count;
  return changed=1;
end $$;
revoke all on function public.save_school_state(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.save_school_state(bigint,jsonb) to service_role;

