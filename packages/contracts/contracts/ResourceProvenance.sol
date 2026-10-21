// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ReliefChainAccessControl.sol";

/**
 * @title ResourceProvenance
 * @dev Foundational structure for physical resource tracking.
 */
contract ResourceProvenance {
    ReliefChainAccessControl public accessControl;

    struct ResourceBatch {
        bytes32 campaignId;
        bytes32 metadataHash;
        address supplier;
        bool exists;
    }

    mapping(bytes32 => ResourceBatch) public batches;
    

    // Tracks total quantity distributed per batch for partial distribution accounting
    mapping(bytes32 => uint256) public distributedQuantity;

    event ResourceRegistered(bytes32 indexed batchId, bytes32 indexed campaignId, bytes32 metadataHash, address supplier);
    event DistributionRecorded(bytes32 indexed batchId, uint256 quantity, uint256 beneficiaries, address indexed officer, bytes32 ipfsCid, address indexed recordedBy);

    modifier onlyAuthorized() {
        require(
            accessControl.hasRole(accessControl.AUTHORITY_ROLE(), msg.sender) || 
            accessControl.hasRole(accessControl.NGO_ROLE(), msg.sender) ||
            accessControl.hasRole(accessControl.SYSTEM_INDEXER_ROLE(), msg.sender) ||
            accessControl.hasRole(accessControl.SUPPLIER_ROLE(), msg.sender),
            "Caller is not authorized"
        );
        _;
    }

    constructor(address _accessControlAddress) {
        require(_accessControlAddress != address(0), "Invalid AccessControl address");
        accessControl = ReliefChainAccessControl(_accessControlAddress);
    }

    function registerBatch(bytes32 batchId, bytes32 campaignId, bytes32 metadataHash, address supplier) external onlyAuthorized {
        require(!batches[batchId].exists, "Batch already registered");
        require(supplier != address(0), "Invalid supplier address");

        batches[batchId] = ResourceBatch({
            campaignId: campaignId,
            metadataHash: metadataHash,
            supplier: supplier,
            exists: true
        });

        emit ResourceRegistered(batchId, campaignId, metadataHash, supplier);
    }

    /**
     * @dev Records a distribution event.
     * Limitation: The contract does not currently maintain the total registered batch quantity (M9 limitation). 
     * Therefore, it cannot natively enforce `quantity <= remaining available` on-chain. 
     * This bound is strictly enforced by the off-chain Inventory system.
     * The contract tracks `distributedQuantity` cumulatively to support future on-chain constraints.
     */
    function recordDistribution(
        bytes32 batchId, 
        uint256 quantity, 
        uint256 beneficiaries, 
        address officer, 
        bytes32 ipfsCid
    ) external onlyAuthorized {
        require(batches[batchId].exists, "Batch does not exist");
        require(quantity > 0, "Quantity must be greater than zero");
        require(officer != address(0), "Invalid officer address");

        distributedQuantity[batchId] += quantity;

        emit DistributionRecorded(batchId, quantity, beneficiaries, officer, ipfsCid, msg.sender);
    }
}
