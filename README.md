# IT Task Manager & Academic Management System
### End-to-End Task Verification, Student Oversight, and Live Coding Progress Tracking System

The **IT Task Manager** is a complete, enterprise-grade academic management system engineered for educational institutions and IT departments. The platform seamlessly combines **Academic Task Management**, **Team Collaboration**, **Multi-Tier Task Verification**, **Department Notice Boards**, **Student Feedback Handling**, and an advanced **Live Coding Progress & Target Management Engine** for **LeetCode** and **GitHub**.

---

## 🚀 Complete System Architecture

```mermaid
graph TD
    subgraph Frontend["💻 Frontend Dashboard Layer (React 18 + TypeScript + Vite + TailwindCSS)"]
        AdminUI["Supreme Admin / Admin Portal"]
        HODUI["HOD Portal"]
        YearCoordUI["Year Coordinator Portal"]
        AdvisorUI["Class Advisor Portal"]
        ClassCoordUI["Class Coordinator Portal"]
        StudentUI["Student Portal"]
    end

    subgraph Backend["⚡ Backend API Gateway (Node.js + Express + TypeScript)"]
        AuthModule["JWT Authentication & RBAC Middleware"]
        TaskEngine["Academic Task & Verification Engine"]
        CodingEngine["Coding Progress & Target Resolver"]
        RAMCache["🚀 In-Memory RAM Directory Cache (studentDirectoryService)"]
        ExcelService["📊 Automated Excel Export Generator (XLSX)"]
        KeepAliveService["🔄 RenderPing Keep-Alive & Health Monitor"]
    end

    subgraph Storage["🐘 Database & External Cloud Services"]
        PostgresDB[("PostgreSQL Database (Users, Tasks, Submissions, Targets, Logs)")]
        LeetCodeAPI["☁️ LeetCode GraphQL API"]
        GitHubAPI["☁️ GitHub REST / GraphQL API"]
    end

    Frontend <-->|REST Requests + JWT Bearer Auth| AuthModule
    AuthModule --> TaskEngine
    AuthModule --> CodingEngine
    TaskEngine <--> PostgresDB
    CodingEngine <-->|RAM Student Directory Lookups 0.01ms| RAMCache
    CodingEngine <-->|Compound Indexed Queries| PostgresDB
    CodingEngine -->|Batch Async Progress Fetching| LeetCodeAPI
    CodingEngine -->|Batch Async Progress Fetching| GitHubAPI
    CodingEngine --> ExcelService
    KeepAliveService <-->|Health Ping GET /api/health| Frontend
```

---

## 📋 Table of Contents
1. [Key Capabilities & Modules](#-key-capabilities--modules)
2. [Academic Task Verification Workflow](#-academic-task-verification-workflow)
3. [Coding Progress & Target Management Engine](#-coding-progress--target-management-engine)
4. [User Roles & Access Control Matrix](#-user-roles--access-control-matrix)
5. [System Workflows & Mermaid Diagrams](#-system-workflows--mermaid-diagrams)
6. [Complete Database Schema Reference](#-complete-database-schema-reference)
7. [Comprehensive API Endpoint Documentation](#-comprehensive-api-endpoint-documentation)
8. [Performance & Scalability Optimizations](#-performance--scalability-optimizations)
9. [Installation & Local Setup Guide](#-installation--local-setup-guide)
10. [Deployment Configuration (Render & Cloud)](#-deployment-configuration-render--cloud)

---

## 🌟 Key Capabilities & Modules

### 1. 📝 Academic Task Management Module
- **Multi-Scope Task Assignment**: Create tasks targeted to **Individual Students**, **Class Sections**, **Academic Years**, or **Department-Wide**.
- **Submission Formats**: Supports text responses, external links (Google Drive, GitHub, Figma, etc.), and file attachments.
- **Team Tasks & Collaboration**: Students can form teams, send invitations, assign team leaders, and submit joint assignments.

### 2. 🛡️ Multi-Tier Verification & Audit Workflow
- **Verification Pipeline**: Submitted tasks pass through review by **Class Advisors** and **Class Coordinators**.
- **Review Options**: Staff can **Verify**, **Reject** (with mandatory feedback comments), or mark submissions as **Pending Re-submission**.
- **Oversight Dashboards**: HODs and Year Coordinators can inspect verification progress across classes and years.

### 3. ⚡ Live Coding Progress Monitor (LeetCode & GitHub)
- **LeetCode Tracker**: Monitor total solved problems, daily status (`COMPLETED` / `NOT COMPLETED`), remaining problems to target, and weekly progress.
- **GitHub Tracker**: Track daily commits, new repository creations, daily commit status, and weekly commit aggregates.
- **Combined Progress View**: Single unified table displaying LeetCode problem solving and GitHub commit statistics side-by-side.
- **Monday–Sunday Day Breakdown**: View detailed day-by-day problem and commit counts across the current week.

### 4. 🎯 Target Management Engine
- Set daily and weekly target thresholds for **Individual Students**, **Classes**, **Academic Years**, or **Departments**.
- Multi-level target priority resolution (**Student** $\rightarrow$ **Class** $\rightarrow$ **Year** $\rightarrow$ **Department** $\rightarrow$ **Default**).
- Automated recalculation of student status upon target update.

### 5. 📊 Excel Reports & Analytics Export
- One-click export of beautifully formatted Excel `.xlsx` reports:
  - **Daily Progress Report**: Live daily problem/commit status.
  - **Weekly Progress Report**: Weekly progress totals & target completion percentages.
  - **Weekly Detailed Report**: Day-by-day Monday through Sunday breakdown.
  - **Defaulters / Incomplete Report**: Targeted list of students missing daily/weekly goals.
  - **Combined Progress Report**: Unified LeetCode + GitHub progress export.

### 6. 📢 Department Notice Board & Student Feedback
- **Notice Board**: Broadcast department announcements, attach files, pin important posts, and tag priority levels.
- **Feedback & Grievances**: Students submit feedback/queries; HODs and Class Advisors view and respond directly.

---

## 🔄 Academic Task Verification Workflow

```mermaid
sequenceDiagram
    autonumber
    participant Student as Student / Team Leader
    participant System as IT Task Manager Backend
    participant Advisor as Class Advisor / Coordinator
    participant HOD as HOD / Supreme Admin

    Student->>System: Submit Task (Text, Links, Attachments)
    System->>System: Update Status to PENDING_REVIEW
    Advisor->>System: Review Task Submission
    alt Submission Accepted
        Advisor->>System: Mark as VERIFIED
        System->>Student: Send Verification Notification & Update Progress
    else Submission Rejected
        Advisor->>System: Mark as REJECTED with Feedback
        System->>Student: Require Revision & Re-submission
    end
    HOD->>System: Audit Department & Class Verification Rates
```

---

## 🎯 4-Level Target Resolution Hierarchy

```mermaid
flowchart TD
    Start(["Evaluate Target for Student"]) --> L1{"Level 1: Individual Student Target?"}
    L1 -- Yes --> UseL1["Use Student-Specific Target"]
    L1 -- No --> L2{"Level 2: Class Section Target?"}
    L2 -- Yes --> UseL2["Use Class-Specific Target"]
    L2 -- No --> L3{"Level 3: Year / Batch Target?"}
    L3 -- Yes --> UseL3["Use Year-Level Target"]
    L3 -- No --> L4{"Level 4: Department Target?"}
    L4 -- Yes --> UseL4["Use Department-Level Target"]
    L4 -- No --> DefaultTarget["Use Default System Baseline (0 / No Target)"]
```

---

## 👥 User Roles & Access Control Matrix

| Feature / Action | Supreme Admin | HOD | Year Coordinator | Class Advisor | Class Coordinator | Student |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **All Departments Access** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Department Scope Access** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Year Scope Access** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Class Scope Access** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Create & Verify Tasks** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Manage Coding Targets** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Trigger Coding Sync** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Export Excel Reports** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Post Notices** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Submit Tasks & Track Progress** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Create Teams & Invite Members** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 🗄️ Complete Database Schema Reference

```mermaid
erDiagram
    departments ||--o{ classes : contains
    departments ||--o{ users : belongs_to
    classes ||--o{ users : contains
    users ||--o{ tasks : creates
    users ||--o{ submissions : submits
    tasks ||--o{ submissions : receives
    users ||--o{ leetcode_targets : targeted_by
    classes ||--o{ leetcode_targets : targeted_by
    users ||--o{ github_targets : targeted_by
    classes ||--o{ github_targets : targeted_by
    users ||--o{ leetcode_daily_progress : tracks
    users ||--o{ github_daily_progress : tracks

    departments {
        uuid id PK
        string name
        string code
        timestamp created_at
    }

    classes {
        uuid id PK
        string name
        int year
        string batch
        uuid department_id FK
        timestamp created_at
    }

    users {
        uuid id PK
        string register_number
        string full_name
        string email
        string password
        string role
        boolean is_coordinator
        boolean is_year_coordinator
        int year_scope
        uuid class_id FK
        uuid department_id FK
        string leetcode_url
        string github_url
    }

    tasks {
        uuid id PK
        string title
        string description
        string scope_type
        uuid target_value
        date due_date
        uuid created_by FK
        timestamp created_at
    }

    submissions {
        uuid id PK
        uuid task_id FK
        uuid student_id FK
        string content
        string submission_url
        string status
        text feedback
        timestamp created_at
    }

    leetcode_targets {
        uuid id PK
        int daily_target
        int weekly_target
        date start_date
        date end_date
        uuid user_id FK
        uuid class_id FK
        int year
        uuid department_id FK
        uuid created_by FK
    }

    leetcode_daily_progress {
        uuid id PK
        uuid user_id FK
        date date
        int total_solved
        int solved_today
        int daily_target
        string status
    }

    github_targets {
        uuid id PK
        int daily_commit_target
        int weekly_commit_target
        int daily_repo_target
        int weekly_repo_target
        date start_date
        date end_date
        uuid user_id FK
        uuid class_id FK
        int year
        uuid department_id FK
        uuid created_by FK
    }

    github_daily_progress {
        uuid id PK
        uuid user_id FK
        date date
        int total_repos
        int new_repos_today
        int total_commits
        int commits_today
        string commit_status
        string repo_status
    }
```

---

## 📡 Comprehensive API Endpoint Documentation

### Authentication & User Management
- `POST /api/auth/login`: Authenticate user and issue JWT token.
- `GET /api/auth/me`: Get current logged-in user profile.
- `POST /api/users`: Create user account (Admin / HOD).
- `PUT /api/users/profile`: Update user profile and LeetCode/GitHub handles.

### Academic Task Management
- `GET /api/tasks`: Fetch assigned tasks based on user role and scope.
- `POST /api/tasks`: Create new academic task.
- `DELETE /api/tasks/:id`: Delete academic task.
- `GET /api/submissions`: Fetch task submissions.
- `POST /api/submissions`: Submit task response (Student).
- `PUT /api/submissions/:id/verify`: Verify submission status (Advisor / Coordinator).
- `PUT /api/submissions/:id/reject`: Reject submission status with feedback.

### LeetCode Tracking & Targets
- `GET /api/leetcode/stats`: Fetch summary statistics cards for LeetCode tracker.
- `GET /api/leetcode/progress/daily`: Fetch daily LeetCode progress monitor table.
- `GET /api/leetcode/progress/weekly`: Fetch weekly LeetCode progress monitor table.
- `GET /api/leetcode/targets`: List active LeetCode target configurations.
- `POST /api/leetcode/targets`: Create or update LeetCode target.
- `DELETE /api/leetcode/targets/:id`: Delete LeetCode target configuration.
- `POST /api/leetcode/sync`: Trigger manual sync for LeetCode progress.

### GitHub Tracking & Targets
- `GET /api/github/stats`: Fetch summary statistics cards for GitHub tracker.
- `GET /api/github/progress/daily`: Fetch daily GitHub progress monitor table.
- `GET /api/github/progress/weekly`: Fetch weekly GitHub progress monitor table.
- `GET /api/github/targets`: List active GitHub target configurations.
- `POST /api/github/targets`: Create or update GitHub target.
- `DELETE /api/github/targets/:id`: Delete GitHub target configuration.
- `POST /api/github/sync`: Trigger manual sync for GitHub progress.

### Excel Export Endpoints
- `GET /api/leetcode/export/daily`: Export Daily LeetCode Excel Report.
- `GET /api/leetcode/export/weekly`: Export Weekly LeetCode Excel Report.
- `GET /api/leetcode/export/weekly-detailed`: Export Detailed Mon–Sun LeetCode Excel Report.
- `GET /api/leetcode/export/incomplete`: Export Defaulters LeetCode Excel Report.
- `GET /api/github/export/daily`: Export Daily GitHub Excel Report.
- `GET /api/github/export/weekly`: Export Weekly GitHub Excel Report.
- `GET /api/github/export/weekly-detailed`: Export Detailed Mon–Sun GitHub Excel Report.
- `GET /api/github/export/incomplete`: Export Defaulters GitHub Excel Report.
- `GET /api/coding/export-excel`: Export Combined Coding Progress Excel Report.

### Render Automation & Health Endpoints
- `GET /api/health`: Ultra-fast (< 2ms) health check endpoint for RenderPing keep-alive pinging.
- `POST /api/cron/sync-coding-progress`: Protected cron webhook for automated daily coding sync.

---

## ⚡ Performance & Scalability Optimizations

1. **Node.js In-Memory RAM Directory Cache (`studentDirectoryService.ts`)**:
   - Pre-indexes 400+ student profiles by ID, Class ID, Register Number, and Email in Node.js RAM.
   - Accelerates student directory lookups from **~30ms** (SQL database query) to **< 0.01ms**.
2. **Tab-Scoped Parallel Request Batching (`src/App.tsx`)**:
   - Groups API calls concurrently using `Promise.all` scoped strictly to the active platform tab (`LEETCODE`, `GITHUB`, or `COMBINED`).
   - Reduces network roundtrips per user interaction by **60–75%**.
3. **Compound PostgreSQL Database Indexes (`db.ts`)**:
   - Multi-column indexes on `leetcode_daily_progress(user_id, date, status)` and `github_daily_progress(user_id, date, commit_status)`.
   - Speeds up complex date range filtering and aggregation queries.

---

## 🚀 Installation & Local Setup Guide

### 1. Prerequisites
- **Node.js**: v18.x or higher
- **PostgreSQL**: v14.x or higher

### 2. Configure Environment Variables
Create a `.env` file in the root directory:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/it_taskmanager
JWT_SECRET=your_jwt_secret_key
CRON_SECRET=your_cron_webhook_secret
```

### 3. Installation & Run Commands

```bash
# 1. Install Node.js dependencies
npm install

# 2. Run Database Setup & Table Migrations
npx tsx db.ts

# 3. Start Express Backend Server
npx tsx server.ts

# 4. Start Vite Frontend Development Server
npm run dev
```

---

## 🛠️ Verification & Build Commands

```bash
# Backend TypeScript Type Check
npx tsc -p tsconfig.server.json --noEmit

# Frontend Production Single-File Build
npx vite build
```

---

## ☁️ Deployment Configuration (Render & Cloud)

The project includes a pre-configured `render.yaml` manifest:

```yaml
services:
  - type: web
    name: it-taskmanager
    env: node
    buildCommand: npm install && npx vite build && npx tsc -p tsconfig.server.json
    startCommand: npx tsx server.ts
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: CRON_SECRET
        generateValue: true
```

- **Keep-Alive Configuration**: Register `https://<your-render-app>.onrender.com/api/health` on [RenderPing](https://renderping.amudhanmohan.in) to prevent Render free-tier instances from going to sleep.
- **Automated Daily Sync**: Configure a cron job targeting `POST https://<your-render-app>.onrender.com/api/cron/sync-coding-progress` with header `x-cron-secret: <CRON_SECRET>` to automatically trigger daily LeetCode and GitHub progress synchronization.
