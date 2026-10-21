import prisma from '../config/db';

export interface AuditLogData {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  status: string;
  metadata?: any;
}

export const createAuditLog = async (data: AuditLogData) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        status: data.status,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};
