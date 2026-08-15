# 📋 Architecture Evolution & Feature Enhancement Guide

This document provides a comprehensive technical overview highlighting the initial foundation (**`PratapSakthivel/VSBEC-TASK-MANAGER`**) and the extended production architecture (**`Tharun4743/IT_taskmanager`**).

---

## 📊 Technical Evolution & Enhancement Matrix

| # | Architecture Category | Base Implementation (`PratapSakthivel`) | Production Architecture (`Tharun4743`) | Enhancement Classification |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **LeetCode Progress Tracking** | Focused on core academic coursework and curriculum task submissions. | **Integrated LeetCode Engine**: Real-time problem counts, daily & weekly progress tracking, active target inheritance, and daily completion metrics. | `Integrated Analytics` |
| **2** | **GitHub Activity Tracking** | Standard manual repository link attachments on assignments. | **Automated GitHub Tracker**: Tracks and syncs daily total commit counts per student with weekly aggregates. | `Integrated Analytics` |
| **3** | **Combined Coding Monitor** | Standard individual student assignment status lists. | **Unified Coding Dashboard**: Single multi-metric monitor displaying LeetCode (solving details & target status) and GitHub (daily total commits) statistics side-by-side with class filtering. | `Integrated Analytics` |
| **4** | **Multi-Level Target Engine** | Uniform assignment due dates for all students. | **4-Level Target Resolver**: Set customized daily/weekly LeetCode targets at Student, Class, Year, or Department level with automatic priority inheritance. | `Target Management` |
| **5** | **Telegram Bot & Alerts** | In-app browser notifications and dashboard alerts. | **Dedicated Telegram Bot** ([`telegramService.ts`](file:///c:/Users/tharu/Downloads/IT_taskmanager-main/telegramService.ts)): Instant student status lookup by Register Number, class shortcuts (`/3ita`, `/2ita`, `/2it`, `/year3`) with section breakdown, 1-to-1 deadline reminders, and daily department briefs with deduplication locks. | `Automated Notifications` |
| **6** | **Excel Reporting Suite** | Standard CSV tabular export for general records. | **Direct ExcelJS Reporting Suite**: 9 specialized multi-sheet OpenXML (`.xlsx`) exports with dynamic boundary trimming (no blank rows/columns), custom headers, and auto-fitted columns. | `Reporting & Analytics` |
| **7** | **Directory & Git Auto-Sync** | Standard database relational queries per profile lookup. | **RAM Directory Cache & Dual-Mode Git Sync** ([`studentDirectoryService.ts`](file:///c:/Users/tharu/Downloads/IT_taskmanager-main/studentDirectoryService.ts)): Pre-indexed memory cache for sub-millisecond lookups and automated GitHub profile sync via Contents REST API / Git CLI. | `High-Performance Cache` |
| **8** | **Network Request Batching** | Sequential API fetching for active views. | **Tab-Scoped Parallel Batching**: Grouped `Promise.all` asynchronous requests scoped to active tabs, optimizing network throughput by 60–75%. | `Performance Tuning` |
| **9** | **Service Health & Automation** | Standard on-demand server execution. | **Automated Service Health**: Dedicated `/api/health` endpoint (< 2ms response) for uptime monitoring + secured cron triggers for automated daily progress syncs. | `System Automation` |
| **10** | **Digital Notice Board** | Task-specific assignment instructions. | **Department Notice Board**: Multi-class scoping, priority flags (`Urgent`, `High`, `Normal`), file attachments, and broadcast pinning. | `Communication Module` |
| **11** | **Team Tasks & Formation** | Individual student task workflow. | **Team Task Engine**: Configurable team sizes (2–5 members), interactive invitations, leader/member roles, and group proof submission. | `Collaborative Learning` |
| **12** | **Student Opt-Out Tracking** | Standard submission requirement for assigned tasks. | **Opt-Out Governance**: Structured participation choice with mandatory reason logging for institutional analysis. | `Academic Governance` |
| **13** | **Peer Discussions & Mentions** | Direct submission feedback channel. | **Threaded Q&A Discussions**: Interactive discussion thread per task with `@mentions` and real-time alerts. | `Collaborative Learning` |
| **14** | **Submission Review Pipeline** | Standard submission verification and approval. | **Multi-Stage Review**: Detailed rejection feedback notes, real-time alert banners, and 1-click proof resubmission. | `Workflow Enhancement` |
| **15** | **Task Expiry Management** | Fixed deadline enforcement. | **Flexible Lifecycle Management**: Administrative deadline extensions, task reopening, and automated student notifications. | `Administrative Control` |
| **16** | **Authentication & Identity** | Standard username and password authentication. | **Multi-Identifier Authentication**: Official College Email ID and Register Number login with sanitized input handling. | `Security & Auth` |
| **17** | **Database Snapshot Backups** | Standard cloud database persistence. | **Automated Daily Snapshots** ([`dbBackupService.ts`](file:///c:/Users/tharu/Downloads/IT_taskmanager-main/dbBackupService.ts)): Scheduled JSON database backups with rolling retention policy to ensure data safety. | `Data Reliability` |
| **18** | **Media Storage Lifecycle** | Cloudinary asset storage. | **Automated Storage Lifecycle** ([`imageCleanupService.ts`](file:///c:/Users/tharu/Downloads/IT_taskmanager-main/imageCleanupService.ts)): Scheduled cleanup worker to manage temporary upload storage efficiently. | `Resource Management` |
| **19** | **Server Caching & Optimization** | Direct database querying with connection pooling. | **High-Speed In-Memory Cache**: Scoped caching for authentication and read-heavy routes, tuned pool timeouts, and 11 compound indexes. | `Performance Tuning` |
| **20** | **Error Diagnostics** | Standard server console error logging. | **Centralized Error Tracking** ([`sentryService.ts`](file:///c:/Users/tharu/Downloads/IT_taskmanager-main/sentryService.ts)): Integrated Sentry monitoring for real-time exception diagnostics. | `Observability` |
| **21** | **Student Portfolio & Resumes** | Core academic task profile. | **Comprehensive Portfolio Builder**: Full resume builder with personal info, skills, projects, internships, certifications, coding handles, and career goals. | `Career Development` |
| **22** | **Relational Schema Scale** | Foundational 6 relational tables. | **29 Specialized Relational Tables** supporting coding analytics, teams, notices, student profiles, and system automations. | `Enterprise Architecture` |

---

## 🔬 Architectural Module Highlights

### 1. Coding Competency Analytics
* **LeetCode Profile Integration**: Connects with LeetCode GraphQL services to track daily problem counts, submission velocity, and difficulty distributions.
* **GitHub Activity Tracking**: Syncs daily total commit counts per student and logs them directly to Supabase/PostgreSQL for dashboard reporting.
* **Target Inheritance Hierarchy**:
  ```mermaid
  graph TD
    A["Student Custom Target"] --> B["Class Target"]
    B --> C["Year Target"]
    C --> D["Department Baseline"]
  ```

### 2. Telegram Bot Automation & Analysis Engine
* **Bot Username**: `@IT_TaskManager_Alerts_bot`
* **Student Status Lookup**: Sending a Register Number (e.g., `922524205001`) or `/check <reg_no>` returns the complete live performance scorecard.
* **Class & Year Shortcuts**:
  * `/3ita`, `/3itb`, `/3itc`, `/2ita`, `/2itb` $\rightarrow$ Class section report with active assignments and incomplete student lists.
  * `/2it`, `/3it`, `/year2`, `/year3` $\rightarrow$ Academic year batch report with **Section-Wise Breakdown** (IT-A, IT-B, IT-C overview).
* **Automated Reminders & Briefs**: Daily private reminders (8:00 PM IST) and group briefs (9:00 PM IST) with PostgreSQL deduplication locks.

### 3. OpenXML ExcelJS Reporting Engine
* Pure ExcelJS generation via `buildExcelReportBuffer` providing 9 specialized formats with dynamic boundary trimming, custom headers, and auto-calculated column widths.

### 4. High-Speed RAM Directory & Dual-Mode Git Sync
* Node.js memory cache (`studentDirectoryService.ts`) indexes 400+ student records in RAM for sub-millisecond lookups.
* Auto-commits coding handle updates to GitHub via REST API (for cloud containers) or Git CLI (for local environments).

### 5. Automated GitHub Nightly Sync & 29-Table Snapshot Archival
* **11:55 PM IST Daily LeetCode CSV Auto-Push**: Automatically builds datewise master and section-wise CSV reports (`leetcode/LeetCode_Daily_Report_YYYY-MM-DD.csv`, `leetcode/YYYY-MM-DD/Section_*.csv`) and pushes them to GitHub via GitHub Contents REST API & Git CLI.
* **29-Table JSON Snapshot Archival**: Every 24 hours, `generateDatabaseSnapshot()` captures all 29 PostgreSQL tables in `backups/db_backup_*.json` and pushes the snapshot to GitHub with 7-day rolling retention and automatic cloud pruning.

---

👨‍💻 **Developed and maintained by Tharunkumar K**  
🏛️ **Department of Information Technology, VSB Engineering College**
