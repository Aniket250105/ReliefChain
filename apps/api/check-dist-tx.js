const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const dist = await prisma.distribution.findFirst({ where: { blockchainTxHash: '0x444cc7c678b8404eb85e0bf40aa7c13288cbe88fdc051df18c1f804ad493995a' } });
  console.log(dist);
  await prisma.$disconnect();
}
check().catch(console.error);
