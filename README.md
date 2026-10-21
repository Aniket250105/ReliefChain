# ReliefChain: Decentralized Disaster Relief Platform

ReliefChain is an end-to-end decentralized application for orchestrating disaster relief, connecting Government Authorities, NGOs, Donors, Suppliers, and Auditors through a transparent, immutable blockchain layer backed by an efficient Web2 stack.

---

## 1. Architecture Overview
- **Web App**: Next.js 14, React 18, Tailwind CSS, ethers.js
- **API**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL (via Prisma)
- **AI Service**: Python FastAPI, Scikit-Learn (Isolation Forest)
- **Blockchain**: Hardhat, Solidity ^0.8.24 (EVM)
- **Background/Queue**: Native Node `process.nextTick` (with optional Redis support)
- **Storage**: IPFS (Mocked via local file storage hashes)

---

## 2. SRS Traceability Matrix

| Requirement | Description | Status |
|---|---|---|
| **FR-DIS-001** | Disaster Management | IMPLEMENTED + MOCK VERIFIED |
| **FR-CAMP-001** | Campaign Management | IMPLEMENTED + MOCK VERIFIED |
| **FR-DON-001** | Donations | IMPLEMENTED + MOCK VERIFIED |
| **FR-BC-001** | Blockchain anchoring/indexing | IMPLEMENTED + STATIC VERIFIED |
| **FR-FUND-001** | Fund allocation | IMPLEMENTED + MOCK VERIFIED |
| **FR-MSIG-001** | Multisig approval | IMPLEMENTED + MOCK VERIFIED |
| **FR-RES-001** | Resource provenance | IMPLEMENTED + MOCK VERIFIED |
| **FR-INV-001** | Inventory | IMPLEMENTED + MOCK VERIFIED |
| **FR-QR-001** | QR verification | IMPLEMENTED + MOCK VERIFIED |
| **FR-DIST-001** | Distribution | IMPLEMENTED + MOCK VERIFIED |
| **FR-EVID-001** | Evidence (SHA-256 + IPFS CID) | IMPLEMENTED + MOCK VERIFIED |
| **FR-AUD-001** | Audit logs | IMPLEMENTED + MOCK VERIFIED |
| **FR-AI-001** | AI anomaly detection | IMPLEMENTED + STATIC VERIFIED |
| **FR-IMP-001** | Proof-of-Impact | DEVIATION (Dynamic, not cached) |
| **FR-REP-001** | Reports | IMPLEMENTED + MOCK VERIFIED |
| **FR-NOT-001** | Notifications | IMPLEMENTED + MOCK VERIFIED |
| **FR-PUB-001** | Public transparency dashboard | IMPLEMENTED + MOCK VERIFIED |

> **Note:** Live E2E execution against a physical PostgreSQL instance is *E2E UNVERIFIED* due to local infrastructure limitations preventing Docker/PostgreSQL execution.

---

## 3. Testing Report

The testing suite explicitly separates executed vs. static vs. unexecuted boundaries. These are never combined into a single passed test count.

### A. Actually Executed
- **Hardhat Tests**: 24/24 passed natively in memory.
- **Smart Contract Branch Coverage**: 98.73% Statements, 100% Functions, 99.07% Lines, 59.68% Branches (Missed branches are un-inverted `require()` statements).

### B. Mocked
- **Mocked API/Service Tests**: 218/218 mocked API/service tests executed with Prisma dependencies mocked.
- **Evidence/Storage**: Hashes calculated correctly locally, mocked as IPFS CIDs.

### C. Static
- **Compilation**: 100% TypeScript compilation across Monorepo.
- **Security Check**: Verified JWT separation, Role RBAC (`requireRoles`), SQL-injection safety checks and source-level security review, canonical event identities (`chainId:txHash:logIndex`), and Idempotency key headers (`PATCH/POST`).

### D. Not Executed (Infrastructure Blocked)
- **Live PostgreSQL Integration**: Database-dependent Jest tests fail because `localhost:5432` is unreachable.
- **Complete Live E2E (`full-workflow.test.ts`)**: Explicitly blocked by missing PostgreSQL/Docker infrastructure.
- **Live API Latency/Load Testing**: Cannot be empirically measured until a real database connection is established.
- **Slither**: Not installed natively on environment.

---

## 4. Known Accepted SRS Deviations

1. **M12 (Idempotency & Ceilings)**:
   - Global idempotency middleware deviation (handled at controller-level).
   - Idempotency retention deviation differs from the exact 24-hour SRS requirement.
   - `registerBatch` ABI/on-chain quantity-ceiling limitation prevents the specified on-chain batch quantity ceiling logic from being natively asserted.
2. **M13 (Impact & Transparency)**:
   - Dynamic Proof-of-Impact calculation instead of required pre-aggregation/cache.
   - Dynamic public dashboard aggregation.
3. **M14 (AI Trigger)**:
   - Process-local async AI trigger rather than durable external queue.
4. **M15 (Notifications)**:
   - Mock email provider.
   - Authority-based signer audience matching the M8 MVP architecture.
   - The notification architecture operates via a record created after the relevant database transaction/commit, an asynchronous delivery attempt using the mock provider, transitioning from `PENDING` to `SENT`/`FAILED` state, and concluding with a discrete audit record for the delivery attempt.

---

## 5. Local Startup Sequence & Demo Instructions

> **Prerequisite Limitation Note:** This assumes a valid Windows/Linux/Mac machine with Docker daemon running and Node 18+. Live PostgreSQL-backed E2E execution was not performed because PostgreSQL/Docker infrastructure was unavailable in the validation environment.

**1. Boot Core Infrastructure**
```bash
docker-compose up -d  # Boots PostgreSQL & Redis
```

**2. Deploy Local Contracts**
```bash
cd packages/contracts
npm install
npx hardhat node &
npx hardhat run scripts/deploy-local.ts --network localhost
```
*(This auto-writes `deployment.json` and updates `deployment.env` for API consumption).*

**3. Database Configuration**
Copy `.env.example` to `.env` (contains safe Hardhat defaults).
```bash
cd packages/database
npx prisma db push
npm run seed
```
*(Produces all 9 coherent deterministic demo actors, Active Disaster, Allocation, Resource Batch, Inventory, Evidence, AI Alert, and Audit Logs).*

**4. Start Microservices**
```bash
npm run dev --workspaces
cd apps/ai-service && uvicorn app.main:app --port 8000
```

---

## FINAL VERDICT

**M16 — CONDITIONALLY CLOSED — INFRASTRUCTURE LIMITED**

Live PostgreSQL-backed E2E execution was not performed because PostgreSQL/Docker infrastructure was unavailable in the validation environment.
