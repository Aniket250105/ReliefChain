# ReliefChain Viva Q&A Guide

This guide prepares developers for the final evaluator Viva, including standard technical questions and difficult adversarial questions.

## General
**Q: What problem does ReliefChain solve?**
A: It solves the lack of accountability, fragmented coordination, and poor resource traceability in disaster relief by providing a transparent, cryptographically verifiable supply chain and fund management system.

**Q: Why did you choose this topic?**
A: Because billions are lost globally to relief fraud and mismanagement; applying blockchain and AI directly addresses the trust deficit between donors, NGOs, and governments.

**Q: What are the main contributions?**
A: A hybrid architecture combining high-speed relational operational state (Postgres) with immutable trust anchoring (EVM), AI-assisted fraud detection, and a granular Proof-of-Impact attribution model.

## Architecture
**Q: Why PostgreSQL and blockchain together?**
A: Postgres provides high-speed relational queries required for complex UX and analytics (like Proof-of-Impact). Blockchain provides an immutable, decentralized ledger for critical financial state and evidence verification.

**Q: Why not put everything on blockchain?**
A: Storing PII, heavy evidence files, and high-frequency relational data on-chain is too expensive, slow, and violates privacy standards.

**Q: Why Next.js?**
A: For fast SSR, robust React ecosystem, and seamless Web3 (ethers.js) integration on the client side.

**Q: Why Express & Prisma?**
A: Express provides lightweight API routing, while Prisma ensures type-safe, parameterized database access to prevent SQL injection.

## Blockchain
**Q: What is an EVM?**
A: The Ethereum Virtual Machine—a decentralized, Turing-complete execution environment where our smart contracts run.

**Q: Why Solidity?**
A: It is the industry standard language for EVM smart contracts, offering the most robust tooling (like Hardhat and Slither) and security patterns (OpenZeppelin).

**Q: What is AccessControl?**
A: An OpenZeppelin security pattern that allows us to grant and revoke specific roles (like `AUTHORITY_ROLE` or `NGO_ROLE`) to specific wallet addresses on-chain.

**Q: What is multisig?**
A: A smart contract mechanism requiring multiple authorized cryptographic signatures (e.g., 2-of-3 `SIGNER_ROLE`s) to execute a transaction, preventing unilateral theft.

**Q: Why is an indexer required?**
A: To asynchronously bridge the Web3 state to the Web2 state, listening for EVM events and updating Postgres without blocking the user interface.

**Q: Why use `chainId:txHash:logIndex`?**
A: It creates a globally unique canonical event identity. A transaction hash alone is insufficient because a single multicall transaction can emit multiple distinct logs.

**Q: What happens if a blockchain transaction fails?**
A: The Postgres record remains in an `EXECUTING` state. The indexer will not receive a success event, allowing the system to flag it for manual/automated retry without duplicating inventory deductions.

## Database
**Q: Why PostgreSQL?**
A: Because it supports strict ACID compliance, complex relational joins (necessary for tracking donation-to-distribution lineage), and robust indexing.

**Q: How do you maintain inventory consistency?**
A: Through transactional locking and strict non-negative constraints at the database level when recording `InventoryMovement`.

**Q: How do you avoid duplicate requests?**
A: Using `Idempotency-Key` HTTP headers mapped to a unique constraint (`P2002`) in Postgres. The database inherently rejects the second concurrent insert.

**Q: Why use transactions/locking?**
A: To ensure that partial updates (e.g., decrementing inventory but failing to create the distribution record) do not corrupt the operational state.

## Security
**Q: How does JWT work?**
A: It encodes user identity and RBAC roles in a cryptographically signed token, allowing stateless authentication across the API.

**Q: How is password security handled?**
A: Using `bcrypt` to salt and hash passwords before storage, making rainbow-table attacks computationally infeasible.

**Q: How does RBAC work?**
A: An Express middleware intercepts requests, decodes the JWT, and verifies the user's `Web2Role` against the endpoint's allowed roles, returning 403 if unauthorized.

**Q: How is SQL injection addressed?**
A: By using Prisma ORM, which inherently uses parameterized queries, escaping all user input before it reaches the database engine.

**Q: How are blockchain transactions verified?**
A: The backend explicitly queries the RPC provider using the submitted transaction hash to verify the sender, destination contract, and emitted events before confirming the database state.

## AI
**Q: Why Isolation Forest?**
A: It is highly effective at identifying anomalies in unsupervised, multidimensional data (like unusual ratios of goods to beneficiaries) without needing a massive labeled training dataset.

**Q: What is an anomaly score?**
A: A statistical representation of how "isolated" a data point is from normal operational patterns.

**Q: What features can be used?**
A: Quantity, beneficiary count, geographic variance, and frequency of distribution.

**Q: Does AI determine fraud?**
A: No. It strictly identifies statistical anomalies.

**Q: What happens if AI becomes unavailable?**
A: The API uses a 2-second `AbortController` timeout. If the AI service fails, the transaction still commits successfully. AI is purely advisory.

## Impact
**Q: How does donor impact attribution work?**
A: It queries the chain of relational tables: Donation -> Campaign -> Allocation -> ResourceBatch -> Distribution.

**Q: Why proportional attribution?**
A: If a donor funds 10% of a campaign, it is mathematically fair and transparent to attribute exactly 10% of that campaign's physical distributions to them.

**Q: What is the Donation → Allocation → Resource → Distribution relationship?**
A: It is the complete financial-to-physical lifecycle of a relief effort.

## Difficult / Evaluator Questions
**Q: Why was live E2E not executed in your final report?**
A: We prioritize technical honesty. Our ephemeral validation environment lacked a running Docker daemon, preventing the initialization of PostgreSQL. We successfully executed all mocked tests and Hardhat EVM tests, but we will not falsely claim live E2E verification without the infrastructure to prove it.

**Q: What happens if PostgreSQL goes down?**
A: The API will fail health checks and reject incoming requests (503). The blockchain state remains secure, but the Web2 UX is temporarily halted.

**Q: Can an AI alert block a distribution?**
A: Absolutely not. The SRS explicitly mandates that AI is advisory. Blocking distributions via AI would risk halting life-saving relief due to a false positive.

**Q: Can a supplier manipulate provenance?**
A: Once a batch is registered on-chain, its genesis is immutable. They cannot backdate or alter the anchored origin.

**Q: Can an unauthorized user call a protected API?**
A: No, the `requireRoles` middleware will reject the request with a 403 Forbidden before it reaches the controller logic.

**Q: Can the same request be submitted twice?**
A: Yes, but the `Idempotency-Key` ensures the database only processes it once, returning a 409 Conflict for the duplicate payload.

**Q: Why trust blockchain if operational data is off-chain?**
A: Because the *hashes* of the operational data and the financial state transitions are anchored on-chain. If the Postgres database is tampered with, the SHA-256 hashes will no longer match the blockchain records, immediately exposing the tampering.

**Q: What exactly proves that evidence was not modified?**
A: We compute the SHA-256 hash of the binary image at the moment of upload. If a pixel is altered later, the hash changes completely and no longer matches the on-chain CID.

**Q: What part of the system is truly decentralized?**
A: The EVM smart contracts, the financial escrow, and the cryptographic evidence anchors.

**Q: What is the biggest current limitation?**
A: IPFS and SMTP are mocked locally, and Proof-of-Impact is calculated dynamically on-read rather than using the pre-aggregated caching architecture specified in the SRS.

**Q: What would you improve in a production version?**
A: Implementing a durable external queue (like Redis/BullMQ) for AI triggers and Indexer retries, and deploying to a live Ethereum Layer-2 (like Arbitrum or Optimism) for low gas fees.
