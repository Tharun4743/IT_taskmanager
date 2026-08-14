# IT Task Manager & Academic Management System
### Enterprise Academic Task Verification, Live Coding Progress Tracking & Automated Telegram Notification Platform

**IT Task Manager** is a complete, enterprise-grade academic management platform engineered for educational institutions, faculty coordinators, and IT departments. The system integrates **Academic Task Assignment & Verification**, **Team Collaboration**, **Live Coding Progress Tracking (LeetCode & GitHub)**, **Department Notice Boards**, and an **Automated Telegram Notification & Bot Engine**.

---

## 👨‍💻 Developer & Maintainer
- **Lead Developer**: [Tharunkumar K](https://tharunkumark4743.netlify.app/)
- **Department**: Department of Information Technology
- **Institution**: VSB Engineering College

---

## 🚀 System Architecture

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
        TelegramService["🤖 Telegram Bot Poller & Notification Engine"]
        RAMCache["🚀 In-Memory RAM Directory Cache (studentDirectoryService)"]
        ExcelService["📊 Automated Excel Export Generator (XLSX)"]
    end

    subgraph External["☁️ External Cloud Services & Databases"]
        PostgresDB[("PostgreSQL Database (Supabase / Neon)")]
        TelegramAPI["📱 Telegram Bot API (@IT_TaskManager_Alerts_bot)"]
        LeetCodeAPI["☁️ LeetCode GraphQL API"]
        GitHubAPI["☁️ GitHub REST / GraphQL API"]
        CloudinaryAPI["🖼️ Cloudinary CDN (Media & Proofs)"]
    end

    Frontend <-->|REST Requests + JWT Bearer Auth| AuthModule
    AuthModule --> TaskEngine
    AuthModule --> CodingEngine
    TaskEngine <--> PostgresDB
    CodingEngine <-->|RAM Student Directory Lookups 0.01ms| RAMCache
    CodingEngine <-->|Compound Indexed Queries| PostgresDB
    CodingEngine -->|Batch Async Sync| LeetCodeAPI
    CodingEngine -->|Batch Async Sync| GitHubAPI
    CodingEngine --> ExcelService
    TelegramService <-->|Long Polling & Webhook Dispatch| TelegramAPI
    TelegramService <--> PostgresDB
    TaskEngine --> CloudinaryAPI
```

---

## 📋 Table of Contents
1. [Key Capabilities & Modules](#-key-capabilities--modules)
2. [🤖 Telegram Bot & Automated Notifications](#-telegram-bot--automated-notifications)
3. [Academic Task Verification Workflow](#-academic-task-verification-workflow)
4. [Coding Progress & Target Management Engine](#-coding-progress--target-management-engine)
5. [User Roles & Access Control Matrix](#-user-roles--access-control-matrix)
6. [Complete Database Schema Reference](#-complete-database-schema-reference)
7. [Comprehensive API Endpoint Documentation](#-comprehensive-api-endpoint-documentation)
8. [Installation & Local Setup Guide](#-installation--local-setup-guide)
9. [Deployment Configuration (Render & Cloud)](#-deployment-configuration-render--cloud)

---

## 🌟 Key Capabilities & Modules

### 1. 📝 Academic Task Management Module
- **Multi-Scope Task Assignment**: Create tasks targeted to **Individual Students**, **Class Sections**, **Academic Years**, or **Department-Wide**.
- **Submission Formats**: Supports text responses, external links (Google Drive, GitHub, Figma, etc.), and file/screenshot attachments (via Cloudinary).
- **Team Tasks & Collaboration**: Students can form teams, invite peers, assign team leaders, and submit joint assignments.

### 2. 🛡️ Multi-Tier Verification & Audit Workflow
- **Verification Pipeline**: Submitted tasks pass through review by **Class Advisors** and **Class Coordinators**.
- **Review Actions**: Staff can **Verify**, **Reject** (with mandatory feedback comments), or mark submissions as **Pending Re-submission**.
- **Audit Dashboards**: HODs and Year Coordinators inspect real-time verification rates across sections and batches.

### 3. ⚡ Live Coding Progress Monitor (LeetCode & GitHub)
- **LeetCode Tracker**: Total solved problems, daily status (`COMPLETED` / `NOT COMPLETED`), remaining problems to target, and weekly progress.
- **GitHub Tracker**: Daily commit volume, new repository creations, daily commit status, and weekly commit aggregates.
- **Combined Progress View**: Side-by-side comparative table for both platforms.
- **Day 1–Day 7 Breakdown**: Detailed day-by-day problem and commit counts across the current week.

### 4. 🎯 Multi-Level Target Management Engine
- Set daily and weekly target thresholds for **Individual Students**, **Classes**, **Academic Years**, or **Departments**.
- 4-level target priority resolution (**Student** $\rightarrow$ **Class** $\rightarrow$ **Year** $\rightarrow$ **Department** $\rightarrow$ **Default**).
- Automated recalculation of student status upon target update.

### 5. 📊 Excel Reports & Analytics Export
- One-click export of beautifully formatted Excel `.xlsx` reports:
  - **Daily Progress Report**: Live daily problem/commit status.
  - **Weekly Progress Report**: Weekly progress totals & target completion percentages.
  - **Weekly Detailed Report**: Day-by-day Day 1 through Day 7 breakdown.
  - **Defaulters / Incomplete Report**: Targeted list of students missing daily/weekly goals.
  - **Combined Progress Report**: Unified LeetCode + GitHub progress export.

---

## 🤖 Telegram Bot & Automated Notifications

The platform includes an automated Telegram notification engine powered by [`telegramService.ts`](file:///telegramService.ts) and the official bot **`@IT_TaskManager_Alerts_bot`**.

### 🌟 Key Telegram Capabilities:
1. **1-Click Student Account Linking**:
   - Students tap **"Connect Telegram in 1-Click"** in their portal settings (`t.me/IT_TaskManager_Alerts_bot?start=<reg_no>`).
   - The bot automatically links their Telegram chat ID to their college profile.
2. **⏰ Automated Daily 8:00 PM IST 1-to-1 Private Reminders**:
   - The background scheduler identifies students with pending deadlines and sends private direct messages with interactive **`[ 🌐 Submit Proof on Portal ]`** buttons.
3. **⏰ Automated Daily 9:00 PM IST Department Group Summary**:
   - Posts a structured daily report with ASCII progress bars (`[██████░░░░] 60%`) and class completion stats to your department group.
4. **🤖 Self-Service Student Bot Commands**:
   - `/tasks` or `/pending`: Direct database lookup of active assignments assigned to the student.
   - `/status`: View connected student profile information.
   - `/summary`: Instant department summary.
   - `/unlink`: Disconnect account with 1 command.
   - `/id`: Prints group and personal chat IDs.
5. **⚡ Anti-Flood Rate Limiting**:
   - Throttled queue dispatch (40ms interval) to guarantee zero Telegram `429 Too Many Requests` errors during mass notifications.

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

## 👥 User Roles & Access Control Matrix

| Feature / Action | Supreme Admin | HOD | Year Coordinator | Class Advisor | Class Coordinator | Student |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **All Departments Access** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Department Scope Access** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Year Scope Access** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Class Scope Access** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Create & Verify Tasks** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Manage Coding Targets** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Trigger Telegram Reminders** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Configure Telegram Group ID** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Export Excel Reports** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Submit Tasks & Connect Bot** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 🗄️ Database Schema Reference

```mermaid
erDiagram
    departments ||--o{ classes : contains
    departments ||--o{ users : belongs_to
    classes ||--o{ users : contains
    users ||--o{ tasks : creates
    users ||--o{ submissions : submits
    tasks ||--o{ submissions : receives
    users ||--o{ leetcode_daily_progress : tracks
    users ||--o{ github_daily_progress : tracks

    users {
        uuid id PK
        string register_number
        string full_name
        string email
        string password
        string role
        string telegram_chat_id
        string telegram_username
        timestamp telegram_linked_at
        uuid class_id FK
        uuid department_id FK
    }

    system_settings {
        string key PK
        text value
        timestamp updated_at
    }

    tasks {
        uuid id PK
        string title
        string description
        string category
        date deadline
        string status
        uuid created_by FK
    }

    submissions {
        uuid id PK
        uuid task_id FK
        uuid user_id FK
        string submission_url
        string status
        text feedback
        timestamp created_at
    }
```

---

## 📡 Comprehensive API Endpoint Documentation

### Authentication & User Management
- `POST /api/auth/login`: Authenticate user and issue JWT token.
- `GET /api/auth/me`: Get current logged-in user profile with Telegram link status.
- `POST /api/users`: Create user account.
- `PUT /api/users/profile`: Update profile, handles, and settings.

### Telegram Automation Endpoints
- `GET /api/telegram/status`: Retrieve Telegram bot connection stats & student linking counts.
- `POST /api/telegram/set-group-chat`: Configure Telegram Department Group Chat ID.
- `POST /api/telegram/send-group-summary`: Manually trigger department summary dispatch.
- `POST /api/telegram/send-reminders`: Manually trigger 1-to-1 pending task reminders.
- `POST /api/telegram/test`: Send a test notification to verify bot connectivity.
- `DELETE /api/student/unlink-telegram`: Disconnect student Telegram account.

### Academic Task Management
- `GET /api/tasks`: Fetch assigned tasks.
- `POST /api/tasks`: Create academic task.
- `DELETE /api/tasks/:id`: Delete academic task.
- `GET /api/submissions`: Fetch task submissions.
- `POST /api/submissions`: Submit task response (Student).
- `PUT /api/submissions/:id/verify`: Verify submission status (Staff).
- `PUT /api/submissions/:id/reject`: Reject submission with feedback.

### LeetCode & GitHub Tracking
- `GET /api/leetcode/stats`: Fetch summary statistics cards for LeetCode tracker.
- `GET /api/leetcode/progress/daily`: Fetch daily LeetCode progress table.
- `GET /api/leetcode/progress/weekly`: Fetch weekly LeetCode progress table.
- `GET /api/github/stats`: Fetch summary statistics cards for GitHub tracker.
- `GET /api/github/progress/daily`: Fetch daily GitHub progress table.
- `GET /api/github/progress/weekly`: Fetch weekly GitHub progress table.
- `POST /api/leetcode/sync`: Trigger manual sync for LeetCode.
- `POST /api/github/sync`: Trigger manual sync for GitHub.

---

## 🚀 Installation & Local Setup Guide

### 1. Prerequisites
- **Node.js**: v18.x or higher
- **PostgreSQL**: v14.x or higher (or Supabase / Neon connection)

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:

```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/it_taskmanager
JWT_SECRET=your_jwt_secret_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_admin_chat_id
TELEGRAM_GROUP_CHAT_ID=your_group_chat_id
```

### 3. Installation & Run Commands

```bash
# 1. Install Node.js dependencies
npm install

# 2. Run Database Setup & Table Migrations
npx tsx db.ts

# 3. Start Backend Server
npx tsx server.ts

# 4. Start Frontend Development Server
npm run dev
```

---

## ☁️ Deployment Configuration (Render)

1. Connect your repository to **Render** as a **Web Service**.
2. **Build Command**: `npm install && npx vite build && npx tsc -p tsconfig.server.json`
3. **Start Command**: `npx tsx server.ts`
4. Set your private environment variables in the Render Dashboard:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `TELEGRAM_GROUP_CHAT_ID`

---

## 📄 License & Attribution
Developed with ❤️ by **[Tharunkumar K](https://tharunkumark4743.netlify.app/)**  
Department of Information Technology, VSB Engineering College.
