# ⚔️ Old Repo vs New Repo - Master Feature Comparison

This document provides a detailed, comprehensive side-by-side comparison between the original project codebase (**`PratapSakthivel/VSBEC-TASK-MANAGER`**) and the upgraded, production-grade IT Task Manager & Live Coding Progress System (**`Tharun4743/IT_taskmanager`**).

---

## 📊 Complete Feature Comparison Table

| Category | Old Codebase (`PratapSakthivel`) | New Production Codebase (`Tharun4743`) |
| :--- | :--- | :--- |
| **💻 Live LeetCode Progress Tracking** | ❌ **Not Available** (No LeetCode integration) | ✅ **Full LeetCode Tracker**: Daily & Weekly progress views, total solved problems, daily status (`COMPLETED` / `NOT COMPLETED`), remaining target counters, and active target resolution. |
| **🐙 Live GitHub Activity Tracking** | ❌ **Not Available** (No GitHub integration) | ✅ **Full GitHub Tracker**: Daily commit tracking, new repository creations, daily commit status, weekly commit aggregates, and Monday–Sunday day breakdown. |
| **⚡ Combined Coding Progress View** | ❌ **Not Available** | ✅ **Combined Coding Monitor**: Single unified progress table displaying LeetCode problem solving and GitHub commit statistics side-by-side for all students. |
| **🎯 4-Level Target Management Engine** | ❌ **Not Available** | ✅ **4-Level Target Engine**: Set daily/weekly targets at **Student**, **Class**, **Year**, or **Department** level with automatic inheritance priority resolution. |
| **🚀 RAM Student Directory & Git Sync** | ❌ **Not Available** (Executed raw DB joins per request) | ✅ **RAM Cache with Dual-Mode Git/API Sync** ([`studentDirectoryService.ts`](file:///c:/Users/tharu/Downloads/IT_taskmanager-main/studentDirectoryService.ts)): Pre-indexes 400+ student profiles in RAM (lookup **< 0.01ms**), debounces writes, and auto-commits changes to GitHub using Contents REST API (for Render containers) & Git CLI dynamically. |
| **⚡ Tab-Scoped Parallel Request Batching** | ❌ **Not Available** (Sequential HTTP roundtrips) | ✅ **Parallel Batching**: Grouped `Promise.all` requests scoped to active platform tab (`LEETCODE` vs `GITHUB`), reducing API network roundtrips by **60–75%**. |
| **📊 Advanced Excel Export Suite** | ⚠️ **Basic CSV Export** | ✅ **9 Specialized Excel Exporters**: Export Daily, Weekly, Mon–Sun Detailed, and Defaulters/Incomplete reports for LeetCode, GitHub, and Combined coding progress. |
| **🔄 Cloud Keep-Alive & Cron Webhooks** | ❌ **Not Available** | ✅ **Render Automation**: Lightweight `GET /api/health` (< 2ms ping for keep-alive monitoring) + Protected `POST /api/cron/sync-coding-progress` webhook for automated daily syncs. |
| **📢 Digital Notice Board** | ❌ **Not Available** | ✅ **Full Notice Board**: Multi-class/department scoping, priority tags (`Urgent`, `High`, `Normal`, `Low`), pinning, file attachments, and direct link sharing. |
| **👥 Team Tasks & Group Formation** | ❌ **Not Available** (All tasks were individual) | ✅ **Team Tasks System**: Min/Max team size controls, interactive invitation banners, leader/member roles, pre-submission team editing, and disband/leave endpoints. |
| **🛑 Student Opt-Out / Not Participating** | ❌ **Not Available** | ✅ **"Not Participating" Module**: Radio choice cards ("Yes I'll Submit" vs "Skip / Not Interested"), mandatory reason collection, reason editing, and stat cards. |
| **💬 Peer Discussions & Mentions** | ❌ **Not Available** | ✅ **Task Q&A Thread**: Threaded discussion box under each task, `@mentions` to tag faculty/peers, and real-time notification alerts. |
| **🔄 Task Rejection & Resubmission** | ❌ **Basic** (Only simple verify/delete) | ✅ **Rejection Pipeline**: Staff reject submissions with detailed feedback notes; students receive Red Alert banners and 1-click **Re-upload Proof**. |
| **⏰ Task Expiry & Reopening** | ❌ **Fixed Expiry** (Expired tasks locked permanently) | ✅ **HOD Task Control**: HODs can reopen expired tasks, extend deadline dates, and automatically send notification alerts to assigned students. |
| **🔐 Student Auth & Login** | ⚠️ **Basic Login** | ✅ **Strict Login Policy**: Official College Email ID login support, Register Number default password enforcement, whitespace trimming, and case-insensitive matching. |
| **☁️ Automated Database Snapshot Backup** | ❌ **Not Available** | ✅ **Auto Database Snapshot Backup** ([`dbBackupService.ts`](file:///c:/Users/tharu/Downloads/IT_taskmanager-main/dbBackupService.ts)): Generates JSON snapshots of all core Postgres tables upon startup and every 24 hours, keeping the 7 most recent backups to control disk footprint. |
| **🖼️ Media Storage & Cleanup** | ⚠️ **Manual Storage** | ✅ **Auto-Cleanup Worker** ([`imageCleanupService.ts`](file:///c:/Users/tharu/Downloads/IT_taskmanager-main/imageCleanupService.ts)): Purges Cloudinary screenshot uploads older than 7 days to keep media storage light. |
| **⚡ High-Concurrency & Cache Accelerator** | ❌ **Not Available** (Raw database lookups, slow queries, and socket hangups under load) | ✅ **Tuned High-Speed Cache Engine**: In-memory Auth cache (45s TTL), task/notice list caching (5–15s TTL), database connection pool timeout tuning, socket keep-alive limits (65s), and 11 compound indexes (e.g., tasks, submissions, profiles) to handle high parallel loads. |
| **🚨 Error Monitoring** | ❌ **Not Available** | ✅ **Sentry Integration** ([`sentryService.ts`](file:///c:/Users/tharu/Downloads/IT_taskmanager-main/sentryService.ts)): Captures unhandled backend errors and reports them to Sentry dashboard. |
| **🤖 Telegram Bot & Notification Engine** | ❌ **Not Available** (No Telegram integration) | ✅ **Full Telegram Bot Engine** ([`telegramService.ts`](file:///c:/Users/tharu/Downloads/IT_taskmanager-main/telegramService.ts)): Dedicated Telegram Bot with interactive quick-action menus, account linking by Register Number, scorecards, real-time task lifecycle alerts, daily private reminders (8:00 PM IST), and group summary reports (9:00 PM IST). |
| **👤 Student Profile & Resume Builder Suite** | ❌ **Not Available** | ✅ **Professional Portfolio Builder**: Full-featured student profile editor and resume builder with 10 database tables, letting students compile biographies, academic metrics (CGPA/arrears), skills, projects, internships, certifications, coding platform handles (LeetCode, GitHub, HackerRank, GFG, CodeChef, Codeforces), and career preferences. |
| **📂 Database Tables** | ⚠️ **Basic Tables Only** | ✅ **23 New Database Tables**: `leetcode_targets`, `leetcode_daily_progress`, `github_targets`, `github_daily_progress`, `notices`, `task_discussions`, `teams`, `team_members`, `team_invitations`, `team_submissions`, `system_settings`, `scheduled_notifications`, `user_notification_settings`, `student_profiles`, `student_skills`, `student_projects`, `student_internships`, `student_certifications`, `student_coding_profiles`, `student_resumes`, `student_achievements`, `student_languages`, `student_career_preferences`. |

---

## 🔬 Detailed Section-by-Section Breakdown

### 1. Live Coding Progress & Target Management (NEW)
- **Features**: Dual platform tracking (LeetCode GraphQL API & GitHub REST/GraphQL API), 4-level target inheritance priority, combined progress matrix, Monday–Sunday weekly breakdown, and live target configuration manager.
- **Endpoints**: `GET/POST/DELETE /api/leetcode/targets`, `GET/POST/DELETE /api/github/targets`, `GET /api/leetcode/progress/daily`, `GET /api/github/progress/daily`, `GET /api/coding/progress/combined`.

### 2. High-Speed RAM Student Directory & Git Auto-Sync (NEW)
- **Features**: Pre-indexes student handles, register numbers, classes, and emails in Node.js RAM ([`studentDirectoryService.ts`](file:///c:/Users/tharu/Downloads/IT_taskmanager-main/studentDirectoryService.ts)). Drops student lookup latency from **~30ms** to **< 0.01ms**. Debounces and queues updates to auto-commit and push student coding profile changes to GitHub using either the GitHub Contents REST API (for Render cloud environments without local credentials) or local Git CLI dynamically.

### 3. Advanced Excel Export Suite (NEW)
- **Features**: Exports Daily, Weekly, Mon-Sun Detailed, and Defaulters reports for LeetCode, GitHub, and Combined coding progress with auto-formatted column widths.

### 4. Cloud Keep-Alive & Cron Automation (NEW)
- **Features**: `GET /api/health` endpoint (< 2ms response) for keep-alive monitoring + `POST /api/cron/sync-coding-progress` webhook protected by `CRON_SECRET` header for external cron sync.

### 5. Digital Notice Board (NEW)
- **Features**: Multi-class target picker, department-level notices, global announcements, priority tags (`Urgent`, `High`, `Normal`, `Low`), pinning, file attachments, and direct link sharing.

### 6. Team Task System (NEW)
- **Features**: Individual vs Team task mode, configurable team sizes (2–5 members), interactive invitation dashboard banner, leader/member role badges, and pre-approval editing.

### 7. Student Opt-Out & Not Participating Tracking (NEW)
- **Features**: Choice cards ("Yes I'll Submit" vs "Skip / Not Interested"), mandatory reason collection, reason editing option, and HOD dashboard analytics cards for opted-out students.

### 8. Submission Rejection & Proof Re-Upload (NEW)
- **Features**: Staff can reject submissions with detailed rejection feedback notes. Students see red alerts on task cards with exact comments and can re-upload proof with 1-click.

### 9. Interactive Telegram Bot Integration (NEW)
- **Features**: Dedicated Telegram Bot (`@IT_TaskManager_Alerts_bot`) with long-polling daemon, native commands menu, student account linking by Register Number, inline buttons, scorecards, real-time task lifecycle alerts (assigned, submitted, verified, rejected), 8:00 PM IST daily private reminders, and 9:00 PM IST departmental group summaries.
- **Files**: [`telegramService.ts`](file:///c:/Users/tharu/Downloads/IT_taskmanager-main/telegramService.ts)
- **Endpoints**: `GET /api/telegram/status`, `POST /api/telegram/set-group-chat`, `POST /api/telegram/send-group-summary`, `POST /api/telegram/send-reminders`, `POST /api/telegram/test`, `DELETE /api/student/unlink-telegram`

### 10. Student Profile & Resume Builder Suite (NEW)
- **Features**: Comprehensive dashboard allowing students to construct profile resumes: personal information, skills portfolios, academic projects, internships, industry certifications, extra coding platform links, custom resume document uploads, language profiles, achievements, and career placement preferences.
- **Files**: [`db.ts`](file:///c:/Users/tharu/Downloads/IT_taskmanager-main/db.ts) (Schema setup), `server.ts` (API endpoints), and `src/App.tsx` (Dashboard UI views).
- **Endpoints**: `GET /api/student/profile`, `GET /api/student/profile/:studentId` (for staff review), `POST /api/student/profile/avatar`, `PUT /api/student/profile/personal`, `POST/DELETE /api/student/profile/skills`, `POST/DELETE /api/student/profile/projects`, `POST/DELETE /api/student/profile/internships`, `POST/DELETE /api/student/profile/certifications`, `PUT /api/student/profile/coding-profiles`, `POST /api/student/profile/resume`, `POST/DELETE /api/student/profile/achievements`, `POST/DELETE /api/student/profile/languages`, `PUT /api/student/profile/career-preferences`

### 11. High-Concurrency Server Cache & Connection Engine (NEW)
- **Features**: Caches authenticated user objects in memory (45s TTL) to bypass redundant database SQL queries per request. Scoped in-memory caching for read-heavy `/api/tasks` (5s TTL) and `/api/notices` (15s TTL) with smart invalidation upon database mutations. Implements 11 compound database indexes, configured connection pooling timeouts, and Node.js keep-alive tuning (65s) to avoid socket hangups behind cloud proxies.
- **Files**: [`db.ts`](file:///c:/Users/tharu/Downloads/IT_taskmanager-main/db.ts) (Database connection pool & indices), [`server.ts`](file:///c:/Users/tharu/Downloads/IT_taskmanager-main/server.ts) (In-memory caching and server listener timeouts).
