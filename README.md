# Progressive Overload Tracker

Phase 1 foundation: Supabase authentication, roles, gym/exercise administration, and database-enforced privacy.

## Free-tier deployment

1. Create a free Supabase project and run every migration in `supabase/migrations/` in numeric order. The first migration also creates the private photo bucket.
2. Copy `.env.example` to `.env.local` and fill its values. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
3. Run `npm install`, then `npm run dev`.
4. Create the first user in Supabase Auth, then promote that user once in the SQL editor:
   `update public.profiles set role = 'admin' where id = '<USER_UUID>';`
5. Add the same three environment variables in Vercel and deploy. The free tiers are sufficient for this initial small private app.

## Privacy verification

The migration enables and forces RLS on every private table. `supabase/tests/privacy.sql` is a runnable SQL verification suite for two normal users and an admin. Run it against a non-production Supabase project after applying the migration.

The service role intentionally bypasses RLS, and is used only by the server-side invite endpoint—not by browser code.
