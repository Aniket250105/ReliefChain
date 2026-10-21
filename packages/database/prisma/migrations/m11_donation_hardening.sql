-- Migration: m11_donation_hardening
-- Purpose: Donation reliability and currency safety hardening
-- Safe to re-run: All operations are idempotent (IF NOT EXISTS, WHERE clauses)

-- Phase 4: Migrate Donation.amount from DOUBLE PRECISION (Float) to NUMERIC (Decimal)
-- NUMERIC preserves exact decimal representation; no data loss from widening.
ALTER TABLE "Donation" ALTER COLUMN "amount" TYPE NUMERIC USING amount::NUMERIC;

-- Phase 5: Add currency field to identify the monetary unit of each donation
-- Default 'INR' covers all existing Web2 donations.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Donation' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "Donation" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'INR';
  END IF;
END $$;

-- Phase 6a: Normalize historical status strings to canonical 'CONFIRMED'
-- Only updates 'Confirmed' (mixed-case variant); other statuses are preserved.
UPDATE "Donation" SET "status" = 'CONFIRMED' WHERE "status" = 'Confirmed';

-- Phase 6b: Backfill Web2 donations with sentinel values for compound unique constraint
-- Web2 donations use blockchainChainId=0, blockchainLogIndex=0 so the existing
-- @@unique([blockchainChainId, blockchainTxHash, blockchainLogIndex]) constraint
-- enforces payment ID uniqueness at the database level.
-- Only updates rows where both fields are NULL and a payment reference exists.
UPDATE "Donation"
SET "blockchainChainId" = 0, "blockchainLogIndex" = 0
WHERE "blockchainChainId" IS NULL
  AND "blockchainLogIndex" IS NULL
  AND "blockchainTxHash" IS NOT NULL;

-- Phase 5b: Set currency for existing Web3 donations (chainId > 0)
UPDATE "Donation"
SET "currency" = 'ETH:' || "blockchainChainId"::TEXT
WHERE "blockchainChainId" IS NOT NULL
  AND "blockchainChainId" > 0
  AND "currency" = 'INR';
