const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetCursor() {
  await prisma.blockchainEvent.deleteMany({});
  await prisma.indexerState.updateMany({
    where: { chainId: 31337 },
    data: { lastProcessedBlock: 0, lastProcessedBlockHash: '' }
  });
  console.log('Cursor reset to 0');
  await prisma.$disconnect();
}
resetCursor().catch(console.error);
