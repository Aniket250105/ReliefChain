-- Check constraint: Inventory.currentQuantity must never be negative.
-- This enforces the SRS invariant `current_quantity >= 0` at the database level.
-- Applied after the Float→Decimal migration.
ALTER TABLE "Inventory" ADD CONSTRAINT "inventory_quantity_non_negative" CHECK ("currentQuantity" >= 0);
