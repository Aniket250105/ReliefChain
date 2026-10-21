# ReliefChain Final Presentation Outline

### Slide 1 — Title
**ReliefChain: Decentralized Disaster Relief Platform**
* Problem Domain: Disaster Relief Logistics & Accountability
* Presenter: [Your Name]
* Technology Context: Hybrid Web2/Web3 Platform (Node.js, PostgreSQL, Hardhat EVM)

### Slide 2 — Problem Statement
Disaster relief coordination suffers from fragmented coordination across multiple NGOs and governments. There is limited transparency regarding how funds are spent, making resource and fund traceability difficult. Verifying distribution evidence is largely manual, reducing auditability and public trust.

### Slide 3 — Objectives
- Ensure transparent relief fund flow from donation to distribution.
- Maintain strict resource provenance and inventory accountability.
- Provide blockchain-backed verification for critical actions.
- Guarantee evidence integrity via cryptographic hashing.
- Employ AI-assisted anomaly detection for fraud prevention.
- Deliver granular donor impact attribution and public transparency.

### Slide 4 — Proposed Architecture
**Web2 Operational State:**
Users → Next.js Web App → Express API → PostgreSQL

**Web3 Verification Layer:**
Express/Web3 Service → EVM Smart Contracts → Blockchain Events → Indexer → PostgreSQL

**Evidence & AI Analytics:**
- Evidence → SHA-256 → IPFS/storage layer (Mocked locally)
- Operations → FastAPI Service → AI Alerts (Advisory Analytics)

*PostgreSQL maintains high-speed operational state, Blockchain anchors trust and verification, and AI provides advisory analytics.*

### Slide 5 — User Roles & RBAC
**Web2 Roles:**
- System Admin, Government/Disaster Authority, NGO, Donor, Auditor, Supplier, Warehouse/Logistics, Relief/Distribution Officer, Public Viewer.

**Blockchain Roles (AccessControl):**
- `DEFAULT_ADMIN_ROLE`, `AUTHORITY_ROLE`, `NGO_ROLE`, `SIGNER_ROLE`, `SYSTEM_INDEXER_ROLE`, `SUPPLIER_ROLE`.

*Web2 RBAC manages API access; Blockchain AccessControl governs smart contract execution.*

### Slide 6 — End-to-End Workflow
Disaster (Authority)
→ Campaign (NGO)
→ Donation (Donor)
→ Allocation (NGO)
→ Multisig (Authority)
→ Resource Batch (Supplier)
→ Inventory (Warehouse)
→ Distribution (Relief Officer)
→ Evidence (SHA-256)
→ Blockchain verification
→ Impact (Donor)
→ AI/Audit (Auditor)
→ Public transparency

### Slide 7 — Blockchain & Multisig
- **Why Blockchain?** To provide an immutable public ledger for financial flows and critical supply chain events.
- **Access Control:** Smart contracts explicitly whitelist actors (e.g., NGOs proposing allocations).
- **Multisig:** Allocations require a threshold of `SIGNER_ROLE` cryptographic approvals to release escrow funds.
- **Event Indexing:** Backend asynchronous loop reads EVM events and reconciles Postgres state using the canonical `chainId:txHash:logIndex` to prevent duplicate processing.

### Slide 8 — Evidence, QR & Provenance
- **Flow:** Binary file → SHA-256 hash → Mock IPFS CID → DB Evidence record → Blockchain anchor.
- **Provenance:** Origin → Current Location → Resource Batch → Distribution history.
- *(Note: IPFS is mocked locally in this MVP).*

### Slide 9 — AI & Proof-of-Impact
**AI Advisory Layer:**
- Uses Scikit-Learn **Isolation Forest** for multivariate anomaly detection.
- Provides risk scores and reason codes to Auditors for human review.
- Strictly non-blocking and advisory; does not automatically revert transactions.

**Proof-of-Impact:**
- Proportional pooled attribution tracking: Donation → Allocation → Resource → Distribution.
- Connects specific donor fractions to real-world outcomes.

### Slide 10 — Security & Reliability
- **Auth:** JWT authentication, bcrypt password hashing.
- **RBAC:** Strict Web2 role middleware and EVM AccessControl.
- **Idempotency:** `Idempotency-Key` prevents duplicate operations across network drops.
- **Database:** Parameterized Prisma queries prevent SQL injection; inventory constraints manage concurrency.
- **Audit:** Append-only chronological audit logging.

### Slide 11 — Testing & Limitations
**Actually Executed:** Hardhat tests (24/24), Solidity branch coverage.
**Mocked:** Jest API/service tests (Prisma dependencies mocked).
**Static:** TypeScript compilation, Prisma schema, source-level security review.
**Not Executed:** Live PostgreSQL integration, complete live E2E, API load testing.

**Known Deviations:**
- M12: Global idempotency middleware absent; retention differs from 24h; `registerBatch` lacks on-chain quantity ceilings.
- M13: Impact and public dashboard use dynamic calculation, not pre-aggregated cache.
- M14: Process-local async AI trigger instead of a durable external queue.
- M15: Mock email provider; Authority-based signer audience matching M8 architecture.

### Slide 12 — Results & Conclusion
- **Summary:** Delivered a unified, blockchain-backed disaster relief workflow ensuring resource traceability, AI anomaly detection, and public transparency.
- **Status:** **RELIEFCHAIN — RELEASE CANDIDATE / SUBMISSION READY**
