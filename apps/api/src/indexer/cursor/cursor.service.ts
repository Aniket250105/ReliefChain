import prisma from '../../config/db';

export class CursorService {
  /**
   * Retrieves the current cursor (block and hash) for a given chainId.
   */
  static async getCursor(chainId: number, defaultStartBlock: number = 0): Promise<{ block: number, hash: string | null }> {
    const state = await prisma.indexerState.findUnique({
      where: { chainId }
    });

    if (!state) {
      return { block: defaultStartBlock, hash: null };
    }

    return { block: state.lastProcessedBlock, hash: state.lastProcessedBlockHash };
  }

  /**
   * Advances the indexer cursor safely.
   */
  static async advanceCursor(chainId: number, blockNumber: number, blockHash: string): Promise<void> {
    await prisma.indexerState.upsert({
      where: { chainId },
      create: {
        chainId,
        lastProcessedBlock: blockNumber,
        lastProcessedBlockHash: blockHash,
      },
      update: {
        lastProcessedBlock: blockNumber,
        lastProcessedBlockHash: blockHash,
      }
    });
  }
}
