// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ReliefChainAccessControl.sol";

interface IDisasterRegistry {
    function disasters(bytes32 disasterId) external view returns (bytes32 metadataHash, bool isVerified, bool exists);
}

/**
 * @title CampaignRegistry
 * @dev Manages the authoritative creation and verification of Campaigns on-chain.
 */
contract CampaignRegistry {
    ReliefChainAccessControl public accessControl;
    IDisasterRegistry public disasterRegistry;

    struct Campaign {
        bytes32 disasterId;
        bool isVerified;
        bool exists;
    }

    mapping(bytes32 => Campaign) public campaigns;

    event CampaignCreated(bytes32 indexed campaignId, bytes32 indexed disasterId, address indexed creator);
    event CampaignVerified(bytes32 indexed campaignId, address indexed verifier);

    modifier onlyAuthority() {
        require(accessControl.hasRole(accessControl.AUTHORITY_ROLE(), msg.sender), "Caller is not an authority");
        _;
    }

    constructor(address _accessControlAddress, address _disasterRegistryAddress) {
        require(_accessControlAddress != address(0), "Invalid AccessControl address");
        require(_disasterRegistryAddress != address(0), "Invalid DisasterRegistry address");
        accessControl = ReliefChainAccessControl(_accessControlAddress);
        disasterRegistry = IDisasterRegistry(_disasterRegistryAddress);
    }

    function createCampaign(bytes32 campaignId, bytes32 disasterId) external {
        require(!campaigns[campaignId].exists, "Campaign already exists");
        
        // Ensure disaster exists on-chain before linking a campaign
        (, , bool disasterExists) = disasterRegistry.disasters(disasterId);
        require(disasterExists, "Disaster does not exist on-chain");

        campaigns[campaignId] = Campaign({
            disasterId: disasterId,
            isVerified: false,
            exists: true
        });

        emit CampaignCreated(campaignId, disasterId, msg.sender);
    }

    function verifyCampaign(bytes32 campaignId) external onlyAuthority {
        require(campaigns[campaignId].exists, "Campaign does not exist");
        require(!campaigns[campaignId].isVerified, "Campaign already verified");

        campaigns[campaignId].isVerified = true;

        emit CampaignVerified(campaignId, msg.sender);
    }
}
