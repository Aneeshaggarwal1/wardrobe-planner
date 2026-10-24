-- Exercises the migration's RLS and wp_commit as two different users.
-- Run: psql -v ON_ERROR_STOP=1 -f supabase-mock.sql -f ../migrations/0001_init.sql -f commit.test.sql
\set ON_ERROR_STOP 1
grant select, insert, update, delete on all tables in schema public to authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

-- 1. Add two items and an outfit in one commit.
select public.wp_commit($j${
  "upsert_items": [
    {"id":"aaaaaaaa-0000-0000-0000-000000000001","user_id":"ignored","image_url":"https://signed","image_path":"u/a1.jpg","thumb_path":"u/a1_thumb.jpg",
     "category":"top","subcategory":"formal shirt","primary_color":"white","secondary_color":null,"pattern":"solid","formality":4,"fit":null,
     "state":"ready","wears_before_wash":1,"wears_since_wash":0,"ironing_required":true,"last_worn_at":null,"tags_confirmed":true,"created_at":"2026-10-24T10:00:00.000Z"},
    {"id":"aaaaaaaa-0000-0000-0000-000000000002","user_id":"ignored","image_url":"x","category":"bottom","subcategory":"formal trousers",
     "primary_color":"navy","secondary_color":null,"pattern":"solid","formality":4,"fit":"slim","state":"ready","wears_before_wash":3,
     "wears_since_wash":0,"ironing_required":true,"last_worn_at":null,"tags_confirmed":false}
  ],
  "upsert_outfits": [
    {"id":"bbbbbbbb-0000-0000-0000-000000000001","user_id":"ignored","top_id":"aaaaaaaa-0000-0000-0000-000000000001","bottom_id":"aaaaaaaa-0000-0000-0000-000000000002",
     "shoes_id":null,"belt_id":null,"layer_id":null,"status":"approved","score":90,"reason":"White and navy: classic contrast","times_worn":0,"last_worn_at":null}
  ],
  "insert_feedback": [
    {"id":"cccccccc-0000-0000-0000-000000000001","outfit_id":"bbbbbbbb-0000-0000-0000-000000000001","decision":"approve",
     "features":{"top_color":"white","bottom_color":"navy"},"top_id":"aaaaaaaa-0000-0000-0000-000000000001","bottom_id":"aaaaaaaa-0000-0000-0000-000000000002","created_at":"2026-10-24T10:00:00Z"}
  ]
}$j$::jsonb);
select count(*) = 2 as items_ok from public.items;
select user_id = '11111111-1111-1111-1111-111111111111' as owner_from_jwt from public.items limit 1;

-- 2. Wear: update states, insert a log with an undo payload.
select public.wp_commit($j${
  "upsert_items": [{"id":"aaaaaaaa-0000-0000-0000-000000000001","category":"top","subcategory":"formal shirt","primary_color":"white","pattern":"solid","formality":4,
     "state":"in_laundry","wears_before_wash":1,"wears_since_wash":1,"ironing_required":true,"last_worn_at":"2026-10-24T03:00:00Z","tags_confirmed":true}],
  "upsert_outfits": [{"id":"bbbbbbbb-0000-0000-0000-000000000001","top_id":"aaaaaaaa-0000-0000-0000-000000000001","bottom_id":"aaaaaaaa-0000-0000-0000-000000000002",
     "status":"approved","score":90,"reason":"White and navy: classic contrast","times_worn":1,"last_worn_at":"2026-10-24T03:00:00Z"}],
  "insert_wear_logs": [{"id":"dddddddd-0000-0000-0000-000000000001","outfit_id":"bbbbbbbb-0000-0000-0000-000000000001","worn_on":"2026-10-24",
     "created_at":"2026-10-24T03:00:00Z","undo":{"wearLogId":"dddddddd-0000-0000-0000-000000000001"}}]
}$j$::jsonb);
select state = 'in_laundry' and wears_since_wash = 1 as wear_ok from public.items where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select (undo ->> 'wearLogId') is not null as undo_stored from public.wear_logs;

-- 3. Clear the undo payload, then delete the item: its outfit and log cascade away; feedback stays.
select public.wp_commit($j${"update_wear_logs":[{"id":"dddddddd-0000-0000-0000-000000000001","undo":null}]}$j$::jsonb);
select undo is null as undo_cleared from public.wear_logs;
select public.wp_commit('{"delete_items":["aaaaaaaa-0000-0000-0000-000000000001"]}'::jsonb);
select (select count(*) from public.outfits) = 0 and (select count(*) from public.wear_logs) = 0
       and (select count(*) from public.pair_feedback) = 1 as cascade_ok;

-- 4. A second user sees nothing and cannot change the first user's rows.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select count(*) = 0 as isolation_read_ok from public.items;
select public.wp_commit('{"delete_items":["aaaaaaaa-0000-0000-0000-000000000002"]}'::jsonb);
do $$
begin
  perform public.wp_commit($j${"upsert_items":[{"id":"aaaaaaaa-0000-0000-0000-000000000002","category":"bottom","subcategory":"jeans","primary_color":"black",
     "pattern":"solid","formality":2,"state":"ready","wears_before_wash":5,"wears_since_wash":0,"ironing_required":false,"tags_confirmed":true}]}$j$::jsonb);
  raise notice 'upsert over another user''s id: no error (row untouched by WHERE)';
exception when others then
  raise notice 'upsert over another user''s id refused: %', sqlerrm;
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select subcategory = 'formal trousers' as isolation_write_ok from public.items where id = 'aaaaaaaa-0000-0000-0000-000000000002';

-- 5. Signed-out calls are refused.
select set_config('request.jwt.claim.sub', '', false);
do $$ begin perform public.wp_commit('{}'::jsonb); raise exception 'should have failed';
exception when others then if sqlerrm <> 'Not signed in' then raise; end if; raise notice 'signed out refused'; end $$;
