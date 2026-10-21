import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const listNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const notifications = await prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50 // Bounded list
    });

    return res.status(200).json(notifications);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const count = await prisma.notification.count({
      where: { recipientId: userId, status: 'UNREAD' }
    });

    return res.status(200).json({ unreadCount: count });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const idempotencyKey = req.headers['idempotency-key'] as string;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key header is required' });

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    
    // Security constraint: users can only mark their own notifications as read
    if (notification.recipientId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Check existing API idempotency key
    const existingKeyNotification = await prisma.notification.findUnique({ where: { apiIdempotencyKey: idempotencyKey } });
    if (existingKeyNotification) {
      if (existingKeyNotification.id === id && existingKeyNotification.status === 'READ') {
        return res.status(200).json(existingKeyNotification);
      } else {
        return res.status(409).json({ error: 'Idempotency conflict' });
      }
    }

    if (notification.status === 'READ') {
      return res.status(200).json(notification); // Already read organically
    }

    try {
      const updated = await prisma.notification.update({
        where: { id },
        data: {
          status: 'READ',
          readAt: new Date(),
          apiIdempotencyKey: idempotencyKey
        }
      });
      return res.status(200).json(updated);
    } catch (dbError: any) {
      if (dbError.code === 'P2002') {
        const conflictCheck = await prisma.notification.findUnique({ where: { apiIdempotencyKey: idempotencyKey } });
        if (conflictCheck && conflictCheck.id === id && conflictCheck.status === 'READ') {
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
