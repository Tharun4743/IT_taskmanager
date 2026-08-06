<div align="center">

# 🎓 VSBEC Academic Task Manager

[![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)](https://cloudinary.com)
[![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://render.com)

**Enterprise-Grade Academic Workflow, Team Task & Verification Platform**
*Developed for M.Kumarasamy / VSB Engineering College — Department of Information Technology*

</div>

---

## 📌 1. System Overview & Architecture

The **VSBEC Task Manager** is a full-stack academic workflow, proof verification, and institutional analytics platform. It replaces legacy spreadsheet tracking with a real-time, role-guarded cloud system for managing academic activities (Competitions, Courses, Workshops, and College Work).

### Architecture Highlights
* **Single-Page Application**: Built with **React 19**, **Tailwind CSS v4**, **Lucide Icons**, and **Motion** animations, compiled via Vite.
* **REST API Server**: Built with **Express 4**, featuring strict JWT authentication, role guards, Zod validation, and rate limiting.
* **PostgreSQL Engine**: Raw SQL query execution via `pg.Pool` with connection pooling, statement timeouts, and optimized B-Tree indexing.
* **Cloud Storage**: Integrated **Cloudinary CDN** streaming for task posters and student proof screenshots with batched resource cleanup.

---

## ⚔️ Master Feature Comparison (Original Repo vs Updated Repo)

A comprehensive breakdown comparing the original base repository (**`PratapSakthivel/VSBEC-TASK-MANAGER`**) with this updated repository (**`Tharun4743/IT_taskmanager`**):

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

## 👥 2. Complete Role Workflows & Authorization

### 🎓 2.1 Role 1: Student
* **Capabilities**:
  * View individual & team tasks assigned to their Class Section or Department.
  * Submit individual task proof screenshot + custom field text.
  * Mark tasks as "Not Participating" with a mandatory explanation reason.
  * Preview selected screenshots before submission with a one-click **"Delete / Pick Different Image"** button.
  * Create team tasks, invite section classmates, accept/decline team invites, and track team status.
  * Team Leaders can submit team proof screenshot once all invited members have accepted (0 pending invites).
  * Resubmit rejected tasks (up to 2 resubmissions).
  * View personal submission history and reviewer feedback notes.
* **Restrictions**:
  * Cannot create individual tasks or verify submissions.
  * Cannot invite students from outside their class section.

### 👑 2.2 Role 2: Student Coordinator
* **Capabilities**:
  * All Student capabilities.
  * Create new tasks targeted to their assigned class section.
  * Verify or reject individual and team task submissions for students in their assigned section.
  * Unlock rejected student submissions to grant additional resubmissions.
  * Access section statistics, submission progress, and gender-wise breakdowns.
* **Restrictions**:
  * Cannot close tasks, reopen tasks, or extend deadlines (HOD Exclusive).
  * Cannot manage users, advisors, or class structures.

### 👨‍🏫 2.3 Role 3: Class Advisor & Year Coordinator
* **Capabilities**:
  * Manage students in their class section (Single entry or Bulk Excel/CSV upload).
  * Promote/demote Student Coordinators.
  * Reset student passwords back to default (Register Number).
  * Create tasks targeted to their section.
  * If **Year Coordinator**: Scope expands across all sections in their assigned Year (e.g. Year 2 IT-A, IT-B, IT-C). Can assign year-wide tasks and view year analytics.
  * Verify/reject submissions and generate class reports.
* **Restrictions**:
  * Cannot close tasks, reopen tasks, or extend deadlines (HOD Exclusive).

### 🏛️ 2.4 Role 4: Head of Department (HOD)
* **Capabilities**:
  * Department-wide control across all classes, advisors, coordinators, and students.
  * Create, edit, and delete classes and advisors within the department.
  * Create department-wide tasks or select target classes.
  * **Exclusive Task Control**:
    * **Close / Open Task**: Toggle task availability status (`OPEN` / `CLOSED`).
    * **Reopen & Extend Deadline**: Set a new future deadline date/time, automatically reopen closed tasks, and dispatch `TASK_REOPENED` notifications to all target students.
  * Verify/reject any submission in the department.
  * Access comprehensive department analytics and multi-sheet institutional Excel reports.

### 🛡️ 2.5 Role 5: Supreme Admin
* **Capabilities**:
  * Unrestricted institution-wide control across all departments, classes, users, tasks, and system settings.
  * Create and delete departments.
  * System-wide analytics and report exports.

---

## 🔄 3. System Execution Flowcharts

### 3.1 Task & Submission Lifecycle Diagram

```mermaid
graph TD
    A[Task Published by Staff / HOD] -->|Assigned to Class / Dept| B(Student Views Task)
    
    B -->|Individual Task| C[Upload Proof / Custom Field]
    B -->|Opt Out| D[Mark Not Participating + Add Reason]
    B -->|Team Task| E[Leader Creates Team & Invites Classmates]
    
    E --> F{Classmates Accept/Decline Invite}
    F -->|Accepted| G[Pending Invites Expired on Other Teams]
    G --> H{All Members Accepted & 0 Pending?}
    H -->|Yes| I[Team Leader Submits Team Proof]
    
    C --> J[Reviewer Verification Grid]
    I --> J
    
    J -->|Approved| K[Status: VERIFIED / APPROVED]
    J -->|Rejected| L[Status: REJECTED + Feedback Reason]
    
    L -->|Resubmit Count < 2| B
    L -->|Resubmit Count >= 2| M[Submission Locked]
    M -->|HOD / Advisor Action| N[Unlock Submission] --> B
```

---

## 🤝 4. Team Task Rules & Logic Specification

1. **Classmate Invitations**:
   * A student can create a team and select section classmates to invite.
   * Invitations are dispatched with `PENDING` status.
2. **Conflict Prevention & Auto-Expiration**:
   * A student can receive multiple team invitations while in `PENDING` state.
   * **Once a student ACCEPTS an invitation to Team A**:
     * Their membership in Team A becomes `ACCEPTED`.
     * All other `PENDING` invitations for that student for the same task are automatically marked as `EXPIRED` and `DECLINED`.
     * Other team leaders can no longer invite or add this student.
3. **Proof Submission Requirements**:
   * The team leader can submit screenshot proof **only when**:
     1. All invited team members have responded (`0 PENDING` invitations remaining).
     2. The minimum team size requirement is met.
4. **Pre-Submission Screenshot Management**:
   * Before clicking submit, both Individual students and Team Leaders can click **"Delete / Pick Different Image"** to remove a selected file preview and select another image.

---

## 📊 5. Institutional Excel Report Generator

The system generates a multi-sheet **.xlsx** workbook formatted according to institutional presentation standards:

```
╔════════════════════════════════════════════════════════════════════════════════════════════╗
║                            VSB ENGINEERING COLLEGE, KARUR                                  ║
║                             (AN AUTONOMOUS INSTITUTION)                                    ║
║                        DEPARTMENT OF INFORMATION TECHNOLOGY                                ║
║                              ACADEMIC YEAR 2024 – 2028                                     ║
║                      [Task Name / Selection] - [Target Classes]                            ║
╠════════════════════════════════════════════════════════════════════════════════════════════╣
║ Sheet 1: Detailed Report  → S.No | Name | Reg No | Mail ID | Task Name | Status | Custom... ║
║ Sheet 2: Summary Report   → Task Name | Class | Total | Verified | Submitted | Rejected... ║
║ Sheet 3: Team Wise Report → S.No | Team Name | Leader | Participants | Task | Category | Status ║
╚════════════════════════════════════════════════════════════════════════════════════════════╝
```

### Sheet 3 Column Schema ("Team Wise Report")
1. **S.No**: Serial Number
2. **Team Name**: Name of the team
3. **Team Leader**: Leader Name & Register Number (`John Doe (REG101)`)
4. **Team Participants**: Comma-separated list of all accepted team members (`John Doe (REG101), Jane Smith (REG102)`)
5. **Hackathon / Task Name**: Title of the team task
6. **Category**: Category (e.g. Competition / Workshop / Hackathon)
7. **Team Status**: Current submission/verification status (`FORMING`, `READY`, `SUBMITTED`, `APPROVED`, `REJECTED`)

---

## 🗄️ 6. Database Schema & Performance Indexing

```mermaid
erDiagram
    departments ||--o{ classes : "contains"
    departments ||--o{ users : "belongs to"
    classes ||--o{ users : "enrolls"
    users ||--o{ tasks : "creates"
    tasks ||--|{ task_classes : "assigned to"
    classes ||--|{ task_classes : "receives"
    users ||--o{ task_submissions : "submits"
    tasks ||--o{ task_submissions : "contains"
    teams ||--o{ team_members : "has"
    teams ||--o{ team_invitations : "sends"
    teams ||--o{ team_submissions : "submits proof"

    users {
        uuid id PK
        varchar username UK
        varchar password
        varchar role
        uuid class_id FK
        varchar full_name
        varchar register_number UK
    }
    tasks {
        uuid id PK
        varchar title
        timestamp deadline
        varchar status
        varchar submission_type
    }
    teams {
        uuid id PK
        uuid task_id FK
        uuid class_id FK
        uuid leader_id FK
        varchar team_name
        varchar status
    }
```

### Hot B-Tree Performance Indexes
* `idx_tasks_dept`: `tasks(department_id)`
* `idx_submissions_task_user`: `task_submissions(task_id, user_id)`
* `idx_users_class_role`: `users(class_id, role)`
* `idx_team_invitations_team_student`: `team_invitations(team_id, student_id)`
* `idx_notifications_user_read`: `notifications(user_id, is_read)`

---

## 🔌 7. REST API Endpoints Specification

| Method | Endpoint | Access Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Strict bcrypt password authentication |
| `GET` | `/api/auth/me` | Authenticated | Get current authenticated user profile |
| `GET` | `/api/tasks` | Authenticated | List tasks scoped by role & section |
| `POST` | `/api/tasks` | Admin, HOD, Advisor, Coord | Create a new individual or team task |
| `PATCH`| `/api/tasks/:id/status` | HOD, Supreme Admin | **Close or Open task** |
| `PATCH`| `/api/tasks/:id/reopen` | HOD, Supreme Admin | **Reopen task & extend deadline** |
| `DELETE`|`/api/tasks/:id` | HOD, Supreme Admin | Delete task and batch purge Cloudinary assets |
| `POST` | `/api/submissions` | Student | Submit individual proof (with screenshot) |
| `POST` | `/api/submissions/not-participating` | Student | Opt out of task with reason |
| `PATCH`| `/api/submissions/:id/verify` | HOD, Advisor, Coord | Verify or reject individual submission |
| `PATCH`| `/api/submissions/:id/unlock` | HOD, Advisor, Coord | Unlock submission for further resubmission |
| `GET` | `/api/team/classmates/:taskId` | Student | Get eligible section classmates for team |
| `POST` | `/api/team/create` | Student | Create team & send invitations |
| `POST` | `/api/team/invite` | Student | Invite additional classmates to team |
| `POST` | `/api/team/respond` | Student | Accept or decline team invitation |
| `POST` | `/api/team/submit` | Student (Leader) | Submit team task proof (0 pending invites req) |
| `POST` | `/api/team/review` | HOD, Advisor, Coord | Review & approve/reject team submission |
| `GET` | `/api/team/report` | Authenticated | Fetch team report data for Excel export |
| `GET` | `/api/stats/hod` | HOD | Fetch HOD department analytics |
| `GET` | `/api/stats/advisor` | Class Advisor | Fetch section analytics & gender stats |
| `GET` | `/api/stats/coordinator` | Student Coordinator | Fetch coordinator section analytics |

---

## 🛠️ 8. Setup & Local Development

### 1. Configure Environment Variables (`.env`)
```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/vsbec_taskmanager
JWT_SECRET=your_jwt_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 2. Install & Run Locally
```bash
# Install dependencies
npm install

# Run TypeScript type check
npm run lint

# Start development server
npm run dev
```

### 3. Production Local Build
```bash
# Build Vite frontend bundle
npm run build

# Launch Express server
npm start
```

---

## 🚀 9. Production Deployment (Render)

This application is designed for persistent Node.js server deployment on **Render** (or AWS/DigitalOcean).

1. Push your code to your GitHub repository.
2. Go to **Render Dashboard** -> **New Web Service**.
3. Connect your repository. Render automatically reads `render.yaml`.
4. Configure required Environment Variables in Render:
   * `DATABASE_URL` (PostgreSQL connection string)
   * `JWT_SECRET`
   * `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
5. **Build Command:** `npm install && npm run build`
6. **Start Command:** `npm start`

---

<div align="center">

*Developed for VSB Engineering College (Karur) — Department of Information Technology*
*All rights reserved © 2024–2028*

</div>
