# ReliefChain Live Demo Script (5-Minute Version)

This script provides exact narration and actions for the live evaluator demonstration. 
*Note: Do not depend on unverified live PostgreSQL behavior during this scripted explanation; narrate the expected flow based on the implemented logic.*

---

### 1. Authority → Disaster
**What I click:** Log in as `authority@gov.local`, navigate to Disasters, click "Create Disaster", then click "Verify".
**What the evaluator sees:** The Disaster state transitions from `PENDING_VERIFICATION` to `ACTIVE`.
**What I say:** "I am logging in as a Government Authority. I create a new disaster record, which initializes in a pending state. I then verify and activate it, making it eligible for NGO campaigns."
**Why this feature exists:** To prevent unverified or fraudulent disaster claims from accepting public funds.

### 2. NGO → Campaign
**What I click:** Log in as `ngoadmin@hoperelief.local`, create a Campaign under the Disaster. (Switch back to Authority) click "Approve Campaign".
**What the evaluator sees:** Campaign transitions to `ACTIVE`.
**What I say:** "The NGO creates a Campaign requesting funds for this specific disaster. The Authority reviews and approves it. This two-step verification guarantees oversight."
**Why this feature exists:** To ensure only authorized relief organizations can solicit funds for recognized disasters.

### 3. Donor → Donation
**What I click:** Log in as `donor@example.local`, submit a Web3 donation via the UI.
**What the evaluator sees:** A Donation record appears, displaying a transaction hash and transitioning to `CONFIRMED`.
**What I say:** "As a Donor, I submit a contribution. The smart contract emits a `DonationReceived` event. Our backend indexer catches this event and updates the operational database to Confirmed."
**Why this feature exists:** To provide immutable proof of funds entering the system.

### 4. NGO → Allocation / Multisig
**What I click:** As NGO, propose a 5000-unit Allocation. Log in as Authority, click "Sign Multisig".
**What the evaluator sees:** Allocation enters `PENDING_MULTISIG`, then `EXECUTING` once signed.
**What I say:** "The NGO proposes an allocation of funds to buy resources. Because of our strict access control, they cannot withdraw funds directly. The Authority must cryptographically sign the transaction to reach the multisig threshold and unlock the Escrow."
**Why this feature exists:** To prevent embezzlement or unilateral spending by any single party.

### 5. Supplier → Resource & Inventory
**What I click:** Log in as `supplier@medlogistics.local`, register a Resource Batch.
**What the evaluator sees:** A new Resource Batch is created with an origin timestamp, and Warehouse Inventory initializes.
**What I say:** "The Supplier registers a batch of medical kits. This action establishes the genesis of our resource provenance, initializing the inventory at the relief warehouse."
**Why this feature exists:** To trace physical goods from the manufacturer to the distribution point.

### 6. Relief Officer → Distribution & Evidence
**What I click:** Log in as `reliefofficer@hoperelief.local`, select the batch, input quantity/beneficiaries, and upload a test photo.
**What the evaluator sees:** Form submits; the UI displays a generated SHA-256 hash, mock IPFS CID, and a blockchain transaction reference.
**What I say:** "During field distribution, the Relief Officer uploads photo evidence. Our API natively computes the SHA-256 hash of this binary file and maps it to an IPFS CID, anchoring the proof of delivery on-chain."
**Why this feature exists:** To cryptographically secure field evidence against subsequent tampering.

### 7. Donor → Proof-of-Impact
**What I click:** Log back in as Donor, navigate to "My Impact".
**What the evaluator sees:** A visual breakdown attributing fractional units of the distributed batch back to the original donation.
**What I say:** "The Donor can now see exactly where their money went. Using proportional pooled attribution, we calculate that their specific donation funded this exact distribution event."
**Why this feature exists:** To maximize public trust and donor retention through radical transparency.

### 8. Auditor → AI & Audit
**What I click:** Log in as `auditor@trustaudit.local`, navigate to AI Alerts.
**What the evaluator sees:** An alert dashboard showing Anomaly Scores, Reason Codes, and a chronological Audit Log.
**What I say:** "The Auditor reviews AI-generated alerts. Our Isolation Forest model flagged a transaction due to an unusual beneficiary-to-quantity ratio. Note that the AI is advisory—it did not block the distribution, it merely flagged it for human review."
**Why this feature exists:** To automate fraud detection at scale without halting critical emergency logistics.

### 9. Public Dashboard
**What I click:** Log out. Open the Public Dashboard URL.
**What the evaluator sees:** Aggregated statistics, verified campaigns, and QR provenance lookups. No user emails or passwords visible.
**What I say:** "Finally, the unauthenticated public dashboard provides global transparency. It aggregates impact metrics and allows QR provenance verification, carefully masking all PII and system secrets."
**Why this feature exists:** To provide accountability to the general public and external watchdogs.
