const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function printEvent() {
  const events = await prisma.blockchainEvent.findMany({ where: { status: 'FAILED' } });
  console.log(events[0]);
  await prisma.$disconnect();
}
printEvent().catch(console.error);
