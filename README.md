# 📚 Teacher's Daily Planner & LMS

A modern, responsive web application for schools to manage daily classroom activities, track curriculum progress, monitor slow learners, manage timetables, and facilitate a principal approval workflow with real-time sync via Supabase.

---

## 🧑‍🏫 User Guide

### For Teachers

1. **Sign In & School Connect**:
   - Open `index.html` in your browser.
   - Enter your **School Code** (e.g., `MYSCHOOL`) or click **Continue in Offline Local Mode** to use the app without an internet connection.
   - Sign in using your email and password, or click **Continue with Google**.
2. **Logging Daily Activities**:
   - Navigate to the **📝 Daily Entry** tab on `dashboard.html`.
   - Select the date (defaults to today). If your timetable is set up, your class and subject will automatically fill in for each period.
   - Enter your **Classwork** and **Homework**.
   - Type `#` in the text box to view auto-suggestions for chapters and topics mapped to your class and subject.
   - To attach files (lesson plans, worksheets, student photos), click **📎 Attach File** (supports PDFs, images, docs up to 10 MB).
   - Use **📋 Copy from previous** to duplicate yesterday's period entries in one click.
3. **Saving & Submitting**:
   - Click **💾 Save** to keep your entry as an editable draft.
   - When finished, click **📤 Submit for Approval** to send your daily diary to the Principal.
   - If the Principal requests revisions, a banner with their feedback note will appear on your entry. Make the required edits and re-submit.
4. **🌱 Slow Learner Progress Monitoring**:
   - Click the **🌱 Slow Learner Progress** button on the header or open `slow_learner.html`.
   - Add rows for students who need remedial support. As you type a student's name, autocomplete suggestions appear from your school's student directory.
   - Fill in the Learning Gap, Strategy/Method Used, Progress status, and Next Steps.
   - Click **💾 Save Changes** to sync to the cloud, or click **📥 Export CSV** to download a spreadsheet copy.

---

### For Principals & Vice Principals

1. **Dashboard Overview & KPIs**:
   - Switch to the **📊 Principal Dashboard** tab.
   - Review live metric cards: **Total Teachers**, **Pending Diaries**, **Signed Today**, **Missing Entries**, and **Late Submissions**.
2. **Reviewing Diaries**:
   - Under the **Pending Review** sub-tab, filter submissions by Teacher Name, Class, Subject, or Date.
   - Click on any teacher's submission card to open the **Diary Review Modal**.
3. **Approving or Requesting Revisions**:
   - Inspect period activities and review any attached documents or photos.
   - **Approve**: Click **✅ Sign & Approve** to digitally stamp and lock the diary.
   - **Request Revision**: Click **🔄 Request Revision**, type specific instructions in the feedback box, and return it to the teacher.
   - **Reject**: Click **❌ Reject** to decline the submission.
4. **Analytics & Audit History**:
   - Click **Analytics** on any teacher to open their **30-Day Summary** (completion rates, revision counts, average submission time, and activity bar charts).
   - Click **🕐 Audit Trail** to view the Google Docs-style revision timeline showing exact submission and edit history.

---

### For School Administrators

1. **Timetable Setup**:
   - Open the **🛠️ Admin Panel** tab.
   - Prepare a CSV file containing your teachers' weekly schedule formatted as:
     ```csv
     Teacher Email,Day (1-7),Period (1-8),Class-Section,Subject
     teacher1@school.com,1,1,10A,Mathematics
     teacher1@school.com,1,2,10B,Mathematics
     ```
     *(Note: Day 1 = Monday ... Day 7 = Sunday)*
   - Click **Upload** to automatically map schedules to all teachers.
2. **Role Assignments**:
   - Manage user roles (`teacher`, `principal`, `admin`) directly in the Supabase `users` table.

---

## 🛠️ Complete Supabase Setup Guide (Step-by-Step)

Follow these steps to configure your Supabase backend from scratch:

### Step 1: Create a Supabase Project
1. Create a free account at [Supabase](https://supabase.com) and click **New Project**.
2. Set a **Project Name**, secure **Database Password**, and select your nearest **Region**.
3. Once provisioned, go to **Project Settings** (gear icon) -> **API**.
4. Note down your:
   - **Project URL** (e.g., `https://abcdefghijklm.supabase.co`)
   - **anon public Key** (e.g., `eyJhbGciOi...`)

---

### Step 2: Run Database Migrations in SQL Editor
1. In your Supabase Dashboard, click on **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open [`all_migrations.sql`](file:///c:/Users/prana/Projects/pragamant/html_teacher_diary/all_migrations.sql) from this repository, copy its entire contents, paste it into the SQL Editor, and click **Run**.
   - This sets up the core tables: `users`, `daily_entries`, `timetable`, `attachments`, `principal_signatures`, `audit_logs`, `notifications`, `boards`, `classes`, and `subjects`.
   - It also establishes Row Level Security (RLS) policies, database triggers, RPC functions, and storage bucket policies.
4. Click **New query** again.
5. Open [`slow_learner_migration.sql`](file:///c:/Users/prana/Projects/pragamant/html_teacher_diary/slow_learner_migration.sql), copy its contents, paste it into the editor, and click **Run**.
   - This sets up the `slow_learner_entries` table with RLS policies and timestamp triggers.

---

### Step 3: Configure Authentication & Redirect URLs
1. Navigate to **Authentication -> Providers** in the Supabase dashboard.
2. **Email Provider**:
   - Ensure **Email** is enabled.
   - *(Recommended for local dev)*: Under Email settings, toggle off **Confirm email** so users can sign in immediately after registering.
3. **Google OAuth Provider** *(Optional)*:
   - If you want Google sign-in, enable **Google** under Providers.
   - In the [Google Cloud Console](https://console.cloud.google.com/), create an OAuth 2.0 Client ID for Web Applications.
   - Add Supabase's Callback URL to your Google Authorized redirect URIs:
     `https://<your-project-id>.supabase.co/auth/v1/callback`
   - Paste the Google **Client ID** and **Client Secret** into your Supabase Google Provider configuration and save.
4. **Set Redirect URLs**:
   - In Supabase, go to **Authentication -> URL Configuration**.
   - Add your application URLs to **Redirect URLs**:
     - `http://localhost:8000/dashboard.html` (for local development)
     - `https://<your-domain>/dashboard.html` (for production)

---

### Step 4: Verify Storage Buckets
1. Navigate to **Storage** in the Supabase sidebar.
2. Verify that the bucket **`period_files`** exists.
   - It should be marked as **Private** (public = false).
   - Its RLS policies (created during `all_migrations.sql`) restrict file access so teachers only access their own uploads and principals access their school's files.
3. *(Optional)* Create a public bucket named **`activity_photos`** if you plan to upload direct photos.

---

### Step 5: Assign User Roles (Principal / Admin)
When a user signs up through the app, they receive the default role `teacher`. To elevate a user to **Principal** or **Admin**:
1. Go to **Table Editor -> users** table in Supabase.
2. Find the user's row by their email address.
3. Change their `role` column value from `teacher` to:
   - `principal` (grants review, approval, and analytics access)
   - `admin` (grants timetable uploads and administrative permissions)
4. Save the row. The user will see their upgraded dashboard upon their next sign-in.

---

### Step 6: Connect the Frontend to Your Supabase Instance

#### Method A: Multi-School Config (`config/schools.v1.json`) — Recommended
Edit [`config/schools.v1.json`](file:///c:/Users/prana/Projects/pragamant/html_teacher_diary/config/schools.v1.json) and add your school entry:
```json
{
  "MYSCHOOL": {
    "schoolName": "Delhi Public School",
    "status": "active",
    "supabaseUrl": "https://<your-project-id>.supabase.co",
    "anonKey": "<your-anon-public-key>"
  }
}
```
When users open `index.html`, typing `MYSCHOOL` connects the app directly to your Supabase backend.

#### Method B: Local Environment Fallback (`js/env.js`)
For quick single-school local testing without entering a school code, edit [`js/env.js`](file:///c:/Users/prana/Projects/pragamant/html_teacher_diary/js/env.js):
```javascript
window.ENV = {
  SUPABASE_URL: 'https://<your-project-id>.supabase.co',
  SUPABASE_KEY: '<your-anon-public-key>'
};
```

---

## ✨ Features

- **Multi-Role Authentication & Access Control** – Role-based interfaces for Teachers, Principals, and Admins via Supabase Auth.
- **Bulk Daily Activity Entry** – Full-day period logging with subject selection, auto-save drafts, and Copy-From-Previous.
- **🌱 Slow Learner Progress Monitoring (`slow_learner.html`)** – Student-level remedial logs with gaps, strategies, progress ratings, and CSV sync.
- **🎯 Dynamic Curriculum & #Tag Autocomplete** – Dynamic syllabus topics and instant `#tag` chapter suggestions.
- **📎 File Attachments & Media Lightbox** – Secure file uploads to private Supabase storage with signed URLs.
- **📤 Approval & Revision Workflow** – Full submission state machine with digital stamps, reject options, and revision feedback.
- **📊 Principal Dashboard & Analytics** – Real-time KPI cards, late submission tracking, and 30-day teacher performance graphs.
- **🕐 Revision History & Audit Trail** – Google Docs-style revision timeline with timestamps, version diffs, and audit logs.
- **🗓️ Timetable Management & Admin Panel** – Bulk timetable upload via CSV mapping teachers to periods.
- **🔔 In-App & Real-Time Notifications** – Real-time push updates for submission and approval events via Supabase channels.
- **💾 CSV Data Management** – Export and import classroom records in CSV format.
- **❓ Interactive Tour Guide** – Guided onboarding walkthrough powered by Intro.js.
- **🌙 Dark Mode & PWA Ready** – Light/dark theme switch and Service Worker offline asset caching.

---

## 📁 Project Structure

```text
html_teacher_diary/
├── index.html                  # Landing page & authentication portal
├── dashboard.html              # Main application dashboard (Teachers, Principals, Admins)
├── slow_learner.html           # Slow Learner progress tracking interface
├── sw.js                       # Service worker for PWA caching & offline support
├── all_migrations.sql          # Primary database schema, RLS policies, RPCs, & storage buckets
├── slow_learner_migration.sql  # Database schema & RLS policies for slow learner entries
├── config/
│   └── schools.v1.json         # Multi-tenant school mappings (School Code -> Supabase URL/Key)
├── css/
│   ├── styles.css              # Main application styling (design system, dark mode, responsive layout)
│   └── slow_learner.css        # Dedicated styles for slow learner tracking table
├── data/
│   └── test_students.csv       # Sample student directory for autocomplete testing
└── js/
    ├── admin.js                # Admin panel logic (timetable CSV upload)
    ├── api.js                  # Supabase REST client, dynamic curriculum & nameserver config API
    ├── app.js                  # Main controller, tab switching, and event listeners
    ├── approval.js             # Submission state machine & teacher approval banners
    ├── auth.js                 # Authentication handlers (Email/Pass, Google OAuth, session state)
    ├── autocomplete.js         # #Tag and curriculum hashtag autocomplete logic
    ├── boot.js                 # Application bootstrapper & multi-school routing
    ├── csv.js                  # CSV import/export utilities and test student loader
    ├── curriculum.js           # Curriculum selection and dynamic topic fetcher
    ├── data.js                 # LocalStorage persistence layer and activity state helpers
    ├── env.js                  # Local dev credentials fallback
    ├── file-upload.js          # File attachment validation, Supabase upload & signed URLs
    ├── history.js              # Revision history timeline and audit log viewer
    ├── notifications.js        # In-app notifications & Supabase Realtime listeners
    ├── principal.js            # Principal dashboard, KPI calculations, review modal, analytics
    ├── slow_learner.js         # Slow learner table controller, autosave, and sync logic
    ├── storage-manager.js      # LocalStorage caching engine with TTL and quota management
    ├── supabase.js             # Supabase client singleton, data sync, and audit helpers
    ├── timetable.js            # Fetch and map teacher's daily schedule
    ├── toast.js                # Toast notification system
    ├── tour.js                 # Guided onboarding tour (Intro.js)
    └── ui.js                   # DOM rendering for daily entries, cards, and past activities
```

---

## 🏗️ Architecture & Key Modules

| Module | Purpose |
|---|---|
| [`boot.js`](file:///c:/Users/prana/Projects/pragamant/html_teacher_diary/js/boot.js) | Verifies school code against `schools.v1.json`, initializes the Supabase client, and coordinates authentication redirects. |
| [`auth.js`](file:///c:/Users/prana/Projects/pragamant/html_teacher_diary/js/auth.js) | Manages login, registration, Google OAuth sign-in, user roles, profile state, and logout. |
| [`supabase.js`](file:///c:/Users/prana/Projects/pragamant/html_teacher_diary/js/supabase.js) | Core Supabase interface for daily entries, audit logging, push/pull operations, and slow learner sync. |
| [`principal.js`](file:///c:/Users/prana/Projects/pragamant/html_teacher_diary/js/principal.js) | Drives KPI statistics, diary approvals, revision notes, and 30-day teacher performance charts. |
| [`slow_learner.js`](file:///c:/Users/prana/Projects/pragamant/html_teacher_diary/js/slow_learner.js) | Full CRUD, table manipulation, and sync engine for remedial student monitoring. |
| [`file-upload.js`](file:///c:/Users/prana/Projects/pragamant/html_teacher_diary/js/file-upload.js) | Handles client-side validation and Supabase Storage uploads to the `period_files` bucket. |
| [`curriculum.js`](file:///c:/Users/prana/Projects/pragamant/html_teacher_diary/js/curriculum.js) & [`autocomplete.js`](file:///c:/Users/prana/Projects/pragamant/html_teacher_diary/js/autocomplete.js) | Connects to external curriculum APIs and delivers real-time topic tag suggestions. |
| [`history.js`](file:///c:/Users/prana/Projects/pragamant/html_teacher_diary/js/history.js) | Reconstructs versioned revisions and audit trail logs into an interactive timeline modal. |

---

## 🚀 Getting Started & Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/pranav-pachn/html_teacher_diary.git
   cd html_teacher_diary
   ```

2. **Serve locally**:
   Serve using any static web server (required for ES modules, Service Worker, and Supabase Auth):
   ```bash
   # Using Python
   python -m http.server 8000

   # Or using Node npx
   npx serve .
   ```

3. **Open the application**:
   - Landing & Login: `http://localhost:8000/index.html`
   - Teacher & Principal Dashboard: `http://localhost:8000/dashboard.html`
   - Slow Learner Monitoring: `http://localhost:8000/slow_learner.html`

---

## 👥 Role Permissions Matrix

| Feature | Teacher | Principal / Vice Principal | Admin |
|---|:---:|:---:|:---:|
| Fill & Save Daily Activities | ✅ | ✅ | ✅ |
| Submit Diary for Approval | ✅ | — | — |
| Review, Sign & Approve Diaries | — | ✅ | ✅ |
| Request Revisions with Notes | — | ✅ | ✅ |
| View Teacher Performance Analytics | — | ✅ | ✅ |
| Manage Slow Learner Progress | ✅ (Own) | ✅ (All) | ✅ (All) |
| Upload School Timetable CSV | — | — | ✅ |
| Access Full School Audit Logs | — | ✅ | ✅ |
| Export / Import Activities CSV | ✅ | ✅ | ✅ |

---

## 📦 Dependencies & Tech Stack

- **Core**: Vanilla HTML5, CSS3, JavaScript (ES6+ Modules)
- **Database & Auth**: [@supabase/supabase-js v2](https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2)
- **Guided Tour**: [Intro.js v7.2](https://introjs.com/)
- **Typography**: [Google Fonts (Inter)](https://fonts.google.com/specimen/Inter)
- **Offline / PWA**: Native Service Worker API
