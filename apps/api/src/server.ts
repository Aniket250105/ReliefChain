import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './modules/auth/auth.routes';
import orgRoutes from './modules/organizations/organizations.routes';
import disasterRoutes from './modules/disasters/disasters.routes';
import campaignRoutes from './modules/campaigns/campaigns.routes';
import donationRoutes from './modules/donations/donations.routes';
import allocationRoutes from './modules/allocations/allocations.routes';

import resourceRoutes from './modules/resources/resources.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import qrRoutes from './modules/qr/qr.routes';
import distributionRoutes from './modules/distributions/distributions.routes';
import impactRoutes from './modules/impact/impact.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import aiRoutes from './modules/ai/ai.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/disasters', disasterRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/distributions', distributionRoutes);
app.use('/api/impact', impactRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api', analyticsRoutes);

app.get('/health', async (req, res) => {
    const health: any = { status: 'ok', service: 'ReliefChain API', timestamp: new Date().toISOString() };
    const checks: any = {};

    // PostgreSQL check
    try {
        const prisma = require('./config/db').default;
        await prisma.$queryRaw`SELECT 1`;
        checks.database = 'connected';
    } catch {
        checks.database = 'unreachable';
        health.status = 'degraded';
    }

    // Web3 provider check
    try {
        const { web3Service } = require('./services/web3.service');
        const network = await web3Service.getProvider().getNetwork();
        checks.blockchain = { connected: true, chainId: Number(network.chainId) };
    } catch {
        checks.blockchain = { connected: false };
        // Blockchain unavailability does not make core API unavailable
    }

    // AI service check
    try {
        const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const aiRes = await fetch(`${aiUrl}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        checks.ai = aiRes.ok ? 'connected' : 'unreachable';
    } catch {
        checks.ai = 'unreachable';
        // AI unavailability does not make core API unavailable
    }

    health.checks = checks;
    res.status(health.status === 'ok' ? 200 : 503).json(health);
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`ReliefChain API running on port ${port}`);

        // Launch background event indexer if blockchain contracts configured
        if (process.env.DONATION_CONTRACT_ADDRESS) {
            try {
                const { EventIndexer } = require('./indexer/indexer.service');
                const indexer = new EventIndexer({
                    chainId: parseInt(process.env.CHAIN_ID || '31337', 10),
                    confirmationBlocks: 1,
                    pollIntervalMs: 3000,
                    contracts: {
                        DisasterRegistry: process.env.DISASTER_REGISTRY_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
                        CampaignRegistry: process.env.CAMPAIGN_REGISTRY_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
                        DonationContract: process.env.DONATION_CONTRACT_ADDRESS || '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
                        AllocationMultisig: process.env.ALLOCATION_MULTISIG_ADDRESS || '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
                        ResourceProvenance: process.env.RESOURCE_PROVENANCE_ADDRESS || '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
                    }
                });
                indexer.start().catch((err: any) => console.warn('[Indexer] Polling error:', err.message));
            } catch (err: any) {
                console.warn('[Indexer] Could not start indexer:', err.message);
            }
        }
    });
}

export default app;
