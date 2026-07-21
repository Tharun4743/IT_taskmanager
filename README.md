# VSB Engineering College — Academic Task Manager (VSBEC-ATM)

[![Stack](https://img.shields.io/badge/Stack-React_19_|_Express_|_PostgreSQL_|_Cloudinary-blue?style=for-the-badge&logo=react)](https://github.com/Tharun4743/IT_taskmanager)
[![License](https://img.shields.io/badge/License-MIT-green.style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production_Ready-brightgreen?style=for-the-badge)](https://github.com/Tharun4743/IT_taskmanager)

> **Enterprise-Grade Academic Workflow & Verification System** built for **VSB Engineering College (Department of Information Technology)**. Designed to streamline academic event tracking, proof verification, multi-class progress analytics, and institutional report generation.

---

## 📐 System Architecture

```mermaid
graph TD
    subgraph Client Layer ["Client Layer (Single Page Application)"]
        UI["React 19 + Tailwind CSS UI"]
        State["State Management & Local Cache"]
        ExcelEngine["SheetJS Excel Exporter"]
    end

    subgraph Security & API Gateway ["API Gateway & Middleware"]
        CORS["CORS Policy & Rate Limiter (300 req / 15 min)"]
        JWT["JWT Auth & Role Authorization Middleware"]
    end

    subgraph Backend Service ["Backend Application (Node.js + Express)"]
        TaskSvc["Task & Assignment Controller"]
        SubSvc["Submission & Review Controller"]
        AnalyticsSvc["Analytics & Aggregation Controller"]
        ReportSvc["Report Generator Engine"]
    end

    subgraph Data & Cloud Services ["Data & Cloud Layer"]
        DB[(PostgreSQL Database)]
        Cloudinary["Cloudinary CDN (File Storage)"]
    end

    UI -->|HTTP / REST API| CORS
    CORS --> JWT
    JWT --> TaskSvc
    JWT --> SubSvc
    JWT --> AnalyticsSvc
    JWT --> ReportSvc
    
    SubSvc -->|Direct Upload| Cloudinary
    TaskSvc --> DB
    SubSvc --> DB
    AnalyticsSvc --> DB
    ReportSvc --> DB
```

---

## 🔐 Role-Based Access Control (RBAC) Matrix

| Feature / Authority | Supreme Admin | HOD | Year Coordinator | Class Advisor | Student Coordinator | Student |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **System-Wide Analytics** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Department Overseer** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Year-Wide Task Assignment** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Class Task Assignment** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Assign Student Coordinator** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Verify / Reject Submissions** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Multi-Class Excel Export** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Submit Task Proof** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 🔄 Task Submission & Verification Lifecycle

```mermaid
stateDiagram-v2
    [*] --> OPEN: Task Created by Staff/HOD
    OPEN --> SUBMITTED: Student Uploads Proof & Custom Input
    SUBMITTED --> VERIFIED: Advisor / HOD Verifies Proof
    SUBMITTED --> REJECTED: Advisor Rejects with Feedback
    REJECTED --> SUBMITTED: Student Resubmits (Max 2 Attempts)
    VERIFIED --> [*]: Completed & Counted in Metrics
    REJECTED --> LOCKED: Resubmission Limit Reached
```

---

## 🗄️ Database Entity-Relationship (ER) Diagram

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
    task_submissions ||--o{ submission_reviews : "audit trail"
    users ||--o{ notifications : "notified"

    departments {
        uuid id PK
        varchar name "UNIQUE"
        timestamp created_at
    }
    classes {
        uuid id PK
        varchar name
        uuid department_id FK
        int year
        varchar batch
    }
    users {
        uuid id PK
        varchar username "UNIQUE"
        varchar password
        varchar role
        uuid department_id FK
        uuid class_id FK
        varchar full_name
        varchar register_number "UNIQUE"
        boolean is_coordinator
        boolean is_year_coordinator
        int year_scope
        boolean is_active
    }
    tasks {
        uuid id PK
        varchar title
        text description
        varchar category
        varchar external_link
        timestamp deadline
        text screenshot_instruction
        varchar custom_field_label
        uuid created_by FK
        uuid department_id FK
        varchar status
    }
    task_submissions {
        uuid id PK
        uuid task_id FK
        uuid user_id FK
        varchar status
        varchar screenshot_url
        text custom_field_value
        text verification_note
        text rejection_reason
        int resubmission_count
        timestamp submitted_at
        timestamp verified_at
    }
```

---

## 📊 Institutional Excel Reporting Engine

Reports generated via the **Report Studio** adhere strictly to VSB Engineering College institutional formatting standards:

### Institutional Header Block (Applied to Both Worksheets)
```
Row 1 │ VSB ENGINEERING COLLEGE, KARUR
Row 2 │ (AN AUTONOMOUS INSTITUTION)
Row 3 │ DEPARTMENT OF INFORMATION TECHNOLOGY
Row 4 │ ACADEMIC YEAR 2024-2028
Row 5 │ [Task Name] - III YEAR IT SECTION A (or A & B)
Row 6 │ [Blank Separator]
Row 7 │ Column Headers
```

### Multi-Sheet Structure
- **Sheet 1: Detailed Report**
  `S.No | Name | Reg No | Mail ID | Task Name | Task Status`
- **Sheet 2: Summary**
  `Task Name | Class | Total Students | Verified | Submitted | Rejected | Not Submitted`

---

## ⚡ Key Technical Innovations

1. **IDOR & Scope Guarding**: API middleware prevents class advisors from accessing or verifying tasks outside their designated class or department scope.
2. **Cloudinary Direct File Streaming**: Screenshots and PDF proofs are stored directly on Cloudinary CDN; database holds immutable HTTPS URLs to prevent local storage bloat.
3. **Resubmission Limit Control**: Prevents infinite resubmission loops by enforcing a 2-attempt limit on rejected tasks.
4. **Audit Trail Logging**: `submission_reviews` captures historical state changes (who verified/rejected, timestamps, and feedback history).
5. **Multi-Class Aggregation**: HODs can select multiple classes simultaneously via checkboxes to generate combined multi-section reports in a single Excel file.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Framer Motion, SheetJS (XLSX)
- **Backend**: Node.js, Express, Multer, Zod, JWT, Bcrypt
- **Database**: PostgreSQL (`pg.Pool`), UUID Keys, Indexes on Foreign Relations
- **Storage**: Cloudinary API (Auto-format optimization for images & PDFs)

---

## 🚀 Environment & Setup Guide

### 1. Environment File (`.env`)
```env
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/vsbec_taskmanager
JWT_SECRET=super_secret_jwt_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
NODE_ENV=production
FRONTEND_URL=https://vsbec.unaux.com
```

### 2. Local Installation
```bash
# Install dependencies
npm install

# Run database schema migrations & start server
npm run dev
```

### 3. Verification & Build Commands
```bash
# Typecheck codebase
npm run lint

# Compile production bundle
npm run build

# Start production server
npm start
```

---

## 📜 License & Institutional Notice
Developed for **VSB Engineering College (Karur)** — Department of Information Technology. All rights reserved.
