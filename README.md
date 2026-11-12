# Teacher's Daily Planner & LMS

A static HTML, CSS, and JavaScript app for daily teaching diaries, period attachments, principal reviews, timetable imports, and slow learner progress tracking. Supabase provides authentication, database access, private file storage, and inbox notifications. Browser storage holds settings, cached data, and local records.

## Run locally

```bash
git clone https://github.com/Pragament/html_teacher_diary.git
cd html_teacher_diary
python3 -m http.server 8000
```

Open [the local landing page](http://localhost:8000/index.html). The other entry points are `dashboard.html` and `slow_learner.html`; connected use requires a school configuration and authenticated session.

There is no build step, application server, or npm start/test script. The pages load ordinary deferred scripts and browser libraries from CDNs. `npm install` is not required to serve the current frontend. Use HTTP on localhost for development and HTTPS for deployment so service workers and authentication can operate.

## Sign-in and school connection

1. Click **Login with Google** on the landing page.
2. If no school is stored, enter an active school code. The app looks it up in [config/schools.v1.json](config/schools.v1.json), initializes that project's Supabase client, and continues Google sign-in.
3. After authentication, the app redirects to `dashboard.html`. The school selection is remembered in browser storage.

Email/password sign-in, registration, and demo buttons remain in the authentication overlay and handlers. The visible landing page's main entry point is Google login. **Continue in Offline Local Mode** is available in the school connection and authentication overlays. Demo Teacher and Demo Principal use local demo state rather than real Supabase accounts.

Offline mode uses a separate local diary storage key. Cloud submissions, approvals, uploads, and notifications require an authenticated connection. Initial loading still depends on assets being available; the service worker caches same-origin resources but does not cache third-party CDN libraries or Supabase requests. Use explicit Save actions and CSV exports; the current code does not wire up a periodic/debounced diary autosave or a background retry queue.

## Teacher workflow

1. Open **Daily Entry**, select a date, and enter class, section, subject, classwork, and homework for each period. The default is eight periods; change the period count and curriculum selection in Settings. A configured timetable supplies class/subject defaults.
2. Type `#` for curriculum tag suggestions. **Copy from previous** uses saved local activity records; it is not a guaranteed copy of yesterday's cloud diary.
3. Attach files to a period. The browser allows up to **10 MB per file**, **10 files per period**, and **50 MB per period**. Current uploads use private `period_files` objects and one-hour signed URLs.
4. Click **Save** for a draft or **Submit for Approval** for review. Draft revisions are updated in place; saving after a non-draft revision creates a new revision. Submitted and approved entries appear locked in the editor. Revision requests display feedback and allow resubmission.
5. Use the past-activities view to search/filter entries, inspect revision history, and import/export activity CSVs. A Delete action is also available for daily entries.

**Save** or **Ctrl/⌘ + S** is the supported explicit diary save path. A failed cloud save can display an offline-save message, but `saveEntryToSupabase()` returns early on several failures before writing the local day record. Verify saved records or export a copy before leaving the page after a sync failure.

## Slow learner progress

Open **Slow Learner Progress** from Daily Entry. The selected date is passed to `slow_learner.html?date=YYYY-MM-DD`.

- Choose class and section, then enter a student name or use autocomplete. Suggestions come from [data/test_students.csv](data/test_students.csv), not a Supabase student directory.
- Record subject, learning gap, strategy/method, progress, and next step.
- **Save Changes** persists locally, attempts cloud sync when connected, and returns to the dashboard. Switching dates preserves current edits locally without performing that cloud sync.
- **Export CSV** downloads a copy. Cloud sync sends named students only and replaces the current teacher's rows for the selected date.

The bundled directory uses headers `student_id,student_name,class,section,roll_no`. The page fetches this static file directly, so any directory placed there is served to clients. The current progress page fetches and edits the signed-in teacher's own entries, even when the user's role has broader database read permissions.

## Principal review and administration

The **Principal Dashboard** provides pending review and approved history views, teacher/class/subject/date filters, review dialogs, attachments, and audit timelines.

- **Sign & Approve** marks entries approved and writes signature records containing a generated hash, signer, timestamp, and optional remarks.
- **Request Revision** records feedback and sets `revision_requested`.
- **Reject** also uses `revision_requested`, with a standard rejection note and a rejection notification. There is no separate `rejected` diary status.
- Teacher analytics use the last 30 days, with an approximate 22-working-day completion denominator.
- KPI cards summarize teachers, pending diaries, approved diary owners for today's diary date, missing entries, and late submissions. They are fetched when the dashboard renders; only inbox notifications subscribe to Supabase Realtime. The late cutoff defaults to 16:00 and is stored in the current browser.

Admins and super admins also receive the **Admin Panel** for timetable CSV upload:

```csv
Teacher Email,Day (1-7),Period (1-8),Class-Section,Subject
teacher1@school.com,1,1,10A,Mathematics
teacher1@school.com,1,2,10B,Mathematics
```

Day 1 is Monday and day 7 is Sunday. Include a header row; the importer skips it. Teachers must already have matching email profiles in `public.users`. Each row upserts by teacher, weekday, and period. The importer splits values on commas and does not support quoted commas inside values.

### Role behavior

The database accepts `teacher`, `principal`, `vice_principal`, `hod`, `admin`, and `super_admin`. Profile rows are created/updated by browser sign-in logic. New profiles normally start as teachers, although the implementation can reuse a cached role. Assign elevated roles deliberately in `public.users`; [principal_role.sql](principal_role.sql) is a manual example requiring an actual email.

| Role | Principal tab shown | Admin tab shown | Slow learner page |
| --- | --- | --- | --- |
| Teacher | No | No | Own entries |
| Principal | Yes | No | Own entries |
| Vice principal | No | No | Own entries |
| HOD | No | No | Own entries |
| Admin / super admin | Yes | Yes | Own entries |

This table describes `applyRoleBasedUI()` in [js/ui.js](js/ui.js). Database RLS grants vice principals and HODs additional reads that are not exposed as matching dashboard tabs. Daily Entry remains available across roles; submission visibility follows entry/authentication state rather than a teacher-only role check. See [supabase_schema.md](supabase_schema.md) for actual database permissions and known policy limitations.

## Backend configuration

### Connect a school

Add a school entry in [config/schools.v1.json](config/schools.v1.json):

```json
{
  "MYSCHOOL": {
    "schoolName": "Example School",
    "status": "active",
    "supabaseUrl": "https://<project-id>.supabase.co",
    "anonKey": "<browser-safe-public-key>"
  }
}
```

School codes route to Supabase projects. The final checked-in schema is **single school per project**: it removes `schools` and core `school_id` columns. Mapping multiple school codes to the same project does not isolate their records.

[js/env.js](js/env.js) supplies a legacy `window.ENV` fallback for `getSupabaseClient()`:

```javascript
window.ENV = {
  SUPABASE_URL: 'https://<project-id>.supabase.co',
  SUPABASE_KEY: '<browser-safe-public-key>'
};
```

This fallback does not replace the school-selection bootstrap or initialize `window.App.supabase`, which the auth flow requires. The static app does not automatically read `.env`; no generation/build script is defined in `package.json`. Browser configuration must use public keys; privileged keys and Google client secrets belong in backend/provider configuration.

### Database, authentication, and storage

Read [supabase_schema.md](supabase_schema.md) before provisioning. It documents 11 defined public tables, relationships, RLS, functions, Storage paths, and missing app contracts.

| File | Purpose |
| --- | --- |
| [all_migrations.sql](all_migrations.sql) | Historical core/workflow/notification/curriculum migrations, ending in the single-school refactor |
| [slow_learner_migration.sql](slow_learner_migration.sql) | Remedial progress table, indexes, RLS, and updated_at trigger |
| [migration_add_delete_policy.sql](migration_add_delete_policy.sql) | Entry deletion permissions and cascading signature deletion |
| [principal_role.sql](principal_role.sql) | Manual principal role-assignment example |

The combined SQL is not a reliable one-click fresh-project installer. Some policies reference `get_my_role()` before its definition; policy/trigger/publication creation is not consistently repeatable; and legacy/content tables referenced by JavaScript have no checked-in definitions. Reconcile ordering and existing database objects before applying it. The schema document lists these gaps and existing RLS limitations, including self-profile role updates.

For connected Google login, enable/configure the Google provider for the selected Supabase project. Register that project's Auth callback with Google, and allow the app's actual dashboard redirect URL in Supabase. The code constructs it as the current origin plus the current directory and `dashboard.html`, for example `http://localhost:8000/dashboard.html` or `https://<host>/<deployment-path>/dashboard.html`. Email/password handlers additionally require the email provider and its configured confirmation behavior.

Current file uploads require the **private `period_files` bucket** and its ownership/read policies. Elevated readers access files throughout the selected project. The legacy photo helper expects `activity_photos` public URLs, but its bucket and policies are not provisioned by these migrations.

Notifications require `public.notifications` in the `supabase_realtime` publication and the `notify_principals` RPC. The checked-in RPC sends submission notifications to principal/admin/super_admin profiles; it does not include vice principals.

### Curriculum sources

[js/curriculum.js](js/curriculum.js) first uses cached or fetched topic JSON at:

```text
https://staticapis.pragament.com/lms/<board>/<class>/<subject-key>/topics.json
```

Board and class keys are lowercase; Mathematics maps to `math` and Social Studies to `social`. Defaults are CBSE, class 10, Mathematics. If no topic tags are available, the app falls back to Supabase `content_tags` and then `chapters`. Configuration dropdowns query `boards`, `classes`, and `subjects`, with local UI fallbacks.

[js/api.js](js/api.js) also defines REST helpers for `modules` and `questions`. Definitions for `chapters`, `modules`, `questions`, and `content_tags` are absent from the migrations. These content requests use the configured public key as their bearer token, so their grants/RLS must support that access. Current diary writes use `daily_entries`; legacy push/pull helpers use a different row contract and must not be assumed interchangeable with it.

## Project map

| Path | Responsibility |
| --- | --- |
| [index.html](index.html) | Google landing entry, school connection, auth overlays |
| [dashboard.html](dashboard.html) | Daily entry, past activities, principal/admin views, settings |
| [slow_learner.html](slow_learner.html) | Remedial progress page |
| [sw.js](sw.js) | Same-origin asset cache and service worker lifecycle |
| [css/styles.css](css/styles.css), [css/slow_learner.css](css/slow_learner.css) | Responsive layouts and theme styling |
| [js/boot.js](js/boot.js), [js/auth.js](js/auth.js) | School bootstrap, authentication, profile and session handling |
| [js/app.js](js/app.js), [js/ui.js](js/ui.js) | Dashboard initialization, interactions, entry rendering and saving |
| [js/data.js](js/data.js), [js/storage-manager.js](js/storage-manager.js) | Local records, settings, and cache helpers |
| [js/supabase.js](js/supabase.js) | Entry revisions, attachments metadata, audit writes, legacy sync, slow learner sync |
| [js/approval.js](js/approval.js), [js/principal.js](js/principal.js), [js/history.js](js/history.js) | Review workflow, metrics, analytics, revision/audit history |
| [js/file-upload.js](js/file-upload.js), [js/notifications.js](js/notifications.js) | Private uploads, signed URLs, inbox and Realtime |
| [js/api.js](js/api.js), [js/curriculum.js](js/curriculum.js), [js/autocomplete.js](js/autocomplete.js) | Content requests, topic loading, and tag suggestions |
| [js/csv.js](js/csv.js), [js/slow_learner.js](js/slow_learner.js) | Activity CSV tools, student directory loading, progress editor |
| [js/admin.js](js/admin.js), [js/timetable.js](js/timetable.js) | Timetable CSV import and teacher schedule lookup |
| [js/tour.js](js/tour.js), [js/toast.js](js/toast.js) | Intro.js onboarding and messages |

## Runtime dependencies and deployment

The HTML loads Supabase JS v2 and Intro.js 7.2.0 from jsDelivr. The npm manifest lists `@supabase/supabase-js` and `@supabase/ssr`, but the current pages use CDN scripts and do not implement SSR or a bundler.

Deploy the static files together, including `config`, `data`, `css`, and `js`. Dark mode and local settings are saved per browser. The service worker uses cache-first same-origin reads; deployments that change cached assets should update its cache version. No web app manifest is included, so service worker caching alone should not be treated as a complete installable PWA setup.
