import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Verification evidence levels for a ResourceBatch.
 * - VERIFIED: Blockchain registration event exists and matches the batch.
 * - PARTIAL: Batch exists in DB but blockchain evidence is incomplete or absent.
 * - NOT_FOUND: Batch does not exist.
 */
export type VerificationLevel = 'VERIFIED' | 'PARTIAL' | 'NOT_FOUND';

/**
 * Human-readable location label derived from ResourceBatch status.
 */
function deriveCurrentLocation(status: string, supplierName: string, warehouseName?: string, reliefCenterName?: string): string {
  switch (status) {
    case 'DRAFT': return 'Supplier (Draft)';
    case 'REGISTERED': return `Supplier — ${supplierName}`;
    case 'IN_TRANSIT': return 'In Transit';
    case 'RECEIVED_WAREHOUSE': return warehouseName ? `Warehouse — ${warehouseName}` : 'Warehouse';
    case 'RECEIVED_RELIEF_CENTER': return reliefCenterName ? `Relief Center — ${reliefCenterName}` : 'Relief Center';
    default: return 'Unknown';
  }
}

export interface TimelineEvent {
  timestamp: string;
  event: string;
  location?: string;
  blockchainTxHash?: string;
  blockNumber?: number;
  chainId?: number;
}

export interface QRVerificationResponse {
  verification: VerificationLevel;
  batch: {
    id: string;
    name: string;
    unit: string;
    totalQuantity: number;
    status: string;
    currentLocation: string;
    registeredAt: string;
    updatedAt: string;
  };
  blockchain: {
    registrationTxHash: string | null;
    chainId: number | null;
    blockNumber: number | null;
    explorerUrl: string | null;
  };
  timeline: TimelineEvent[];
}

export class QRVerificationService {
  /**
   * Validates that a string is a properly formatted UUID v4.
   */
  static isValidUUID(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  /**
   * Read-only provenance verification for a ResourceBatch.
   * Returns a sanitized public response with no private data.
   */
  static async verify(batchId: string): Promise<QRVerificationResponse | null> {
    if (!this.isValidUUID(batchId)) {
      return null;
    }

    const batch = await prisma.resourceBatch.findUnique({
      where: { id: batchId },
      include: {
        supplier: { select: { id: true, name: true } },
        allocation: {
          select: {
            requester: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!batch) {
      return null;
    }

    // Derive current location from status and organization names
    const warehouseInventory = await prisma.inventory.findFirst({
      where: { batchId: batch.id },
      include: { location: { select: { name: true } } }
    });

    const currentLocation = deriveCurrentLocation(
      batch.status,
      batch.supplier.name,
      warehouseInventory?.location?.name,
      batch.allocation.requester.name
    );

    // Build timeline from AuditLog (chronological, deterministic)
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: 'ResourceBatch', entityId: batch.id },
      orderBy: { createdAt: 'asc' }
    });

    // Get blockchain event for registration (if exists)
    let blockchainEvent = null;
    if (batch.blockchainTxHash) {
      blockchainEvent = await prisma.blockchainEvent.findFirst({
        where: {
          transactionHash: batch.blockchainTxHash,
          eventName: 'ResourceRegistered',
          status: 'PROCESSED'
        },
        orderBy: [{ blockNumber: 'asc' }, { logIndex: 'asc' }]
      });
    }

    // Build timeline events
    const timeline: TimelineEvent[] = [];

    // Registration event
    if (batch.blockchainTxHash) {
      timeline.push({
        timestamp: batch.createdAt.toISOString(),
        event: 'Registered on Blockchain',
        location: `Supplier — ${batch.supplier.name}`,
        blockchainTxHash: batch.blockchainTxHash,
        blockNumber: blockchainEvent?.blockNumber,
        chainId: blockchainEvent?.chainId
      });
    } else {
      timeline.push({
        timestamp: batch.createdAt.toISOString(),
        event: 'Draft Created',
        location: `Supplier — ${batch.supplier.name}`
      });
    }

    // Operational lifecycle events from AuditLog
    for (const log of auditLogs) {
      const meta = log.metadata as Record<string, any> | null;
      if (!meta) continue;

      let eventLabel = '';
      let locationLabel = '';

      switch (log.action) {
        case 'TRANSIT_BATCH':
          eventLabel = 'Shipped — In Transit';
          locationLabel = 'In Transit';
          break;
        case 'RECEIVE_WAREHOUSE':
          eventLabel = 'Received at Warehouse';
          locationLabel = warehouseInventory?.location?.name
            ? `Warehouse — ${warehouseInventory.location.name}`
            : 'Warehouse';
          break;
        case 'RECEIVE_RELIEF_CENTER':
          eventLabel = 'Received at Relief Center';
          locationLabel = `Relief Center — ${batch.allocation.requester.name}`;
          break;
        default:
          continue; // skip non-lifecycle events
      }

      timeline.push({
        timestamp: log.createdAt.toISOString(),
        event: eventLabel,
        location: locationLabel
      });
    }

    // Determine verification level
    let verification: VerificationLevel = 'PARTIAL';
    if (batch.blockchainTxHash && blockchainEvent) {
      verification = 'VERIFIED';
    }

    // Build explorer URL if chain info available
    let explorerUrl: string | null = null;
    if (batch.blockchainTxHash && blockchainEvent?.chainId) {
      const chainId = blockchainEvent.chainId;
      if (chainId === 1) {
        explorerUrl = `https://etherscan.io/tx/${batch.blockchainTxHash}`;
      } else if (chainId === 11155111) {
        explorerUrl = `https://sepolia.etherscan.io/tx/${batch.blockchainTxHash}`;
      } else if (chainId === 31337) {
        explorerUrl = null; // Local hardhat — no public explorer
      }
    }

    return {
      verification,
      batch: {
        id: batch.id,
        name: batch.name,
        unit: batch.unit,
        totalQuantity: batch.totalQuantity,
        status: batch.status,
        currentLocation,
        registeredAt: batch.createdAt.toISOString(),
        updatedAt: batch.updatedAt.toISOString()
      },
      blockchain: {
        registrationTxHash: batch.blockchainTxHash,
        chainId: blockchainEvent?.chainId ?? null,
        blockNumber: blockchainEvent?.blockNumber ?? null,
        explorerUrl
      },
      timeline
    };
  }

  /**
   * Generates a deterministic QR payload for a ResourceBatch.
   * The payload is simply the batch ID — the QR is a lookup pointer, not a trust source.
   */
  static generateQRPayload(batchId: string): { batchId: string; verificationUrl: string } {
    return {
      batchId,
      verificationUrl: `/verify/resource/${batchId}`
    };
  }
}
