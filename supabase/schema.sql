-- Run once in Supabase SQL Editor. Phase 1 only.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 reality_name text check (char_length(reality_name) between 1 and 40),
 verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','rejected')),
 verification_code text,
 updated_at timestamptz not null default now()
);
create table if not exists public.reality_name_history (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 old_name text, new_name text not null, changed_at timestamptz not null default now()
);
create table if not exists public.ticket_ledger (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 delta integer not null check(delta <> 0),
 reason text not null check(reason in ('admin_grant','admin_revoke','draw')),
 admin_id uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists ticket_ledger_user_idx on public.ticket_ledger(user_id,created_at desc);
create or replace function public.profile_insert_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 new.verification_status:='unverified';new.verification_code:=null;new.updated_at:=now();
 if new.reality_name is not null then insert into public.reality_name_history(user_id,old_name,new_name) values(new.id,null,new.reality_name);end if;
 return new;
end $$;
create or replace function public.profile_update_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 new.updated_at:=now();
 if new.reality_name is distinct from old.reality_name and new.reality_name is not null then
 insert into public.reality_name_history(user_id,old_name,new_name) values(new.id,old.reality_name,new.reality_name);end if;
 return new;
end $$;
drop trigger if exists profile_insert_guard on public.profiles;
create trigger profile_insert_guard before insert on public.profiles for each row execute function public.profile_insert_guard();
drop trigger if exists profile_update_guard on public.profiles;
create trigger profile_update_guard before update on public.profiles for each row execute function public.profile_update_guard();
create or replace function public.request_reality_verification() returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
 if uid is null then raise exception 'Not authenticated';end if;
 if not exists(select 1 from public.profiles where id=uid and reality_name is not null) then raise exception 'Register REALITY name first';end if;
 update public.profiles set verification_status='pending', verification_code=upper(encode(gen_random_bytes(4),'hex')) where id=uid and verification_status <> 'verified';
end $$;
revoke all on function public.request_reality_verification() from public,anon;
grant execute on function public.request_reality_verification() to authenticated;
alter table public.profiles enable row level security;
alter table public.reality_name_history enable row level security;
alter table public.ticket_ledger enable row level security;
drop policy if exists profiles_own_select on public.profiles;
create policy profiles_own_select on public.profiles for select to authenticated using ((select auth.uid())=id);
drop policy if exists profiles_own_insert on public.profiles;
create policy profiles_own_insert on public.profiles for insert to authenticated with check ((select auth.uid())=id);
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
drop policy if exists ticket_own_select on public.ticket_ledger;
create policy ticket_own_select on public.ticket_ledger for select to authenticated using ((select auth.uid())=user_id);
-- No user INSERT/UPDATE/DELETE policies on ticket_ledger or reality_name_history.
-- The admin API uses a server-only service-role key.

-- Only REALITY name (and stable id for upsert) can be updated by users.
revoke update on public.profiles from authenticated;
grant update (id,reality_name) on public.profiles to authenticated;
