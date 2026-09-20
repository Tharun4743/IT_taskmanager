<div align="center">

# 📋 IT Task Manager — Core Departmental Academic Task Orchestration Engine
### *Foundational Modular Microservice Architecture for Institutional Assignment & Verification Workflows*

[![Backend](https://img.shields.io/badge/Backend-Node.js%2020%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](#) [![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](#) [![Database](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](#)

<p align="center">
  <a href="https://github.com/Tharun4743/IT_taskmanager">📦 <b>Official GitHub Repository</b></a>
  
</p>

</div>

---

## 1. 📌 Problem Statement & Context
Departmental academic administration requires fine-grained task scheduling, deadline enforcement, and student verification matrices that can be isolated, updated, and tested without disrupting front-facing student portals.

---

## 2. 🔍 Existing Solutions & Critical Gaps
Monolithic student portals tightly couple UI views with task business logic, making schema refactoring, role-permission updates, and integration tests complex and error-prone.

---

## 3. 💡 Proposed Solution & Architectural Innovation
IT Task Manager represents the core backend business logic, route handlers, and database migration architecture powering institutional task lifecycle management. It defines strict schema validation, deadline calculation engines, and tier-based approval state machines.

---

## 4. ⚙️ Technical Approach & System Architecture
| Service Layer | Component | Functional Role |
| :--- | :--- | :--- |
| **API Routing** | Express.js Router, TypeScript | Role-guarded task creation, submission, and grading endpoints |
| **Business Logic** | State Machine Service | Manages 3-tier transitions (Pending → Peer Review → Faculty Approved) |
| **Persistence Layer** | PostgreSQL, Parameterized Queries | Foreign-key backed task logs, student submission archives, and audit records |

---

## 5. 📈 Quantifiable Impact & Measurable Benefits
* 🏛️ **Foundational Core:** Provided the rock-solid structural baseline from which VSBEC IT Vault was scaled to 365+ active students.
* 🛡️ **Zero Regression:** High unit test coverage over verification state transitions and permission checks.

---

## 6. 🚀 Feasibility, Operational Viability & Scalability
* 🔬 **Technical Feasibility:** Highly decoupled modular TypeScript architecture easily maintainable by student coordinators.
* 📈 **Scalability:** Pluggable design allows easy extraction into isolated Docker containers or microservices.

---

## 7. 👨‍💻 Author & Intellectual Property License

### Lead Architect & Author
**Tharunkumar K** ([@Tharun4743](https://github.com/Tharun4743))
* 🎓 B.Tech Information Technology • V.S.B. Engineering College, Karur
* 🌐 [GitHub Profile](https://github.com/Tharun4743) • [LinkedIn](https://linkedin.com/in/tharunkumark4743) • [Personal Portfolio](https://tharunkumark4743.netlify.app)

### 🔒 Proprietary License Notice (All Rights Reserved)
> [!CAUTION]
> **PROPRIETARY & CONFIDENTIAL INTELLECTUAL PROPERTY**
> 
> All rights reserved. This repository, its architecture, source code, workflows, firmware, and associated documentation are the exclusive intellectual property of **Tharunkumar K**.
> 
> **No entity, organization, or individual is permitted to copy, modify, distribute, publish, commercially exploit, reverse engineer, or deploy any portion of this project without express, prior written permission from the author.**
> 
> **Copyright © 2026 Tharunkumar K. All Rights Reserved.**
