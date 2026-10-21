import { PrismaClient, Prisma } from '@prisma/client';
import { ResourceBatchStatus } from '@reliefchain/shared-types';
import { uuidToBytes32 } from '../../utils/web3-format';
import { ethers } from 'ethers';
import { createAuditLog } from '../../services/audit.service';
import { canonicalizeQuantity } from '../../utils/number-format';

const prisma = new PrismaClient();

export class ResourceService {
  static async createDraft(allocationId: string, actorId: string, orgId: string, name: string, totalQuantity: string | number, unit: string) {
    const canonicalQuantity = canonicalizeQuantity(totalQuantity);
    
    const allocation = await prisma.allocation.findUnique({
      where: { id: allocationId },
      include: { campaign: true }
    });
    
    if (!allocation) {
      throw new Error('Allocation not found');
    }

    const batch = await prisma.resourceBatch.create({
      data: {
        allocationId,
        supplierId: orgId,
        name,
        totalQuantity: parseFloat(canonicalQuantity), // prisma float
        unit,
        status: ResourceBatchStatus.DRAFT
      }
    });

    const batchId = uuidToBytes32(batch.id);
    const campaignId = uuidToBytes32(allocation.campaignId);
    
    const metadataString = JSON.stringify({ name, totalQuantity: canonicalQuantity, unit });
    const metadataHash = ethers.id(metadataString);


    await createAuditLog({
      actorId,
      action: 'CREATE_DRAFT',
      entityType: 'ResourceBatch',
      entityId: batch.id,
      status: 'Success',
      metadata: { previousStatus: null, newStatus: ResourceBatchStatus.DRAFT, orgId }
    });


    return {
      batch,
      blockchainPayload: {
        batchId,
        campaignId,
        metadataHash,
      }
    };
  }

  static async transit(id: string, actorId: string, orgId: string, role: string) {
    const batch = await prisma.resourceBatch.findUnique({ 
      where: { id },
      include: { allocation: true }
    });
    if (!batch) throw new Error('Batch not found');

    if (batch.status === ResourceBatchStatus.REGISTERED) {
      if (batch.supplierId !== orgId) {
        throw new Error('Not authorized: Supplier organization mismatch');
      }
    } else if (batch.status === ResourceBatchStatus.RECEIVED_WAREHOUSE) {
      if (role !== 'WAREHOUSE_OPERATOR') {
        throw new Error('Not authorized: Only Warehouse Operator can transit from warehouse');
      }
    } else {
      throw new Error('Invalid state transition to IN_TRANSIT');
    }

    const updated = await prisma.resourceBatch.update({
      where: { id },
      data: { status: ResourceBatchStatus.IN_TRANSIT }
    });

    await createAuditLog({
      actorId,
      action: 'TRANSIT_BATCH',
      entityType: 'ResourceBatch',
      entityId: batch.id,
      status: 'Success',
      metadata: { previousStatus: batch.status, newStatus: ResourceBatchStatus.IN_TRANSIT, orgId }
    });

    return updated;
  }

  static async receiveWarehouse(id: string, actorId: string, orgId: string) {
    return await prisma.$transaction(async (tx) => {
      const batch = await tx.resourceBatch.findUnique({ 
        where: { id },
        include: { allocation: true }
      });
      if (!batch) throw new Error('Batch not found');

      if (batch.status !== ResourceBatchStatus.IN_TRANSIT) {
        throw new Error('Invalid state transition to RECEIVED_WAREHOUSE');
      }

      const updated = await tx.resourceBatch.update({
        where: { id },
        data: { status: ResourceBatchStatus.RECEIVED_WAREHOUSE }
      });

      // Initialize Inventory
      let inventory = await tx.inventory.findFirst({
        where: { batchId: batch.id, locationId: orgId }
      });

      if (!inventory) {
        const initialQty = new Prisma.Decimal(batch.totalQuantity.toString());

        inventory = await tx.inventory.create({
          data: {
            batchId: batch.id,
            locationId: orgId,
            currentQuantity: initialQty,
          }
        });

        await tx.inventoryMovement.create({
          data: {
            batchId: batch.id,
            toLocation: orgId,
            quantity: initialQty,
            movementType: 'RECEIPT',
            actorId: actorId
          }
        });
      }

      await createAuditLog({
        actorId,
        action: 'RECEIVE_WAREHOUSE',
        entityType: 'ResourceBatch',
        entityId: batch.id,
        status: 'Success',
        metadata: { previousStatus: batch.status, newStatus: ResourceBatchStatus.RECEIVED_WAREHOUSE, orgId }
      });

      return updated;
    });
  }

  static async receiveReliefCenter(id: string, actorId: string, orgId: string) {
    const batch = await prisma.resourceBatch.findUnique({ 
      where: { id },
      include: { allocation: true }
    });
    if (!batch) throw new Error('Batch not found');

    if (batch.status !== ResourceBatchStatus.IN_TRANSIT) {
      throw new Error('Invalid state transition to RECEIVED_RELIEF_CENTER');
    }

    // Ensure the relief officer belongs to the requesting NGO
    if (batch.allocation.requesterId !== orgId) {
       throw new Error('Not authorized: NGO organization mismatch');
    }

    const updated = await prisma.resourceBatch.update({
      where: { id },
      data: { status: ResourceBatchStatus.RECEIVED_RELIEF_CENTER }
    });

    await createAuditLog({
      actorId,
      action: 'RECEIVE_RELIEF_CENTER',
      entityType: 'ResourceBatch',
      entityId: batch.id,
      status: 'Success',
      metadata: { previousStatus: batch.status, newStatus: ResourceBatchStatus.RECEIVED_RELIEF_CENTER, orgId }
    });

    return updated;
  }

  static async getOne(id: string) {
    return prisma.resourceBatch.findUnique({ 
      where: { id },
      include: {
        supplier: true,
        allocation: {
          include: {
            requester: true
          }
        }
      }
    });
  }

  static async getSupplierBatches(supplierId: string) {
    return prisma.resourceBatch.findMany({
      where: { supplierId },
      include: {
        allocation: {
          include: {
            requester: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getWarehouseBatches(warehouseId: string) {
    // Return all batches for the demo warehouse
    return prisma.resourceBatch.findMany({
      include: {
        supplier: true,
        Inventories: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
