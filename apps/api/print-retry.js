const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function printNextRetry() {
  const events = await prisma.blockchainEvent.findMany({
    where: { status: 'FAILED' }
  });
  console.log(events.map(e => e.nextRetryAt));
  await prisma.$disconnect();
}
printNextRetry().catch(console.error);
