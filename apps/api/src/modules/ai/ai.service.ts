import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

export const triggerAIDistributionCheck = async (distributionId: string, customTriggerEventId?: string) => {
  // Asynchronous wrapper
  process.nextTick(async () => {
    try {
      const dist = await prisma.distribution.findUnique({
        where: { id: distributionId },
        include: { batch: { include: { Inventories: true } } }
      });

      if (!dist) return;

      const triggerEventId = customTriggerEventId || `internal_dist_${dist.id}`;

      // Extract features deterministically
      const quantity = dist.quantity.toNumber();
      const beneficiaries = dist.beneficiaryCount;
      
      // Calculate time since last distribution for this batch
      const previousDists = await prisma.distribution.findMany({
        where: { batchId: dist.batchId, id: { not: dist.id }, status: 'CONFIRMED' },
        orderBy: { createdAt: 'desc' },
        take: 1
      });
      
      let timeDays = 100; // default large number
      if (previousDists.length > 0) {
        timeDays = (dist.createdAt.getTime() - previousDists[0].createdAt.getTime()) / (1000 * 60 * 60 * 24);
      }
      
      let ratio = 0;
      let discrepancy = 0; // Mocked for now

      if (dist.batch.Inventories.length > 0) {
        const inv = dist.batch.Inventories[0];
        const stock = inv.currentQuantity.toNumber() + quantity; // original stock
        if (stock > 0) {
          ratio = quantity / stock;
        }
      }

      const features = {
        distributionQuantity: quantity,
        inventoryDiscrepancy: discrepancy,
        beneficiaryCount: beneficiaries,
        timeSinceLastDistributionDays: timeDays,
        ratioToAvailableStock: ratio
      };

      const aiResponse = await fetch(`${AI_SERVICE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: dist.id,
          entityType: 'Distribution',
          features
        })
      });

      if (!aiResponse.ok) {
        console.error('AI Service Error:', await aiResponse.text());
        return;
      }

      const data = await aiResponse.json();

      // Only create alert if there's an anomaly or triggered rules
      if (data.riskLevel !== 'LOW' || data.reasonCodes.length > 0) {
        await prisma.aIAlert.upsert({
          where: { entityType_entityId_triggerEventId: { entityType: 'Distribution', entityId: dist.id, triggerEventId } },
          create: {
            entityType: 'Distribution',
            entityId: dist.id,
            triggerEventId,
            anomalyScore: data.anomalyScore,
            modelAvailable: data.modelAvailable ?? true,
            configuredThreshold: data.configuredThreshold,
            riskLevel: data.riskLevel,
            reasonCodes: data.reasonCodes,
            modelVersion: data.modelVersion,
            featureSetVersion: data.featureSetVersion,
            status: 'NEW'
          },
          update: {} // Idempotent: don't overwrite if it exists and has same entity
        });
      }
    } catch (e: any) {
      // AI processing failure MUST NOT block or fail the application
      console.error('Failed to process AI Anomaly check:', e.message);
    }
  });
};
