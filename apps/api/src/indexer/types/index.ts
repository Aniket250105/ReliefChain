import { ethers } from 'ethers';

export interface BlockchainEventPayload {
  chainId: number;
  contractAddress: string;
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  logIndex: number;
  eventName: string;
  payload: Record<string, any>;
  rawEvent?: any;
}

export interface EventHandlerContext {
  event: BlockchainEventPayload;
  logger: (message: string, meta?: any) => void;
}

export type EventHandler = (context: EventHandlerContext) => Promise<void>;

export class UnrecoverableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnrecoverableError';
  }
}
