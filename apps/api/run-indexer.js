require('ts-node/register');
require('dotenv').config({ path: '../../.env' });
const { EventIndexer } = require('./src/indexer/indexer.service');
const deployment = require('../../packages/contracts/deployment.json');

async function run() {
  console.log('run-indexer.js starting...');
  const indexer = new EventIndexer({
    chainId: 31337,
    rpcUrl: 'http://127.0.0.1:8545',
    pollIntervalMs: 2000,
    maxBlocksPerPoll: 100,
    confirmationBlocks: 0,
    contracts: deployment.contracts
  });
  
  await indexer.start();
}

run().catch(console.error);
