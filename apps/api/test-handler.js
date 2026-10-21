const { PrismaClient } = require('@prisma/client');
const { ethers } = require('ethers');
const prisma = new PrismaClient();

async function runHandlerLogic() {
  const failedEvents = await prisma.blockchainEvent.findMany({ where: { status: 'FAILED' } });
  if (failedEvents.length === 0) return console.log('No failed events');
  
  const event = failedEvents[0];
  const { batchId, quantity, beneficiaries, officer, ipfsCid } = event.payload;
  
  const decodedCid = ethers.decodeBytes32String(ipfsCid);
  const cleanIpfsCid = decodedCid.replace(/\0/g, '');
  console.log(`cleanIpfsCid: "${cleanIpfsCid}" (length ${cleanIpfsCid.length})`);
  
  const executingDistributions = await prisma.distribution.findMany({
    where: { batchId: "1f324361-d70c-4667-88de-0e2b6b5a3ae1", status: 'EXECUTING' }
  });
  
  let dist = null;
  let distEvidence = null;
  
  for (const d of executingDistributions) {
    const evidence = await prisma.evidence.findFirst({
      where: { entityType: 'Distribution', entityId: d.id }
    });
    if (evidence) {
      console.log(`Evidence CID: "${evidence.ipfsCid}" (length ${evidence.ipfsCid.length})`);
      console.log(`Starts with? ${evidence.ipfsCid.startsWith(cleanIpfsCid)}`);
      if (evidence.ipfsCid.startsWith(cleanIpfsCid)) {
        dist = d;
        distEvidence = evidence;
        break;
      }
    }
  }
  
  if (!dist) {
    console.log("dist is null!");
  } else {
    console.log("dist is found!");
    // check matching counts
    console.log(`Beneficiaries: expected ${dist.beneficiaryCount}, got ${beneficiaries}`);
  }
}
runHandlerLogic().catch(console.error);
