// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ReliefChainAccessControl.sol";

interface ICampaignEscrow {
    function releaseFunds(uint256 amount, address payable payee) external;
    function campaignBalance() external view returns (uint256);
}

/**
 * @title AllocationMultisig
 * @dev Manages 2-of-3 threshold approvals for releasing campaign funds.
 */
contract AllocationMultisig {
    ReliefChainAccessControl public accessControl;
    
    struct Allocation {
        bytes32 campaignId;
        address escrowAddress;
        uint256 amount;
        address payable payee;
        uint8 approvalCount;
        bool executed;
        bool exists;
    }

    mapping(bytes32 => Allocation) public allocations;
    mapping(bytes32 => mapping(address => bool)) public hasApproved;

    uint8 public constant THRESHOLD = 2;

    event AllocationProposed(bytes32 indexed allocationId, bytes32 indexed campaignId, uint256 amount, address payee, address proposer);
    event AllocationApproved(bytes32 indexed allocationId, address indexed signer);
    event AllocationExecuted(bytes32 indexed allocationId, bytes32 indexed campaignId, uint256 amount, address payee);

    modifier onlyAuthorizedProposer() {
        require(
            accessControl.hasRole(accessControl.NGO_ROLE(), msg.sender),
            "Caller is not authorized to propose"
        );
        _;
    }

    modifier onlySigner() {
        require(accessControl.hasRole(accessControl.SIGNER_ROLE(), msg.sender), "Caller is not a signer");
        _;
    }

    constructor(address _accessControlAddress) {
        require(_accessControlAddress != address(0), "Invalid AccessControl address");
        accessControl = ReliefChainAccessControl(_accessControlAddress);
    }

    function proposeAllocation(
        bytes32 allocationId, 
        bytes32 campaignId, 
        address escrowAddress, 
        uint256 amount, 
        address payable payee
    ) external onlyAuthorizedProposer {
        require(!allocations[allocationId].exists, "Allocation already exists");
        require(escrowAddress != address(0), "Invalid escrow address");
        require(payee != address(0), "Invalid payee address");
        require(amount > 0, "Amount must be > 0");

        allocations[allocationId] = Allocation({
            campaignId: campaignId,
            escrowAddress: escrowAddress,
            amount: amount,
            payee: payee,
            approvalCount: 0,
            executed: false,
            exists: true
        });

        emit AllocationProposed(allocationId, campaignId, amount, payee, msg.sender);
    }

    function approveAllocation(bytes32 allocationId) external onlySigner {
        Allocation storage allocation = allocations[allocationId];
        require(allocation.exists, "Allocation does not exist");
        require(!allocation.executed, "Allocation already executed");
        require(!hasApproved[allocationId][msg.sender], "Signer already approved");

        hasApproved[allocationId][msg.sender] = true;
        allocation.approvalCount += 1;

        emit AllocationApproved(allocationId, msg.sender);
    }

    function executeAllocation(bytes32 allocationId) external {
        Allocation storage allocation = allocations[allocationId];
        require(allocation.exists, "Allocation does not exist");
        require(!allocation.executed, "Allocation already executed");
        require(allocation.approvalCount >= THRESHOLD, "Threshold not met");

        allocation.executed = true;

        ICampaignEscrow(allocation.escrowAddress).releaseFunds(allocation.amount, allocation.payee);

        emit AllocationExecuted(allocationId, allocation.campaignId, allocation.amount, allocation.payee);
    }
}
