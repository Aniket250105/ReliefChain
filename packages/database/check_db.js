const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const batches = await prisma.resourceBatch.findMany({ include: { supplier: true, Inventories: true } });
  const inventories = await prisma.inventory.findMany({ include: { batch: true } });
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, organizationId: true } });
  const orgs = await prisma.organization.findMany();

  console.log('BATCHES COUNT:', batches.length);
  console.log('INVENTORIES COUNT:', inventories.length);
  console.log('BATCHES:', JSON.stringify(batches, null, 2));
  console.log('INVENTORIES:', JSON.stringify(inventories, null, 2));
  console.log('USERS:', JSON.stringify(users, null, 2));
  console.log('ORGS:', JSON.stringify(orgs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
