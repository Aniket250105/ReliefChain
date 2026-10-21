import prisma from '../../config/db';
import { createAuditLog } from '../../services/audit.service';
import { OrganizationDto, Web2Role } from '@reliefchain/shared-types';

export const createOrganization = async (data: { name: string; type: string; walletAddress?: string; adminUserId?: string }) => {
  const org = await prisma.organization.create({
    data: {
      name: data.name,
      type: data.type,
      walletAddress: data.walletAddress,
    },
  });

  await createAuditLog({
    actorId: data.adminUserId,
    action: 'CREATE_ORGANIZATION',
    entityType: 'Organization',
    entityId: org.id,
    status: 'Success',
  });

  return org;
};

export const getOrganizations = async () => {
  return await prisma.organization.findMany();
};

export const verifyOrganization = async (orgId: string, actorId: string) => {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  
  if (!org) {
    throw new Error('Organization not found');
  }

  if (org.isVerified) {
    throw new Error('Organization is already verified');
  }

  const updatedOrg = await prisma.organization.update({
    where: { id: orgId },
    data: { isVerified: true },
  });

  await createAuditLog({
    actorId,
    action: 'VERIFY_ORGANIZATION',
    entityType: 'Organization',
    entityId: orgId,
    status: 'Success',
  });

  return updatedOrg;
};
