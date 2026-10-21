import prisma from '../../config/db';
import { createAuditLog } from '../../services/audit.service';
import { CreateDisasterDto, DisasterStatus, Web2Role, OrganizationType } from '@reliefchain/shared-types';

export const createDisaster = async (
  data: CreateDisasterDto,
  actorId: string,
  organizationId: string
) => {
  // Validate that the organization is a verified Government Authority
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org || org.type !== OrganizationType.GOVERNMENT || !org.isVerified) {
    throw new Error('Invalid or unverified authority organization');
  }

  const disaster = await prisma.disaster.create({
    data: {
      name: data.name,
      description: data.description,
      severity: data.severity,
      state: data.state,
      district: data.district,
      city: data.city,
      pinCode: data.pinCode,
      status: DisasterStatus.PENDING_VERIFICATION,
      authorityId: organizationId,
    },
  });

  await createAuditLog({
    actorId,
    action: 'CREATE_DISASTER',
    entityType: 'Disaster',
    entityId: disaster.id,
    status: 'Success',
    metadata: { initialState: DisasterStatus.PENDING_VERIFICATION },
  });

  return disaster;
};

export const getDisasters = async () => {
  return await prisma.disaster.findMany();
};

const validateTransition = (current: string, next: DisasterStatus) => {
  const transitions: Record<string, DisasterStatus[]> = {
    [DisasterStatus.DRAFT]: [DisasterStatus.PENDING_VERIFICATION],
    [DisasterStatus.PENDING_VERIFICATION]: [DisasterStatus.VERIFIED, DisasterStatus.ACTIVE],
    [DisasterStatus.VERIFIED]: [DisasterStatus.ACTIVE],
    [DisasterStatus.ACTIVE]: [DisasterStatus.RESOLVED],
    [DisasterStatus.RESOLVED]: [DisasterStatus.ARCHIVED],
    [DisasterStatus.ARCHIVED]: [], // Terminal state
  };

  const allowed = transitions[current] || [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid state transition from ${current} to ${next}`);
  }
};

const transitionDisaster = async (
  disasterId: string,
  nextState: DisasterStatus,
  actorId: string,
  action: string
) => {
  const disaster = await prisma.disaster.findUnique({ where: { id: disasterId } });
  if (!disaster) {
    throw new Error('Disaster not found');
  }

  try {
    validateTransition(disaster.status, nextState);
  } catch (error: any) {
    await createAuditLog({
      actorId,
      action,
      entityType: 'Disaster',
      entityId: disasterId,
      status: 'Failure',
      metadata: { error: error.message, currentState: disaster.status, requestedState: nextState },
    });
    throw error;
  }

  const updated = await prisma.disaster.update({
    where: { id: disasterId },
    data: { status: nextState },
  });

  await createAuditLog({
    actorId,
    action,
    entityType: 'Disaster',
    entityId: disasterId,
    status: 'Success',
    metadata: { previousState: disaster.status, newState: nextState },
  });

  return updated;
};

export const verifyDisaster = async (disasterId: string, actorId: string) => {
  return await transitionDisaster(disasterId, DisasterStatus.ACTIVE, actorId, 'VERIFY_DISASTER');
};

export const activateDisaster = async (disasterId: string, actorId: string) => {
  return await transitionDisaster(disasterId, DisasterStatus.ACTIVE, actorId, 'ACTIVATE_DISASTER');
};

export const resolveDisaster = async (disasterId: string, actorId: string) => {
  return await transitionDisaster(disasterId, DisasterStatus.RESOLVED, actorId, 'RESOLVE_DISASTER');
};

export const archiveDisaster = async (disasterId: string, actorId: string) => {
  return await transitionDisaster(disasterId, DisasterStatus.ARCHIVED, actorId, 'ARCHIVE_DISASTER');
};

export const updateDisaster = async (
  disasterId: string,
  data: Partial<CreateDisasterDto>,
  actorId: string
) => {
  const disaster = await prisma.disaster.findUnique({ where: { id: disasterId } });
  if (!disaster) {
    throw new Error('Disaster not found');
  }

  const updated = await prisma.disaster.update({
    where: { id: disasterId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.severity && { severity: data.severity }),
      ...(data.state && { state: data.state }),
      ...(data.district !== undefined && { district: data.district }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.pinCode !== undefined && { pinCode: data.pinCode }),
    },
  });

  await createAuditLog({
    actorId,
    action: 'UPDATE_DISASTER',
    entityType: 'Disaster',
    entityId: disasterId,
    status: 'Success',
    metadata: {
      disasterId,
      previous: {
        name: disaster.name,
        severity: disaster.severity,
        state: disaster.state,
        district: disaster.district,
        city: disaster.city,
        pinCode: disaster.pinCode
      },
      updated: {
        name: updated.name,
        severity: updated.severity,
        state: updated.state,
        district: updated.district,
        city: updated.city,
        pinCode: updated.pinCode
      }
    },
  });

  return updated;
};

export const deleteDisaster = async (disasterId: string, actorId: string) => {
  const disaster = await prisma.disaster.findUnique({ where: { id: disasterId } });
  if (!disaster) {
    throw new Error('Disaster not found');
  }

  // Check if any campaign associated with this disaster has received donations
  const campaignWithFunds = await prisma.campaign.findFirst({
    where: { disasterId, raisedAmount: { gt: 0 } }
  });

  if (campaignWithFunds) {
    throw new Error('Cannot delete disaster: associated campaigns have active donations. Resolve or archive it instead.');
  }

  // Delete any empty/draft campaigns associated with this mistaken disaster
  await prisma.campaign.deleteMany({ where: { disasterId } });

  // Delete the disaster
  await prisma.disaster.delete({ where: { id: disasterId } });

  await createAuditLog({
    actorId,
    action: 'DELETE_DISASTER',
    entityType: 'Disaster',
    entityId: disasterId,
    status: 'Success',
    metadata: {
      deletedDisasterName: disaster.name,
      deletedState: disaster.state,
      reason: 'Administrative deletion of mistaken disaster declaration'
    },
  });

  return { success: true, message: 'Disaster deleted successfully' };
};

