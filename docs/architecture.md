# ReliefChain Architecture Overview

ReliefChain implements a hybrid architecture combining the performance and query capabilities of Web2 with the transparent, tamper-evident verification of Web3.

## Architectural Layers

### 1. Application & Data Layer (Web2)
The operational core of the system.
- **`apps/web` (Next.js):** The frontend interfaces for all actors (Donors, NGOs, Authorities, Relief Officers, Public). Uses Next.js App Router for server-rendered React components.
- **`apps/api` (Node.js/Express):** The central backend application. Handles all REST requests, JWT verification, RBAC authorization, and off-chain data validation.
- **`packages/database` (Prisma/PostgreSQL):** The definitive source of truth for the system's operational state. High-volume data (like full inventory logs and user accounts) live exclusively here.

### 2. Trust Layer (Web3)
The tamper-evident verification tier.
- **`packages/contracts` (Hardhat/Solidity):** Modular smart contracts (`DisasterRegistry`, `CampaignRegistry`, `DonationContract`, `CampaignEscrow`, `AllocationMultisig`, `ResourceProvenance`).
- **Event Indexer & Relayer:** A crucial component of `apps/api` (or standalone worker) that bridges the two layers. 
  - **Relayer:** Submits blockchain transactions using the `SYSTEM_INDEXER_ROLE` on behalf of authenticated Web2 users (e.g. Relief Officers), subsidizing gas and protecting private keys.
  - **Indexer:** Subscribes to blockchain events (e.g. `DistributionRecorded`) and reconciles the PostgreSQL operational state with confirmed on-chain truth, recovering gracefully from node or webhook failures using a reliable queue.

### 3. AI / Analytics Layer
The intelligent monitoring tier.
- **`apps/ai-service` (FastAPI/scikit-learn):** An asynchronous Python service exposing a `/predict/anomaly` endpoint.
- **Anomaly Detection:** Utilizes a deterministic Rule Engine alongside an Isolation Forest ML model. It flags unusual transaction velocities, distributions, or inventory discrepancies for human auditor review. It does not automatically block transactions or prove fraud; it establishes an AI-assisted audit trail.

## Repository Separation
By isolating the database models (`packages/database`), typescript definitions (`packages/shared-types`), and smart contracts (`packages/contracts`) into shared packages, the Node.js API and Next.js frontend can import them safely without circular dependencies or duplicated code.
