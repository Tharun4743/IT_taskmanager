# ⚔️ Old Repo vs New Repo - Master Feature Comparison

This document provides a detailed side-by-side comparison between the original project codebase (**`PratapSakthivel/VSBEC-TASK-MANAGER`**) and the updated codebase (**`Tharun4743/IT_taskmanager`**).

---

## 📊 Summary Comparison Table

| Category | Old Feature / Functionality (`PratapSakthivel`) | New Feature / Functionality (`Tharun4743`) |
| :--- | :--- | :--- |
| **📢 Digital Notice Board** | ❌ **Not Available** (No announcement feature) | ✅ **Full Notice Board**: Scopes (`GLOBAL`, `DEPARTMENT`, `CLASS`), Priorities (`Urgent`, `High`, `Normal`, `Low`), Pinning, File attachments, Multi-class selection, and One-click Link Sharing. |
| **👥 Team Tasks & Group Formation** | ❌ **Not Available** (All tasks were strictly individual) | ✅ **Team Tasks System**: Min/Max team size controls, Interactive top invitation banners, Leader/Member roles, Pre-submission team editing, and Disband/Leave API endpoints. |
| **🛑 Student Opt-Out / Not Participating** | ❌ **Not Available** (Students could only submit proof or ignore) | ✅ **"Not Participating" Module**: Radio choice cards (`"Yes I'll Submit"` vs `"Skip / Not Interested"`), mandatory reason collection, "Edit Reason" option, and stat cards. |
| **💬 Peer Discussions & Mentions** | ❌ **Not Available** (No communication section) | ✅ **Task Q&A Thread**: Threaded discussion box under each task, `@mentions` to tag faculty/peers, and real-time notification alerts. |
| **📬 Feedback & Complaints System** | ❌ **Not Available** | ✅ **Feedback Portal**: Category selection (`Suggestion`, `Bug`, `Complaint`), Anonymous mode, Priority tagging, and Staff status resolution (`Open`, `In Progress`, `Resolved`, `Rejected`). |
| **🔄 Task Rejection & Resubmission** | ❌ **Basic** (Only simple verify or delete) | ✅ **Rejection System**: Staff can reject submissions with detailed feedback notes. Students get Red Alert banners and a 1-click **Re-upload Proof** button. |
| **⏰ Task Expiry & Reopening** | ❌ **Fixed Expiry** (Expired tasks locked permanently) | ✅ **HOD Task Control**: HODs can reopen expired tasks, extend deadline dates, and automatically send notification alerts to assigned students. |
| **🔐 Student Auth & Login** | ⚠️ **Basic Login** | ✅ **Strict Login Policy**: Official College Email ID login support, Register Number default password enforcement, whitespace trimming, and case-insensitive matching. |
| **📊 Excel Reports & Exporting** | ⚠️ **Basic Single CSV/Excel Export** | ✅ **3-Sheet Professional Exporter**: Generates 3-sheet Excel workbooks (*Task Overview*, *Submitted/Interested*, *Opt-Out Reasons*) + Multi-Class Export Filters. |
| **☁️ Automated GitHub Backup** | ❌ **Not Available** | ✅ **Auto Cloud Backup Service** (`autoExcelGitHubReportService.ts`): Periodically compiles database snapshots into Excel reports and pushes them to GitHub. |
| **🖼️ Media Storage & Cleanup** | ⚠️ **Manual Storage** (Screenshots accumulated forever) | ✅ **Auto-Cleanup Worker** (`imageCleanupService.ts`): Automatically purges Cloudinary screenshot uploads older than 7 days to keep media storage light. |
| **⚡ Database Performance** | ⚠️ **Basic Pool** (Un-indexed queries, N+1 query issue) | ✅ **Optimized**: Pre-warmed PostgreSQL pool, composite indexes on high-frequency tables (`notices`, `submissions`, `tasks`), and statement timeouts. |
| **🎨 UI Modals & Mobile Layout** | ⚠️ **Sizing Issues & Horizontal Scroll** | ✅ **Mobile Polish**: Fixed modal scaling (`max-h-[90vh] overflow-y-auto`), eliminated horizontal scrollbar (`overflow-x-hidden`), added PWA manifest, and styled status badges (`VERIFIED`, `PENDING VERIFICATION`, `INCOMPLETE`). |
| **🚨 Error Monitoring** | ❌ **Not Available** | ✅ **Sentry Integration** (`sentryService.ts`): Captures unhandled backend errors and reports them to Sentry. |
| **📂 Database Tables** | ⚠️ **Basic Tables Only** | ✅ **Added 8 New Tables**: `notices`, `discussions`, `feedback`, `feedback_messages`, `task_teams`, `team_members`, `notifications`, `task_classes`. |

---

## 🔬 Detailed Section-by-Section Breakdown

### 1. Digital Notice Board (NEW)
- **Features**: Multi-class target picker, department-level notices, global announcements, priorities (`Urgent`, `High`, `Normal`, `Low`), pinning, PDF/Image attachments, and direct link sharing (`?tab=notice-board&noticeId=...`).
- **Endpoints**: `GET/POST/PUT/DELETE /api/notices`, `PATCH /api/notices/:id/pin`, `POST /api/notices/upload`.

### 2. Team Task System (NEW)
- **Features**: Individual vs Team task mode, configurable team sizes (2–5 members), interactive invitation dashboard banner, leader/member role badges, and pre-approval editing.
- **Endpoints**: `POST /api/team/create`, `POST /api/team/respond`, `DELETE /api/team/:teamId`, `POST /api/team/leave`, `POST /api/team/submit`.

### 3. Student Opt-Out & Not Participating Tracking (NEW)
- **Features**: Choice cards ("Yes I'll Submit" vs "Skip / Not Interested"), mandatory reason collection, "Edit Reason" option, and HOD dashboard analytics cards for opted-out students.

### 4. Submission Rejection & Proof Re-Upload (NEW)
- **Features**: Staff can reject submissions with detailed rejection reasons. Students see red alerts on task cards with exact feedback and can re-upload proof with 1-click.

### 5. Peer Discussions & Tagging (NEW)
- **Features**: Threaded task discussions, `@mentions` tagging for faculty/students, and automated notification triggers.

### 6. Feedback & Case Management (NEW)
- **Features**: Submit general suggestions, complaints, or bug reports with optional anonymous mode. Staff can manage cases (`Open`, `In Progress`, `Resolved`, `Rejected`).

### 7. Background Services & Optimizations (NEW)
- `autoExcelGitHubReportService.ts`: Periodically backs up multi-sheet Excel reports directly to GitHub repository.
- `imageCleanupService.ts`: Automatically deletes Cloudinary screenshots older than 7 days.
- `studentDirectoryService.ts`: In-memory student directory lookup mapping batch years to class sections.
- `sentryService.ts`: Server-side unhandled exception tracking.
