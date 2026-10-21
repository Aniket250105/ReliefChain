const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const dists = await prisma.distribution.findMany({ where: { status: 'EXECUTING' } });
  for (let d of dists) {
    const ev = await prisma.evidence.findFirst({ where: { entityId: d.id } });
    console.log(`Dist: ${d.id}, CID: ${ev?.ipfsCid}, StartsWith mock-ipfs-cid-ae18349058b5558d7: ${ev?.ipfsCid?.startsWith('mock-ipfs-cid-ae18349058b5558d7')}`);
  }
  await prisma.$disconnect();
}
check().catch(console.error);
