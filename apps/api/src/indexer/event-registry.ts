import { EventHandler } from './types';
import { handleDisasterCreated, handleDisasterVerified } from './event-handlers/disaster.handlers';
import { handleCampaignCreated, handleCampaignVerified } from './event-handlers/campaign.handlers';
import { handleDonationReceived } from './event-handlers/donation.handlers';
import { handleAllocationProposed, handleAllocationApproved, handleAllocationExecuted } from './event-handlers/allocation.handlers';
import { handleResourceRegistered, handleDistributionRecorded } from './event-handlers/resource.handlers';

export const EVENT_REGISTRY: Record<string, EventHandler> = {
  'DisasterCreated': handleDisasterCreated,
  'DisasterVerified': handleDisasterVerified,
  
  'CampaignCreated': handleCampaignCreated,
  'CampaignVerified': handleCampaignVerified,
  
  'DonationReceived': handleDonationReceived,
  
  'AllocationProposed': handleAllocationProposed,
  'AllocationApproved': handleAllocationApproved,
  'AllocationExecuted': handleAllocationExecuted,
  
  'ResourceRegistered': handleResourceRegistered,
  'DistributionRecorded': handleDistributionRecorded,
};
