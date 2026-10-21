import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../../services/audit.service';

const prisma = new PrismaClient();

export const listAlerts = async (req: Request, res: Response) => {
  try {
    const { status, riskLevel, entityType } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (riskLevel) where.riskLevel = riskLevel;
    if (entityType) where.entityType = entityType;

    const alerts = await prisma.aIAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(alerts);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getAlertDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const alert = await prisma.aIAlert.findUnique({ where: { id } });
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    return res.status(200).json(alert);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const reviewAlert = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // NEW, INVESTIGATING, RESOLVED_FALSE_POSITIVE, ESCALATED
    const idempotencyKey = req.headers['idempotency-key'] as string;
    const userRole = (req as any).user?.role;

    if (!idempotencyKey) {
      return res.status(400).json({ error: 'Idempotency-Key header is required' });
    }

    if (userRole !== 'AUDITOR' && userRole !== 'SYSTEM_ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Only Auditors can review AI alerts' });
    }

    const validStatuses = ['NEW', 'INVESTIGATING', 'RESOLVED_FALSE_POSITIVE', 'ESCALATED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status transition' });
    }

    // Check existing idempotency key
    const existingKeyAlert = await prisma.aIAlert.findUnique({ where: { idempotencyKey } });
    if (existingKeyAlert) {
      if (existingKeyAlert.id === id && existingKeyAlert.status === status) {
        return res.status(200).json(existingKeyAlert);
      } else {
        return res.status(409).json({ error: 'Idempotency conflict' });
      }
    }

    const alert = await prisma.aIAlert.findUnique({ where: { id } });
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    try {
      const updated = await prisma.aIAlert.update({
        where: { id },
        data: { status, idempotencyKey }
      });

      // Create Audit Log
      await createAuditLog({
        actorId: (req as any).user.id,
        action: 'AI_ALERT_REVIEWED',
        entityType: 'AIAlert',
        entityId: updated.id,
        status: 'Success',
        metadata: { newStatus: status, reason: 'Auditor manual review' }
      });

      return res.status(200).json(updated);
    } catch (dbError: any) {
      if (dbError.code === 'P2002') {
        const conflictCheck = await prisma.aIAlert.findUnique({ where: { idempotencyKey } });
        if (conflictCheck && conflictCheck.id === id && conflictCheck.status === status) {
           return res.status(200).json(conflictCheck);
        }
        return res.status(409).json({ error: 'Idempotency conflict' });
      }
      throw dbError;
    }
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { actor: { select: { role: true, email: true } } }
    });
    return res.status(200).json(logs);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
