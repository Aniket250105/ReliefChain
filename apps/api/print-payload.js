const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function printPayload() {
  const events = await prisma.blockchainEvent.findMany({
    where: { status: 'FAILED' }
  });
  console.log(JSON.stringify(events[0].payload));
  await prisma.$disconnect();
}
printPayload().catch(console.error);
