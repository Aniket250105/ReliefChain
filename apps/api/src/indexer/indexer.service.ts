import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { web3Service } from '../services/web3.service';
import { EVENT_REGISTRY } from './event-registry';
import { CursorService } from './cursor/cursor.service';
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { RetryService } from './retry/retry.service';

export interface IndexerConfig {
  chainId: number;
  confirmationBlocks: number;
  pollIntervalMs: number;
  contracts: {
    DisasterRegistry: string;
    CampaignRegistry: string;
    DonationContract: string;
    AllocationMultisig: string;
    ResourceProvenance: string;
  };
}

export class EventIndexer {
  private isRunning: boolean = false;
  private provider: ethers.JsonRpcProvider;

  constructor(private config: IndexerConfig) {
    this.provider = web3Service.getProvider();
  }

  private loadAbi(contractName: string): any {
    const artifactPath = path.join(
      __dirname,
      '../../../../packages/contracts/artifacts/contracts',
      `${contractName}.sol`,
      `${contractName}.json`
    );
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`Artifact not found at ${artifactPath}`);
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    return artifact.abi;
  }

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`[Indexer] Starting indexer for chain ${this.config.chainId}`);
    const isValidNetwork = await web3Service.verifyNetwork();
    if (!isValidNetwork) {
      console.error('[Indexer] Invalid network. Stopping.');
      this.isRunning = false;
      return;
    }

    const contracts = [
      { name: 'DisasterRegistry', address: this.config.contracts.DisasterRegistry },
      { name: 'CampaignRegistry', address: this.config.contracts.CampaignRegistry },
      { name: 'DonationContract', address: this.config.contracts.DonationContract },
      { name: 'AllocationMultisig', address: this.config.contracts.AllocationMultisig },
      { name: 'ResourceProvenance', address: this.config.contracts.ResourceProvenance },
    ].map(c => {
      const abi = this.loadAbi(c.name);
      return new ethers.Contract(c.address, abi, this.provider);
    });

    this.poll(contracts);
  }

  public stop() {
    this.isRunning = false;
  }

  private async poll(contracts: ethers.Contract[]) {
    console.log('[Indexer] Starting polling loop...');
    while (this.isRunning) {
      try {
        console.log('[Indexer] Processing next batch...');
        await this.processNextBatch(contracts);
        
        console.log('[Indexer] Processing retries...');
        // Process retries
        await RetryService.retryFailedEvents(this.config.chainId, EVENT_REGISTRY);

      } catch (error) {
        console.error(`[Indexer] Error in polling loop`, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, this.config.pollIntervalMs));
    }
  }

  private async processNextBatch(contracts: ethers.Contract[]) {
    console.log('[Indexer] Fetching latest block...');
    const latestBlock = await this.provider.getBlockNumber();
    const targetBlock = latestBlock - this.config.confirmationBlocks;

    console.log(`[Indexer] Target block: ${targetBlock}. Fetching cursor...`);
    const { block: lastProcessedBlock, hash: lastProcessedBlockHash } = await CursorService.getCursor(this.config.chainId, 0);
    console.log(`[Indexer] Last processed block: ${lastProcessedBlock}`);

    // Reorg check on the checkpoint boundary
    if (lastProcessedBlock > 0 && lastProcessedBlockHash) {
      const blockAtCursor = await this.provider.getBlock(lastProcessedBlock);
      if (blockAtCursor && blockAtCursor.hash !== lastProcessedBlockHash) {
        throw new Error(`[Indexer] REORG DETECTED: Block ${lastProcessedBlock} hash mismatch. Expected ${lastProcessedBlockHash}, got ${blockAtCursor.hash}. Manual intervention required.`);
      }
    }

    if (lastProcessedBlock >= targetBlock) {
      // Nothing to do
      return;
    }

    const fromBlock = lastProcessedBlock + 1;
    const toBlock = Math.min(fromBlock + 100, targetBlock); // Fetch in chunks of 100

    console.log(`[Indexer] Scanning blocks ${fromBlock} to ${toBlock}`);

    for (let currentBlock = fromBlock; currentBlock <= toBlock; currentBlock++) {
      let blockSucceeded = true;
      const block = await this.provider.getBlock(currentBlock);
      if (!block) {
        console.warn(`[Indexer] Block ${currentBlock} not found yet`);
        break;
      }

      // Fetch logs for all contracts for this block
      for (const contract of contracts) {
        const logs = await this.provider.getLogs({
          address: contract.target,
          fromBlock: currentBlock,
          toBlock: currentBlock
        });

        for (const log of logs) {
          try {
            const parsedLog = contract.interface.parseLog(log as any);
            if (!parsedLog) continue; // Not an event from this ABI

            const handler = EVENT_REGISTRY[parsedLog.name];
            if (handler) {
              const payload: Record<string, any> = {};
              parsedLog.fragment.inputs.forEach((input, index) => {
                // Convert BigInt to string to safely store in JSON
                const val = parsedLog.args[index];
                payload[input.name] = typeof val === 'bigint' ? val.toString() : val;
              });

              console.log(`[Indexer] Found ${parsedLog.name} at tx ${log.transactionHash}`);
              const success = await ReconciliationService.processEvent({
                chainId: this.config.chainId,
                contractAddress: contract.target as string,
                transactionHash: log.transactionHash,
                blockNumber: log.blockNumber,
                blockHash: log.blockHash,
                logIndex: log.index,
                eventName: parsedLog.name,
                payload: payload,
                rawEvent: log
              }, handler);
              if (!success) {
                blockSucceeded = false;
              }
            }
          } catch (err) {
            // parseLog throws if the log doesn't match the ABI, which is fine, we just ignore it.
            // But if processEvent throws unexpectedly, we mark blockSucceeded as false.
            if (!(err instanceof Error) || !err.message.includes('no matching event')) {
              console.error(`[Indexer] Error processing log`, err);
              // We do not fail the block because processEvent handles its own failures and marks them as FAILED.
              // We only fail the block if there is a catastrophic DB error preventing even the FAILED state update.
            }
          }
        }
      }

      if (blockSucceeded) {
        await CursorService.advanceCursor(this.config.chainId, currentBlock, block.hash || '');
      } else {
        console.error(`[Indexer] Halting cursor advance due to fatal error in block ${currentBlock}`);
        break; // Do not advance cursor and stop processing further blocks
      }
    }
  }
}
