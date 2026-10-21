# ReliefChain Presentation Script (Speaker Notes)

### Slide 1 — Title (30s)
"Hello everyone, I'm here to present ReliefChain, a decentralized disaster relief platform. We built this to tackle the major logistical and accountability challenges that arise during large-scale emergency responses, using a hybrid approach combining Web2 technologies like Node and Postgres with a Web3 Hardhat EVM layer."

### Slide 2 — Problem Statement (45s)
"When a disaster strikes, relief coordination is often highly fragmented. NGOs and governments struggle to maintain transparency regarding how funds are spent. Resource traceability is difficult, and verifying distribution evidence is largely manual, which severely reduces public trust and auditability. ReliefChain is designed to solve this accountability problem."

### Slide 3 — Objectives (40s)
"Our objectives were to guarantee transparent relief fund flows and strict resource provenance. We wanted to ensure inventory accountability with blockchain-backed verification. Furthermore, we integrated cryptographic evidence integrity, AI-assisted anomaly detection to flag suspicious behavior, and implemented granular donor impact attribution to drive public transparency."

### Slide 4 — Proposed Architecture (60s)
"To achieve this, we split the architecture. PostgreSQL serves as our high-speed operational state, handling complex queries via our Express API and Next.js frontend. The Blockchain serves strictly as our trust and verification layer; smart contracts anchor critical financial transactions, and an asynchronous indexer reconciles EVM events back to Postgres. Finally, we use a separate Python FastAPI service for advisory AI analytics, and we hash evidence using SHA-256 before storing it on a mock IPFS layer."

### Slide 5 — User Roles & RBAC (45s)
"We deliberately separated Web2 operational roles from Web3 blockchain roles. Web2 RBAC manages API boundaries—for example, separating Donors, Auditors, and Logistics Officers. On-chain, we use OpenZeppelin AccessControl to define roles like `AUTHORITY_ROLE` or `SYSTEM_INDEXER_ROLE`. This ensures that even if a Web2 actor is compromised, they cannot arbitrarily execute unauthorized smart contract functions."

### Slide 6 — End-to-End Workflow (50s)
"This is our core story. An Authority creates a Disaster. An NGO launches a Campaign, which the Authority approves. Donors contribute funds. The NGO proposes an Allocation, which requires Authority Multisig approval. Suppliers then register Resource Batches, which move into Warehouse Inventory. Finally, Relief Officers distribute the goods, upload evidence, and the transaction is anchored on-chain. This chain feeds our Donor Impact dashboard and AI Auditor alerts."

### Slide 7 — Blockchain & Multisig (50s)
"We use the blockchain to anchor trust. For example, when an NGO proposes an allocation, the funds are locked in Escrow. They cannot move until a threshold of `SIGNER_ROLE` approvals are met via our Multisig contract. Once executed, our backend indexer listens for the event, using a canonical identifier composed of `chainId`, `transactionHash`, and `logIndex` to securely and uniquely reconcile the database state."

### Slide 8 — Evidence, QR & Provenance (45s)
"When relief is distributed, officers upload binary evidence (like photos). The API computes a SHA-256 hash natively, which is stored in the database alongside a mock IPFS CID. This allows anyone scanning a resource's QR code to trace its provenance from the Supplier all the way to the final Distribution, with cryptographically verifiable evidence. Note that IPFS is mocked locally in this MVP."

### Slide 9 — AI & Proof-of-Impact (60s)
"For analytics, we deployed an Isolation Forest machine learning model. It identifies multidimensional anomalies in distribution data. Importantly, AI is purely advisory—it generates alerts for human Auditors but never automatically blocks a distribution, ensuring relief isn't halted by false positives. Meanwhile, our Proof-of-Impact engine uses proportional pooled attribution to show Donors exactly which fraction of their funds purchased specific distributed resources."

### Slide 10 — Security & Reliability (45s)
"Security was a priority. We use parameterized Prisma queries to prevent SQL injection and bcrypt for passwords. To handle network unreliability, we implemented `Idempotency-Key` headers on state-changing requests, allowing safe retries without double-spending. We also maintain a strict, append-only chronological audit log of all critical operations."

### Slide 11 — Testing & Limitations (60s)
"We are transparent about our validation scope. Hardhat tests and Solidity branch coverage were actually executed natively. Our 218 API tests were executed, but against a mocked Prisma database. Due to local infrastructure limitations, live PostgreSQL-backed E2E execution was not performed. We also carry documented deviations, such as dynamic impact calculation rather than database caching, a process-local AI trigger rather than an external queue, and a mocked email provider."

### Slide 12 — Results & Conclusion (30s)
"In conclusion, ReliefChain successfully unifies disaster relief workflows with blockchain-backed verification, robust evidence traceability, and advisory AI analytics. The platform is feature-complete for its defined scope. ReliefChain is officially a Release Candidate and ready for submission."
