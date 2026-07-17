# 📚 Teacher's Daily Planner

A single‑page web application for teachers to quickly record daily classroom activities (classwork, homework, class & section per period), search past entries, and optionally sync with Supabase. All data is stored locally in your browser; no server or installation required.

---

## ✨ Features

- **Bulk daily entry** – Fill in an entire day’s periods at once, with columns for period number, class/section, classwork, and homework.
- **Copy from previous day** – Quickly duplicate yesterday’s entries to save time.
- **View & search past activities** – Search by class, classwork, or homework text, filter by date range, and sort by newest/oldest.
- **Adjustable periods** – Set the number of periods per day (1‑20) in Settings.
- **CSV export/import** – Backup your data or migrate from other tools.
- **Supabase sync** – Connect to a Supabase project to push local data to the cloud or pull remote data (useful for multi‑device workflows).
- **Persistent local storage** – All data is saved automatically in your browser’s `localStorage`.

---

## 🧑‍🏫 For Users (Teachers)

### Getting started

1. Open the `index.html` file in any modern browser (Chrome, Edge, Firefox, Safari).
2. The app will show today’s date. Fill in the fields for each period:
   - **Class & Section** – e.g., `10‑A`, `8‑B`
   - **Classwork** – what was taught or done in class
   - **Homework** – any assignments given
3. Click **Save** (or press `Ctrl+S` / `Cmd+S`) to store the day’s entry.
4. Switch to the **View Activities** tab to see all saved days. Use the search box and filters to find specific entries.
5. In the **Settings** tab you can:
   - Change the number of periods.
   - Configure Supabase (see below).
   - Export/import CSV data.
   - Clear all local data.

### Supabase sync (optional)

1. In the **Settings** tab, enter your Supabase project URL and an **anon/public** API key.
2. Specify the table name (default: `daily_activities`).
3. Click **Test Connection** to verify.
4. Use **Push to Supabase** to upload all your local data to the remote table.
5. Use **Pull from Supabase** to replace your local data with what’s in the cloud.

> **Important:** The table must have the following columns (exact names and types):
> - `date` (text or date)
> - `period_number` (integer)
> - `class_section` (text)
> - `classwork` (text)
> - `homework` (text)
>
> The app uses `date` and `period_number` as the composite key for upserts.

### CSV format

- **Export** creates a CSV with columns: `date,period_number,class_section,classwork,homework`.
- **Import** expects the same header order (case‑insensitive). It will merge with existing data by date (replacing whole days).

---

## 👨‍💻 For Developers

### Architecture

The app is a single HTML file with embedded CSS and JavaScript. No build tools, dependencies (except the Supabase JS SDK, loaded from CDN), or server required.

**Key data structures** (stored in `localStorage`):

```json
{
  "activities": [
    {
      "id": "day_1234567890_abc",
      "date": "2026-06-24",
      "periods": [
        {
          "periodNumber": 1,
          "classSection": "10-A",
          "classwork": "Chapter 5 introduction",
          "homework": "Read pages 50-60"
        }
        // ...
      ]
    }
  ],
  "settings": {
    "periodsPerDay": 8,
    "supabaseUrl": "https://your-project.supabase.co",
    "supabaseKey": "eyJ...",
    "supabaseTable": "daily_activities"
  }
}
```

### Local development

Just open the HTML file directly in your browser – no HTTP server required. However, if you want to test Supabase features, you must serve the file over `http://` or `https://` (the Supabase JS SDK requires a secure context for certain operations). Use a local server like `live-server`, `python -m http.server`, or VS Code’s Live Server extension.

### Customisation

- **Periods per day** – The user can change this in Settings. The default is `8`.
- **Styling** – All CSS is inside the `<style>` block at the top. You can modify colors, fonts, or layout.
- **Supabase** – The code uses the `@supabase/supabase-js` v2 SDK. If you want to use a different backend, replace the `pushToSupabase` and `pullFromSupabase` functions with your own API calls.

### Key JavaScript functions

| Function | Purpose |
|----------|---------|
| `loadData()` / `saveData()` | Read/write the entire state from/to `localStorage`. |
| `getActivities()` / `saveActivities()` | Convenience wrappers for the `activities` array. |
| `getSettings()` / `saveSettings()` | Read/write the `settings` object. |
| `renderDailyTab()` | Populate the daily entry table for the current date. |
| `saveDaily()` | Collect form data and store it for the current date. |
| `renderViewTab()` | Display filtered/sorted past entries. |
| `exportCSV()` / `importCSV()` | Handle CSV import/export. |
| `testSupabaseConnection()` / `pushToSupabase()` / `pullFromSupabase()` | Supabase integration. |

### Adding new features

- **New tabs** – Add a new `<section class="tab-content" id="tab-...">` and a corresponding button in `.tab-nav`. Then implement the render logic.
- **Additional fields** – Extend the `periods` array items and update the table template and CSV mapping.
- **Custom sync** – Replace the Supabase methods with your own HTTP requests (e.g., to a REST API).

---

## 📦 Dependencies

- [Supabase JS SDK v2](https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2) – loaded from CDN.
- No other external libraries.

---

## 🤝 Contributing

Found a bug or have a suggestion? Feel free to open an issue or submit a pull request. For major changes, please discuss first.

---

## 📧 Support

For questions about using the app, or for help with Supabase setup, please reach out via the project’s issue tracker.
