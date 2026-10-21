import { PrismaClient, Prisma } from '@prisma/client';
import { createAuditLog } from '../../services/audit.service';
import { ResourceBatchStatus } from '@reliefchain/shared-types';

const prisma = new PrismaClient();

export const ValidMovementTypes = [
  'ADJUSTMENT_DAMAGED',
  'ADJUSTMENT_EXPIRED',
  'ADJUSTMENT_MISSING',
  'ADJUSTMENT_CORRECTION',
  'ADJUSTMENT_DISCREPANCY'
];

/**
 * Validates and converts a quantity string to a Prisma Decimal.
 * 
 * Accepted format: optional leading minus, digits, optional decimal point with digits.
 * Rejects: NaN, Infinity, exponents, empty, non-numeric.
 * Maximum precision: limited by PostgreSQL numeric type (up to 131072 digits).
 */
function toDecimal(value: string | number): Prisma.Decimal {
  const str = String(value).trim();

  // Reject exponent notation, infinity, NaN, empty
  if (!/^-?\d+(\.\d+)?$/.test(str)) {
    throw new Error('Adjustment quantity must be a valid decimal number.');
  }

  return new Prisma.Decimal(str);
}

export class InventoryService {
  /**
   * Adjusts inventory for a given batch at the caller's warehouse location.
   *
   * @param batchId       - ResourceBatch UUID
   * @param quantityDelta - string or number; positive = increase, negative = decrease
   * @param reason        - must be one of ValidMovementTypes
   * @param actorId       - derived from JWT
   * @param orgId         - derived from JWT (req.user.organizationId)
   */
  static async adjust(batchId: string, quantityDelta: string | number, reason: string, actorId: string, orgId: string) {
    if (!ValidMovementTypes.includes(reason)) {
      throw new Error(`Invalid adjustment reason. Must be one of: ${ValidMovementTypes.join(', ')}`);
    }

    const delta = toDecimal(quantityDelta);

    if (delta.isZero()) {
      throw new Error('Adjustment quantity cannot be zero.');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Retrieve inventory row for this batch + location
      const inventory = await tx.inventory.findFirst({
        where: { batchId, locationId: orgId },
        include: { batch: true }
      });

      if (!inventory) {
        throw new Error('Inventory record not found for this batch and location.');
      }

      // 2. Verify physical presence
      if (inventory.batch.status !== ResourceBatchStatus.RECEIVED_WAREHOUSE) {
        throw new Error('Batch is not physically present at the warehouse.');
      }

      // 3. Compute new quantity using exact Decimal arithmetic
      const currentQty = new Prisma.Decimal(inventory.currentQuantity.toString());
      const newQuantity = currentQty.add(delta);

      if (newQuantity.isNegative()) {
        throw new Error(`Insufficient stock. Cannot reduce inventory below zero (Current: ${currentQty.toString()}).`);
      }

      // 4. Atomic update — set to the exact computed value
      const updatedInventory = await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          currentQuantity: newQuantity
        }
      });

      // 5. Create InventoryMovement ledger entry
      await tx.inventoryMovement.create({
        data: {
          batchId: inventory.batchId,
          toLocation: orgId,
          quantity: delta,
          movementType: reason,
          actorId: actorId
        }
      });

      // 6. Create AuditLog
      await createAuditLog({
        actorId,
        action: 'INVENTORY_ADJUST',
        entityType: 'Inventory',
        entityId: inventory.id,
        status: 'Success',
        metadata: {
          quantityDelta: delta.toString(),
          reason,
          previousQuantity: currentQty.toString(),
          newQuantity: newQuantity.toString()
        }
      });

      return updatedInventory;
    });
  }

  static async list(orgId: string) {
    return prisma.inventory.findMany({
      where: { locationId: orgId },
      include: {
        batch: {
          include: {
            supplier: true
          }
        }
      },
      orderBy: { lastUpdated: 'desc' }
    });
  }
}
