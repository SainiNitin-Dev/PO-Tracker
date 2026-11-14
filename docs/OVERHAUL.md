# Overhaul audit and release checklist

This release replaces the inconsistent dark/bright-accent UI with a shared cream, charcoal and muted-olive design, and repairs the operations behind the screens. It does not migrate or delete production data automatically.

## Changes traced through the application

| Area | Problem addressed | Result |
| --- | --- | --- |
| Authentication | Cookie/session inconsistencies, unclear invitations and recovery | SSR cookie refresh, shared account guards, invite tokens/PKCE callbacks, password setup/recovery, account identity and logout |
| Authorization | Profile role changes and cross-owner references could weaken privacy | Display-name-only profile updates; owner checks and restrictive RLS for member tables/storage; catalog administrators excluded from private training data |
| Catalog | Foreign-key failures on removal, no safe bulk cleanup, confusing forms | Archive single/all gyms, exercises and gym availability; archive child availability atomically; search, edit, labels, dialogs and visible outcomes; historical references retained |
| Programs | Incomplete editing and fragile ordering | Create/select/activate/rename/delete plans, edit/reorder/remove days and exercises, type-specific targets, atomic active-plan and reorder operations |
| Workouts | Reps/time constraint failures, duplicate retries, partial starts | Validated tracking fields, atomic start/resume, target snapshots, stable set request IDs, edit/delete/copy sets and bounded saves |
| Workout recovery | Inputs lost on failure/refresh or at finish | Account/session-scoped local drafts for sets, notes and rest timer; explicit unsaved state; finish disabled until set/feedback edits saved or discarded; session locking across save/finish requests |
| History | Limited detail and misleading comparisons | Paginated sessions, saved sets/notes, same-equipment records, completed-versus-abandoned distinction and soreness feedback |
| Progress | Inaccurate counts and incomplete experiments | Completed-working-set totals; weighted muscle contribution; eight rolling weekly buckets; editable targets; baseline/comparison periods and recorded end dates; incomplete legacy results marked unavailable |
| Coach | Sparse context, generic responses, unverified numbers | Owner-scoped workouts, notes, plan, targets, effort, soreness and measurements; calculated facts inserted by the server; invalid numeric claims rejected; saved evidence, idempotent conversation exchange, editable notes and clear provider errors |
| Photos | Weak validation and unreliable upload/delete/review steps | MIME/size/owner checks, device compression, recoverable metadata-save step, edit/delete controls, same-pose comparison, input-aware review reuse and private signed URLs |
| Feedback | Unresponsive controls and missing navigation state | Shared button/focus styles, loading/error/empty states, pending indicators, disabled duplicate submissions, confirmations, offline status and error boundaries |
| Performance | Repeated reads, unbounded history, excess resource use | Request-level identity memoization, independent reads in parallel, indexed access paths, bounded history/context, no global fetch interception or background AI work |
| Maintenance | No-op linting and vulnerable transitive packages | Real Next/TypeScript lint rules, consistent formatting, unit/API tests, executable migration tests and updated lockfile |

## Verification

The local verification uses isolated database records and explicitly labelled temporary UI fixtures. Those fixture routes are removed before the release build; no demonstration accounts or training records are added to the shipped app.

- Unit/API tests cover validation, profile ownership, metrics, volume targets, progression, weekly totals, experiment periods, coach fact generation/response validation, photo validation and metadata-aware review reuse.
- `npm run test:db` applies all twelve migrations to real embedded PostgreSQL and checks ownership, privilege restrictions, atomic workout creation, retry behavior, reps/time constraints, edit/delete/finish behavior, archival with referenced history, plan deletion, coach exchanges and quotas, experiments and photo metadata cleanup.
- Browser checks use mobile (390 × 844) and desktop (1366 × 900) viewports. Tested landing/login states, catalog navigation and forms, bulk-removal confirmation, plan exercise editing and confirmation cancellation, history expansion, progress target controls, profile, coach notes, and photo empty/configuration states.
- Workout browser checks verify pending/disabled feedback, failure preserving input, restored set and exercise-note drafts after refresh, and blocking finish while changes are unsaved. A date hydration mismatch found during testing was corrected.
- Lint, type checking and production build must pass on the final commit. Dependency audit is checked against the final lockfile.

## Boundaries of the verification

No local Supabase project credentials or live AI credentials were available. Therefore **live login/invitation email delivery, recovery links, Supabase Storage HTTP operations, PostgREST relationship resolution, actual model replies and Vercel production latency have not been verified end-to-end**. UI fixtures exercise real components and local failure states; they are not evidence of successful remote writes. PGlite verifies SQL, constraints and RLS, but does not emulate the Supabase Auth, Storage or PostgREST services. The separate pgTAP suite has not been run against Supabase.

The coach restricts logged numeric claims to calculated facts and rejects unsupported placeholders/numbers. This is stronger grounding, not a guarantee that every piece of generated prose is correct. No claim of live coaching quality is made without provider testing. Visual photo reviews cannot measure body composition or diagnose health.

History displays 30 sessions per page. Records are labelled “Best in this view”; they are not advertised as an all-time result. Progress loads up to 300 completed sessions within 180 days. Coach context uses up to 48 completed sessions within 84 days, and discloses this limit. Photo management displays the newest 200 photos and 30 reviews. Existing older records remain in the database.

The previous service worker’s ownerless offline mutation queue is deliberately not replayed into the currently signed-in account. Existing queued records are not erased. New drafts are isolated by account and session; users must explicitly save after reconnecting.

## Deployment order

1. Apply 0009, 0010, 0011 and 0012 once each to the existing Supabase schema, in that order. Existing migrations 0001–0008 remain unchanged.
2. Update the Auth redirect allowlist for `/set-password` and `/auth/confirm` on the intended deployment origin.
3. Deploy the reviewed application commit using Vercel’s configured production branch after the SQL updates succeed.
4. Complete the live checks below. Keep the preceding deployment available as a rollback; do not reverse migrations by deleting user data.

## Live smoke checks

Use two member test accounts and one catalog administrator. Keep production training data intact.

1. Log in, refresh a protected page, and navigate. Verify profile name/email/role and logout. Use an invitation and a recovery email to set a password, including on an iPhone.
2. Add a gym and exercise, assign it to the gym and a muscle, edit the name, then remove individual and all availability entries. Confirm archived items disappear from new selections without breaking old history.
3. Create a member plan with a rep exercise and a timed exercise; edit/reorder its days and targets; activate another plan and switch back.
4. Start training, save a rep set and a timed set, refresh/resume, edit/copy/delete a set, save feedback and finish. Verify saved sets in history and the corresponding progress counts.
5. Disconnect while editing. Confirm no false success, reconnect and save once. Verify no duplicate set after retry, and no loss of drafts on refresh.
6. Ask the coach about a specific recorded session and compare every cited fact with history. Check an account with no logs receives an honest missing-data response. Confirm provider quota failures preserve the question and show a useful retry state.
7. Upload a small JPEG, edit its date/notes, compare two photos of the same pose, and delete a test photo. Confirm only the owner can access the image and its review.
8. With member B, verify member A’s session IDs/photos cannot be accessed. With the admin account, verify catalog management works while private member logs remain inaccessible.
9. Check Safari Add to Home Screen, bottom navigation, keyboard-visible forms, reload after deployment, and real request timing on Vercel/Supabase. No production speed claim should be made before these timings are measured.
