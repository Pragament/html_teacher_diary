# 📚 Teacher's Daily Planner

A comprehensive web application for schools to manage daily classroom activities, tracking classwork, homework, and providing a streamlined approval workflow. The application supports role-based access, data synchronization, authentication via Supabase, and dynamic curriculum management.

---

## ✨ Features

- **Role-Based Access** – Secure login supporting different roles: Teachers, Principals, and Admins.
- **Bulk Daily Entry** – Teachers can fill in an entire day’s periods at once, with columns for period number, class/section, subject, classwork, and homework.
- **Copy from Previous Day** – Quickly duplicate yesterday’s entries to save time.
- **Approval Workflow** – Teachers submit their daily diaries. Principals can review, approve, or request revisions (with notes).
- **Principal Dashboard & Analytics** – Principals have access to KPI cards, teacher analytics, revision histories, and the ability to filter submissions.
- **Dynamic Curriculum** – Fetch curriculum topics, syllabus, and tags dynamically based on board, class, and subject.
- **Timetable Management** – Support for uploading and mapping class timetables.
- **Notifications** – Real-time notifications for status changes (e.g., when a diary is approved or a revision is requested).
- **View & Search** – Search past activities by class, classwork, or homework text, filter by date range, and sort by statuses (Draft, Submitted, Approved, Needs Revision).
- **CSV Export/Import** – Backup your data or migrate from other tools.
- **Supabase Integration** – Complete authentication, data synchronization, auditing, and cloud storage via Supabase backend.
- **Progressive Web App (PWA)** – Service worker support allows for caching and offline capabilities.

---

## 🧑‍🏫 For Users

### Getting Started

1. Open `index.html` (which redirects to login) or `dashboard.html` in any modern browser.
2. Sign in using your credentials.
3. The app will show the appropriate dashboard depending on your role (Teacher, Principal, or Admin).
4. **Teachers**: 
   - Fill in the fields for each period (Class, Subject, Classwork, Homework).
   - Click **Save** to keep a draft, or **Submit for Approval** to send it to the Principal.
5. **Principals**:
   - Use the **Principal Dashboard** to review pending diaries, check KPI metrics, and approve or request revisions.
6. **Settings**: Customize the number of periods per day, change curriculum sources, and manage CSV imports/exports.

---

## 👨‍💻 For Developers

### Architecture

The app has evolved into a modular structure using HTML, Vanilla CSS, and JavaScript. It utilizes the Supabase JS SDK for backend services (Auth, Database, Storage).

**Key Modules (`js/` directory)**:
- `app.js` – Main initialization and event listener wiring.
- `auth.js` – Handles Supabase authentication and session management.
- `api.js` – Interacts with the Supabase database.
- `ui.js` / `ui_restored.js` – UI rendering and DOM manipulation.
- `approval.js` / `principal.js` – Logic for the submission and review workflow.
- `notifications.js` – In-app notification system.
- `curriculum.js` – Dynamic fetching of curriculum data.
- `history.js` – Audit trails and revision history.

### Local Development

1. Clone the repository.
2. Serve the directory using a local web server (e.g., `live-server`, `python -m http.server`, or VS Code's Live Server extension).
3. The Supabase JS SDK requires a secure context for certain operations, so `http://localhost` or `https://` is recommended.
4. Copy `.env.example` to `.env` or set up your `env.js` with your Supabase credentials.

### Supabase Setup & Workflow

The application heavily relies on Supabase for data persistency and authentication. The app supports a multi-tenant architecture, allowing you to map different school codes to their respective Supabase instances.

#### 1. Create a Supabase Project
- Create an account and a new project at [Supabase](https://supabase.com).
- Go to **Project Settings -> API** to retrieve your **Project URL** and **anon public** key.

#### 2. Run Database Migrations
- Navigate to the **SQL Editor** in your Supabase dashboard.
- Open the `all_migrations.sql` file found in the root of this repository.
- Copy the entire file content, paste it into a new query in the SQL Editor, and click **Run**. This creates all required tables (e.g., `schools`, `users`, `daily_entries`), functions, and Row Level Security (RLS) policies.

#### 3. Configure Authentication
- In the Supabase dashboard, go to **Authentication -> Providers**.
- Ensure the **Email** provider is enabled.
- (Optional) Enable **Google** authentication. Follow Supabase's guide to get a Google Client ID and Secret, and add them to the Supabase dashboard. *(Note: Do not put these secrets in the frontend codebase).*

#### 4. Configure Your School in the App
The frontend connects to the correct Supabase instance based on a configuration file.
1. Open the file `config/schools.v1.json`.
2. Add or update an entry with a unique **School Code** (e.g., `"MYSCHOOL"`).
3. Fill in the details using the credentials obtained in Step 1:
   ```json
   {
       "MYSCHOOL": {
           "schoolName": "My Awesome School",
           "status": "active",
           "supabaseUrl": "https://<your-project-id>.supabase.co",
           "anonKey": "<your-anon-key>"
       }
   }
   ```
4. When a user opens the app (`index.html`), they will be asked for a **School Code**. Entering `MYSCHOOL` will connect them to the configured Supabase backend.
---

## 📦 Dependencies

- [Supabase JS SDK v2](https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2) – Included via npm (`package.json`) and CDN.
- [Intro.js](https://introjs.com/) – For guided application tours.
- No other major external frontend frameworks; relies on modern Vanilla JS.

---

## 🤝 Contributing

Found a bug or have a suggestion? Feel free to open an issue or submit a pull request. For major changes, please discuss first.

---

## 📧 Support

For questions about using the app, or for help with Supabase setup, please reach out via the project’s issue tracker.
