# Progressive

A private training app built with Next.js, Supabase Auth/Postgres/Storage, and Vercel. Members manage plans, log workouts, review progress and photos, and ask a coach grounded in their own records. Administrators manage the gym catalog and invitations, without access to members’ private training data.

## Upgrading the existing deployment

Apply any missing migrations below before deploying this version.

1. Retain a database export using your normal backup process. In Supabase SQL Editor, run the complete contents of these files in order, once each:
   - `supabase/migrations/0009_security_and_catalog.sql`
   - `supabase/migrations/0010_reliable_training.sql`
   - `supabase/migrations/0011_coach_and_photo_reliability.sql`
   - `supabase/migrations/0012_progress_and_profile.sql`
   - `supabase/migrations/0013_bulk_muscle_mapping.sql`
   - `supabase/migrations/0014_copy_member_plan.sql`
   - `supabase/migrations/0015_separate_coach_chats.sql`
2. Each file must finish successfully before continuing. These updates retain accounts, workout rows, catalog references, photos and chat history. Catalog removal archives items instead of deleting historical references.
3. In Supabase **Authentication → URL Configuration**, set the Site URL to your production origin, and allow these exact redirect URLs:
   - `https://personalised-overload-tracker.vercel.app/set-password`
   - `https://personalised-overload-tracker.vercel.app/auth/confirm`
   Add corresponding preview URLs only if you intend to test authentication on that preview.
4. Keep the environment variables below in Vercel. Set them for the environment being deployed. Public Supabase values require a rebuild when changed.
5. Merge the reviewed overhaul branch into Vercel’s configured production branch, then verify the deployment commit and status. A push to a different branch normally creates a preview; it does not update the production domain.
6. Use an admin account for catalog/invitations and a separate member account for training. Run the smoke checks in [the release checklist](docs/OVERHAUL.md#live-smoke-checks).

If SQL reports an existing relation or policy, stop and check which files have already been applied rather than deleting tables. Files 0009–0012 are updates, not a database reset. Manually running SQL Editor files does not automatically populate the Supabase CLI migration history.

If you already ran the early version of `0010_reliable_training.sql` from the interim overhaul, run the current version of that file again. It safely updates the workout functions and installs the new set removal and exercise feedback functions. Skip the other migrations you have already applied.

## Environment variables

| Variable | Value / purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project publishable key, or legacy anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase secret/service-role key; used only for invitations |
| `CHAT_API_BASE_URL` | Existing OpenAI-compatible provider base URL; Groq uses `https://api.groq.com/openai/v1` |
| `CHAT_API_KEY` | Server-only provider key |
| `CHAT_MODEL` | Your configured chat model, currently `openai/gpt-oss-120b` |
| `VISION_API_BASE_URL` | Base URL for your separate image-capable model |
| `VISION_API_KEY` | Server-only vision provider key |
| `VISION_MODEL` | Image-capable model supported by that provider |

The text coach and photo comparison have separate configuration. Basic training works without AI keys. Never put secret/service-role/provider keys in a `NEXT_PUBLIC_` variable or commit `.env.local`.

Invited members open the email, choose a password, and sign in. Existing members can use **Forgot password**. Invitation delivery depends on your Supabase email configuration and its limits; the app shows a useful error if delivery fails.

## Fresh installation

Run all migration files in numeric order on an empty Supabase project. Create your first account in Supabase Auth and promote it once from SQL Editor:

```sql
update public.profiles set role = 'admin' where id = '<AUTH_USER_UUID>';
```

Use that account to add a gym, exercises, muscle mappings, and gym availability. Invite a member account to create a training plan and log workouts.

## Local development and checks

Use Node.js 22 LTS and the committed lockfile.

```sh
npm ci
# Copy .env.example to .env.local and fill the public Supabase values.
npm run dev

npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
```

`test:db` runs all migrations in isolated, ephemeral PostgreSQL via PGlite. It does not touch your Supabase project. `supabase/tests/privacy.sql` is an additional pgTAP suite for a disposable Supabase test project; it is not part of the local PGlite run. The [audit and verification record](docs/OVERHAUL.md) explains test coverage and external checks still needed.

## Keeping resource use low

- No paid service, realtime subscription, cron job, background AI loop, or additional production database is introduced. Vercel remains in `bom1`.
- Chat requests: 20 per member/day, 100 across the app/day, with a 10-second cooldown. Photo reviews: 4 per member/calendar month, 10 across the app/day, with a 30-second cooldown. Limits are enforced atomically in Postgres; failed provider attempts count.
- One bounded provider call per request, with no automatic AI retries. Unchanged photo comparisons reuse their saved review.
- Photo uploads accept JPEG/PNG/WebP up to 8 MB, resize to at most 1600 px, and encode on the device before uploading. HEIC files must be exported as JPEG first.
- History and context reads have explicit limits. AI allowance records older than 32 days are cleaned during new reservations.
- Keep your accounts on their free plans and monitor provider dashboards. Application limits reduce use but cannot guarantee that an account’s external quota will never be exhausted; provider quota failures are surfaced to the user.

## Offline behavior and iPhone installation

In Safari, open the production URL, tap Share, then **Add to Home Screen**. The service worker caches only the public offline page and logo, never private pages or API responses. Saved workouts resume from the server. Unsaved set and workout-note drafts are kept per account on the device; reconnect and explicitly save them. The app never claims an offline change has reached the server.
