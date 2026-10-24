-- Wardrobe Planner: database schema.
-- Run once in Supabase → SQL Editor → New query → paste this file → Run.
-- Safe to re-run: every statement is idempotent.

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.items (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  image_path        text,
  thumb_path        text,
  category          text not null check (category in ('top', 'bottom', 'shoes', 'belt', 'layer')),
  subcategory       text not null,
  primary_color     text not null,
  secondary_color   text,
  pattern           text not null check (pattern in ('solid', 'stripe', 'check', 'print', 'textured')),
  formality         int  not null check (formality between 1 and 5),
  fit               text check (fit in ('slim', 'regular', 'relaxed')),
  state             text not null default 'ready'
                      check (state in ('ready', 'needs_ironing', 'in_laundry', 'unavailable')),
  wears_before_wash int  not null default 1 check (wears_before_wash >= 1),
  wears_since_wash  int  not null default 0 check (wears_since_wash >= 0),
  ironing_required  boolean not null default true,
  last_worn_at      timestamptz,
  tags_confirmed    boolean not null default false,
  created_at        timestamptz not null default now()
);

create table if not exists public.outfits (
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  top_id       uuid not null references public.items (id) on delete cascade,
  bottom_id    uuid not null references public.items (id) on delete cascade,
  shoes_id     uuid references public.items (id) on delete set null,
  belt_id      uuid references public.items (id) on delete set null,
  layer_id     uuid references public.items (id) on delete set null,
  status       text not null check (status in ('candidate', 'approved', 'rejected')),
  score        real not null default 0,
  reason       text not null default '',
  times_worn   int  not null default 0,
  last_worn_at timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.wear_logs (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  outfit_id  uuid not null references public.outfits (id) on delete cascade,
  worn_on    date not null,
  created_at timestamptz not null default now(),
  undo       jsonb
);

-- No foreign keys on purpose: taste signals survive deleting the item or outfit.
create table if not exists public.pair_feedback (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  outfit_id  uuid not null,
  decision   text not null check (decision in ('approve', 'reject')),
  features   jsonb not null,
  top_id     uuid not null,
  bottom_id  uuid not null,
  created_at timestamptz not null default now()
);

-- One row per AI call, for the daily caps.
create table if not exists public.usage (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('tag', 'generate')),
  created_at timestamptz not null default now()
);

create index if not exists items_user_idx on public.items (user_id);
create index if not exists outfits_user_idx on public.outfits (user_id);
create index if not exists wear_logs_user_idx on public.wear_logs (user_id, worn_on);
create index if not exists pair_feedback_user_idx on public.pair_feedback (user_id);
create index if not exists usage_user_day_idx on public.usage (user_id, kind, created_at);

-- ─── Row-level security: every user sees and changes only their own rows ────

alter table public.items enable row level security;
alter table public.outfits enable row level security;
alter table public.wear_logs enable row level security;
alter table public.pair_feedback enable row level security;
alter table public.usage enable row level security;

drop policy if exists "own items" on public.items;
create policy "own items" on public.items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own outfits" on public.outfits;
create policy "own outfits" on public.outfits for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own wear logs" on public.wear_logs;
create policy "own wear logs" on public.wear_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own feedback" on public.pair_feedback;
create policy "own feedback" on public.pair_feedback for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Usage rows can be read and added, never edited or deleted by the user.
drop policy if exists "read own usage" on public.usage;
create policy "read own usage" on public.usage for select to authenticated using (user_id = auth.uid());
drop policy if exists "add own usage" on public.usage;
create policy "add own usage" on public.usage for insert to authenticated with check (user_id = auth.uid());

-- ─── Photo storage: a private bucket, one folder per user ───────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe', 'wardrobe', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "wardrobe: own folder read" on storage.objects;
create policy "wardrobe: own folder read" on storage.objects for select to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "wardrobe: own folder write" on storage.objects;
create policy "wardrobe: own folder write" on storage.objects for insert to authenticated
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "wardrobe: own folder update" on storage.objects;
create policy "wardrobe: own folder update" on storage.objects for update to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "wardrobe: own folder delete" on storage.objects;
create policy "wardrobe: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── wp_commit: apply one change set atomically ─────────────────────────────
-- The app computes every change in TypeScript (lib/ops.ts, the same rules demo
-- mode uses), diffs before/after, and sends the diff here. Everything below
-- runs in one transaction, as the signed-in user, under the policies above.

-- Rows of one diff key, with any client-sent user_id removed: ownership always
-- comes from the session, never from the payload.
create or replace function public.wp_rows(diff jsonb, key text)
returns jsonb
language sql
immutable
as $$
  select coalesce((select jsonb_agg(e - 'user_id') from jsonb_array_elements(coalesce(diff -> key, '[]')) e), '[]')
$$;

create or replace function public.wp_commit(diff jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  delete from public.wear_logs
   where user_id = uid
     and id in (select x::uuid from jsonb_array_elements_text(coalesce(diff -> 'delete_wear_logs', '[]')) x);
  delete from public.outfits
   where user_id = uid
     and id in (select x::uuid from jsonb_array_elements_text(coalesce(diff -> 'delete_outfits', '[]')) x);
  delete from public.items
   where user_id = uid
     and id in (select x::uuid from jsonb_array_elements_text(coalesce(diff -> 'delete_items', '[]')) x);

  insert into public.items as t (
    id, user_id, image_path, thumb_path, category, subcategory, primary_color, secondary_color,
    pattern, formality, fit, state, wears_before_wash, wears_since_wash, ironing_required,
    last_worn_at, tags_confirmed, created_at)
  select r.id, uid, r.image_path, r.thumb_path, r.category, r.subcategory, r.primary_color,
         r.secondary_color, r.pattern, r.formality, r.fit, r.state, r.wears_before_wash,
         r.wears_since_wash, r.ironing_required, r.last_worn_at, r.tags_confirmed,
         coalesce(r.created_at, now())
    from jsonb_populate_recordset(null::public.items, public.wp_rows(diff, 'upsert_items')) r
  on conflict (id) do update set
    category = excluded.category, subcategory = excluded.subcategory,
    primary_color = excluded.primary_color, secondary_color = excluded.secondary_color,
    pattern = excluded.pattern, formality = excluded.formality, fit = excluded.fit,
    state = excluded.state, wears_before_wash = excluded.wears_before_wash,
    wears_since_wash = excluded.wears_since_wash, ironing_required = excluded.ironing_required,
    last_worn_at = excluded.last_worn_at, tags_confirmed = excluded.tags_confirmed
  where t.user_id = uid;

  insert into public.outfits as t (
    id, user_id, top_id, bottom_id, shoes_id, belt_id, layer_id, status, score, reason,
    times_worn, last_worn_at, created_at)
  select r.id, uid, r.top_id, r.bottom_id, r.shoes_id, r.belt_id, r.layer_id, r.status, r.score,
         r.reason, r.times_worn, r.last_worn_at, coalesce(r.created_at, now())
    from jsonb_populate_recordset(null::public.outfits, public.wp_rows(diff, 'upsert_outfits')) r
  on conflict (id) do update set
    shoes_id = excluded.shoes_id, belt_id = excluded.belt_id, layer_id = excluded.layer_id,
    status = excluded.status, score = excluded.score, reason = excluded.reason,
    times_worn = excluded.times_worn, last_worn_at = excluded.last_worn_at
  where t.user_id = uid;

  insert into public.wear_logs (id, user_id, outfit_id, worn_on, created_at, undo)
  select r.id, uid, r.outfit_id, r.worn_on, coalesce(r.created_at, now()), r.undo
    from jsonb_populate_recordset(null::public.wear_logs, public.wp_rows(diff, 'insert_wear_logs')) r;

  update public.wear_logs w
     set undo = r.undo
    from jsonb_populate_recordset(null::public.wear_logs, public.wp_rows(diff, 'update_wear_logs')) r
   where w.id = r.id and w.user_id = uid;

  insert into public.pair_feedback (id, user_id, outfit_id, decision, features, top_id, bottom_id, created_at)
  select r.id, uid, r.outfit_id, r.decision, r.features, r.top_id, r.bottom_id, coalesce(r.created_at, now())
    from jsonb_populate_recordset(null::public.pair_feedback, public.wp_rows(diff, 'insert_feedback')) r
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.wp_commit(jsonb) from public, anon;
grant execute on function public.wp_commit(jsonb) to authenticated;
