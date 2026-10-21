// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CampaignEscrow.sol";

interface ICampaignRegistry {
    function campaigns(bytes32 campaignId) external view returns (bytes32 disasterId, bool isVerified, bool exists);
}

/**
 * @title DonationContract
 * @dev Routes donations to the correct CampaignEscrow.
 */
contract DonationContract {
    ICampaignRegistry public campaignRegistry;

    mapping(bytes32 => address) public campaignEscrows;

    event DonationReceived(bytes32 indexed campaignId, address indexed donor, uint256 amount);
    event CampaignEscrowCreated(bytes32 indexed campaignId, address escrowAddress);

    constructor(address _campaignRegistryAddress) {
        require(_campaignRegistryAddress != address(0), "Invalid CampaignRegistry address");
        campaignRegistry = ICampaignRegistry(_campaignRegistryAddress);
    }

    function createEscrow(bytes32 campaignId) external returns (address) {
        require(campaignEscrows[campaignId] == address(0), "Escrow already exists");
        
        (, bool isVerified, bool exists) = campaignRegistry.campaigns(campaignId);
        require(exists, "Campaign does not exist");
        require(isVerified, "Campaign is not verified");

        CampaignEscrow newEscrow = new CampaignEscrow(campaignId, address(this));
        campaignEscrows[campaignId] = address(newEscrow);
        
        emit CampaignEscrowCreated(campaignId, address(newEscrow));
        return address(newEscrow);
    }

    function setEscrowMultisig(bytes32 campaignId, address allocationMultisig) external {
        address escrowAddress = campaignEscrows[campaignId];
        require(escrowAddress != address(0), "Escrow does not exist");
        CampaignEscrow(escrowAddress).setAllocationMultisig(allocationMultisig);
    }

    function donate(bytes32 campaignId) external payable {
        require(msg.value > 0, "Donation must be > 0");
        
        address escrowAddress = campaignEscrows[campaignId];
        require(escrowAddress != address(0), "Campaign escrow not initialized");

        // Route funds to the escrow
        CampaignEscrow(escrowAddress).deposit{value: msg.value}();

        emit DonationReceived(campaignId, msg.sender, msg.value);
    }

    function campaignBalance(bytes32 campaignId) external view returns (uint256) {
        address escrowAddress = campaignEscrows[campaignId];
        if (escrowAddress == address(0)) {
            return 0;
        }
        return CampaignEscrow(escrowAddress).campaignBalance();
    }
}
