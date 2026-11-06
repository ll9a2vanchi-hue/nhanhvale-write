-- Applied to Supabase project aiqqnssdnzjelpcyzlqp on 2026-11-06.
create index if not exists write_xp_events_user_id_idx on public.write_xp_events (user_id);
