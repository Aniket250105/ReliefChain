// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CampaignEscrow
 * @dev Holds funds for a single campaign. Funds can only be released by the authorized AllocationMultisig.
 */
contract CampaignEscrow is ReentrancyGuard {
    bytes32 public immutable campaignId;
    address public immutable donationContract;
    address public allocationMultisig;

    constructor(bytes32 _campaignId, address _donationContract) {
        require(_donationContract != address(0), "Invalid donation contract");
        campaignId = _campaignId;
        donationContract = _donationContract;
    }

    modifier onlyDonationContract() {
        require(msg.sender == donationContract, "Only DonationContract can deposit");
        _;
    }

    modifier onlyAllocationMultisig() {
        require(msg.sender == allocationMultisig, "Only AllocationMultisig can release funds");
        _;
    }

    function setAllocationMultisig(address _allocationMultisig) external {
        // Can only be set once by the deployer/DonationContract, or in this case we'll allow DonationContract to set it
        // To simplify for MVP, we let DonationContract or the initial creator set it once
        require(allocationMultisig == address(0), "AllocationMultisig already set");
        require(msg.sender == donationContract, "Only DonationContract can set multisig");
        require(_allocationMultisig != address(0), "Invalid multisig address");
        allocationMultisig = _allocationMultisig;
    }

    // Accept funds only from DonationContract to strictly track routes
    function deposit() external payable onlyDonationContract {
        require(msg.value > 0, "Deposit must be > 0");
    }

    function releaseFunds(uint256 amount, address payable payee) external nonReentrant onlyAllocationMultisig {
        require(amount <= address(this).balance, "Insufficient escrow balance");
        require(payee != address(0), "Invalid payee address");

        (bool success, ) = payee.call{value: amount}("");
        require(success, "Transfer failed");
    }

    function campaignBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
