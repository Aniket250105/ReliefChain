# ReliefChain: Full Project Context & Technical Overview

## 1. Project Mission & Vision
**ReliefChain** is an **India-only** blockchain-powered disaster relief platform designed to solve the critical problems of transparency, accountability, and traceability in disaster management. 

By integrating traditional Web2 architecture (Next.js, Node.js/Express, PostgreSQL) with Web3 primitives (Smart Contracts, Hardhat, IPFS/CIDs), ReliefChain ensures that every Rupee donated and every resource distributed is verifiably tracked from end to end.

**Core Principles:**
1. **Absolute Transparency:** All critical financial allocations, inventory movements, and field distributions are recorded on an immutable ledger.
2. **Geographical Specificity:** The application enforces strict validation ensuring operations, funds, and events are strictly within the context of Indian states, districts, cities, and Indian Rupees (₹).
3. **Multi-Actor Workflow:** Disaster relief is a collaborative effort. ReliefChain connects Governments, NGOs, Suppliers, Logistics (Warehouses), Field Officers, Donors, and Auditors in a unified system.

---

## 2. The 9-Role Ecosystem (Canonical Accounts)
ReliefChain operates using Role-Based Access Control (RBAC), dividing the disaster lifecycle across specialized actors.

| Role | Responsibility | Demo Account |
| :--- | :--- | :--- |
| **System Admin** | Ultimate system control and configuration. | `sysadmin@reliefchain.local` |
| **Government Authority** | Creates/verifies disasters, approves NGO campaigns, oversees/authorizes fund allocations via multisig. | `authority@gov.local` |
| **NGO Admin** | Proposes relief campaigns, requests resource allocations, oversees NGO operators. | `ngoadmin@hoperelief.local` |
| **NGO Operator** | Executes daily operational tasks for the NGO. | `ngooperator@hoperelief.local` |
| **Supplier / Vendor** | Fulfills authorized allocations, registers physical resources, and establishes provenance on-chain. | `supplier@medlogistics.local` |
| **Warehouse Operator** | Receives supplies from vendors, tracks physical inventory, dispatches to officers. | `warehouse@central.local` |
| **Relief Officer** | The "boots on the ground." Distributes resources to end beneficiaries and uploads cryptographic evidence (SHA-256). | `reliefofficer@hoperelief.local` |
| **Auditor** | Independent oversight. Reviews AI anomaly alerts and verifies cryptographic proofs against field data. | `auditor@trustaudit.local` |
| **Donor** | Supports campaigns via Web2 (Razorpay) or Web3 (Crypto), and tracks verifiable impact metrics. | `donor@example.local` |

*(Note: All demo accounts use the default password: `devpassword123`)*

---

## 3. The End-to-End Operational Workflow
The platform is designed to be demonstrated as one seamless pipeline:

1. **Disaster Declaration (Authority):** An emergency is verified in a specific Indian state/district.
2. **Campaign Proposal (NGO):** An NGO creates a campaign linked to the disaster.
3. **Campaign Approval (Authority):** The Government validates and approves the campaign to receive public funds.
4. **Fundraising (Donor):** Public donations flow in via Razorpay integrations.
5. **Allocation Request (NGO):** The NGO requests funds to buy specific resources (e.g., medical kits, food).
6. **Multisig Approval (Authority):** The Government signs a multisignature transaction to release funds to Suppliers.
7. **Resource Provenance (Supplier):** The Supplier mints/registers the resources on-chain and dispatches a "Resource Batch".
8. **Inventory Management (Warehouse):** The Warehouse receives the batch, bringing it into active inventory.
9. **Field Distribution (Relief Officer):** The Officer distributes goods, capturing evidence (photos, recipient details).
10. **Cryptographic Proof (System):** The evidence is hashed (SHA-256), a CID is generated, and a `DistributionRecorded` event is fired on the blockchain.
11. **Event Indexing (Backend):** The custom Event Indexer strictly reconciles the on-chain CID with the off-chain PostgreSQL database.
12. **Audit & Transparency (Auditor & Public):** An AI Anomaly Detection service flags suspicious activity, while the Public Dashboard visually tracks verified impact.

---

## 4. Technology Stack & Architecture

### Frontend (`apps/web`)
- **Framework:** Next.js (App Router) v14
- **Styling:** Tailwind CSS v4, custom highly polished UI
- **Notifications:** React Hot Toast
- **Maps:** D3-geo / react-simple-maps for the Public Dashboard India map.
- **Web3:** `ethers.js` for MetaMask integration and contract interactions.

### Backend (`apps/api`)
- **Framework:** Node.js + Express
- **Database:** PostgreSQL accessed via Prisma ORM
- **Cache/Queue:** Redis (for background jobs, rate-limiting, and idempotency)
- **Authentication:** JWT (JSON Web Tokens) with secure HttpOnly cookies + Bearer tokens.
- **Payments:** Razorpay API for Web2 fiat donations (INR).

### Blockchain (`packages/contracts`)
- **Network:** Hardhat local node (Chain ID: 31337)
- **Contracts:** Custom Solidity contracts handling Multisig Wallets, Resource Provenance, and Distribution Event emitting.
- **Indexer:** A custom Node.js script (`run-indexer.js`) that continuously listens to Hardhat events and synchronizes blockchain state with PostgreSQL.

### AI Anomaly Service (`apps/ai`)
- **Framework:** Python + FastAPI
- **Purpose:** Acts as an advisory-only risk analysis engine. It evaluates transactions, allocations, and field distributions to generate `AIAlert` records for human Auditors to review. It *never* blocks transactions autonomously.

### Shared Logic (`packages/shared-types`)
- **Purpose:** Enforces data consistency across frontend and backend.
- **Rules:** Contains strict utility functions like `formatINR()`, `formatDate()` (dd/mm/yyyy), and the definitive list of `INDIAN_STATES_UTS`.

---

## 5. Critical System Constraints & Rules
ReliefChain has been rigidly hardened around several core product requirements:
1. **India-Only Scope:** The application strictly enforces Indian formatting. No foreign currencies (like `$`), no US dates (like `mm/dd/yyyy`), and no generic locations (like "Southeast Asia").
2. **Deterministic CID Reconciliation:** The Event Indexer uses exact string matching to verify off-chain PostgreSQL data against on-chain Ethereum events, ensuring absolute data integrity for the "Proof-of-Impact".
3. **No Phantom State:** Every dashboard reflects the *same* live PostgreSQL and Blockchain state. No hardcoded mock data remains in the functional UI paths.
4. **AI is Advisory:** The AI Auditor cannot halt the system. It strictly flags anomalies for the human Auditor role.

## 6. Current Project State
The project has completed its **Final E2E Integration & Demo Polish** phase.
- All 9 workflows are completely functional and interconnected.
- CSS and styling have been hardened (toast notifications implemented, error states refined).
- Compiles successfully with zero critical errors.
- Fully ready for evaluator presentation and live demonstration.

---

## 7. Dashboard & UI Screens Breakdown
The application routes users to specific dashboards based on their role. Each dashboard is designed to fulfill a distinct part of the disaster relief lifecycle.

### 7.1. Public Transparency Dashboard (`/public/dashboard`)
- **Access:** Public (No authentication required).
- **Purpose:** Proves the system's core value proposition of absolute transparency.
- **Key Features:**
  - **Live India Map:** Visually plots active disaster zones across the country.
  - **Global KPIs:** Displays real-time aggregate data (Active Disasters, Total Funds Raised in ₹, Beneficiaries Served).
  - **Active Campaign Stats:** Lists all active campaigns, showing the NGO in charge, the associated disaster, and a breakdown of funds raised vs. resources distributed.

### 7.2. Government Authority Dashboard (`/dashboard/authority`)
- **Access:** `SYSTEM_ADMIN`, `GOVERNMENT_AUTHORITY`
- **Purpose:** System oversight, validation, and financial authorization.
- **Key Features:**
  - **Disaster Management:** Form to declare a new disaster with strict location inputs (State/UT, District, City, PIN Code) and a table of "Declared Disasters" displaying this location data.
  - **Campaign Approval:** Interface to review and either approve or reject campaign proposals submitted by NGOs.
  - **Allocations & Multisig Approval:** Interface to sign multisignature transactions, authorizing the release of funds to Suppliers for resource procurement.

### 7.3. NGO Dashboard (`/dashboard/ngo`)
- **Access:** `NGO_ADMIN`, `NGO_OPERATOR`
- **Purpose:** Campaign creation and resource procurement.
- **Key Features:**
  - **Campaign Management:** Form to propose new fundraising campaigns linked to specific active disasters.
  - **Allocation Requests:** Interface to request funds from an approved campaign's pool to purchase specific resources (e.g., "Medical Kits", "Food Rations") from a Supplier.

### 7.4. Donor Dashboard (`/dashboard/donor`)
- **Access:** `DONOR`
- **Purpose:** Financial contribution and impact tracking.
- **Key Features:**
  - **Donation Interface:** View government-approved campaigns and make direct financial contributions using Web2 gateways (Razorpay processing INR).
  - **Donation History:** Verifiable ledger of the donor's past contributions.

### 7.5. Supplier Dashboard (`/dashboard/supplier`)
- **Access:** `SUPPLIER`
- **Purpose:** Resource provenance and dispatch.
- **Key Features:**
  - **Fulfillment Pipeline:** View approved allocations assigned to them by NGOs.
  - **Resource Registration:** Form to fulfill an allocation by minting a "Resource Batch". This establishes the origin of the goods on the blockchain and dispatches them to a Warehouse.

### 7.6. Warehouse Dashboard (`/dashboard/warehouse`)
- **Access:** `WAREHOUSE_OPERATOR`
- **Purpose:** Logistics and inventory management.
- **Key Features:**
  - **Incoming Shipments:** Interface to receive in-transit resource batches from Suppliers.
  - **Active Inventory:** Real-time ledger of physical resources stored at the warehouse, ready for field deployment by Relief Officers.

### 7.7. Relief Officer Dashboard (`/dashboard/officer`)
- **Access:** `RELIEF_OFFICER`
- **Purpose:** Field operations and cryptographic evidence capture.
- **Key Features:**
  - **Distribution Logging:** Form to record the final distribution of inventory to end beneficiaries.
  - **Evidence Generation:** The system takes the distribution data, simulates a media upload, generates an SHA-256 hash, and creates a local IPFS Content Identifier (CID). This CID is immediately broadcasted to the blockchain, linking the physical distribution to an immutable on-chain record.

### 7.8. Auditor Dashboard (`/dashboard/auditor`)
- **Access:** `AUDITOR`
- **Purpose:** Fraud detection and data integrity verification.
- **Key Features:**
  - **AI Anomaly Alerts:** A feed of potential risks flagged by the FastAPI Python service (e.g., "High donation volume from a single IP", "Resource allocation mismatch"). The Auditor reviews these manually.
  - **Cryptographic Audit Logs:** Displays the real-time reconciliation between off-chain PostgreSQL data and on-chain Ethereum events, ensuring the indexer has perfectly matched the distribution CIDs.
