const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function checkEvents() {
  const events = await prisma.blockchainEvent.findMany({
    where: { status: 'FAILED' }
  });
  console.log(events.map(e => ({ tx: e.transactionHash, err: e.errorDetails })));
  await prisma.$disconnect();
}
checkEvents().catch(console.error);
