const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function fixBatch() {
  await prisma.resourceBatch.updateMany({
    where: { id: '1f324361-d70c-4667-88de-0e2b6b5a3ae1' },
    data: { status: 'RECEIVED_RELIEF_CENTER' }
  });
  console.log('Batch updated back to RECEIVED_RELIEF_CENTER');
  await prisma.$disconnect();
}
fixBatch().catch(console.error);
