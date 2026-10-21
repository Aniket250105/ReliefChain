// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ReliefChainAccessControl.sol";

/**
 * @title DisasterRegistry
 * @dev Manages the authoritative creation and verification of Disasters on-chain.
 */
contract DisasterRegistry {
    ReliefChainAccessControl public accessControl;

    struct Disaster {
        bytes32 metadataHash;
        bool isVerified;
        bool exists;
    }

    mapping(bytes32 => Disaster) public disasters;

    event DisasterCreated(bytes32 indexed disasterId, bytes32 metadataHash, address indexed creator);
    event DisasterVerified(bytes32 indexed disasterId, address indexed verifier);

    modifier onlyAuthority() {
        require(accessControl.hasRole(accessControl.AUTHORITY_ROLE(), msg.sender), "Caller is not an authority");
        _;
    }

    constructor(address _accessControlAddress) {
        require(_accessControlAddress != address(0), "Invalid AccessControl address");
        accessControl = ReliefChainAccessControl(_accessControlAddress);
    }

    function createDisaster(bytes32 disasterId, bytes32 metadataHash) external {
        require(!disasters[disasterId].exists, "Disaster already exists");

        disasters[disasterId] = Disaster({
            metadataHash: metadataHash,
            isVerified: false,
            exists: true
        });

        emit DisasterCreated(disasterId, metadataHash, msg.sender);
    }

    function verifyDisaster(bytes32 disasterId) external onlyAuthority {
        require(disasters[disasterId].exists, "Disaster does not exist");
        require(!disasters[disasterId].isVerified, "Disaster already verified");

        disasters[disasterId].isVerified = true;

        emit DisasterVerified(disasterId, msg.sender);
    }
}
