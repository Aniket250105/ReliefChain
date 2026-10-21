// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ReliefChainAccessControl
 * @dev Centralized Role-Based Access Control for ReliefChain smart contracts.
 * Separates Web3 roles from Web2 roles.
 */
contract ReliefChainAccessControl is AccessControl {
    bytes32 public constant AUTHORITY_ROLE = keccak256("AUTHORITY_ROLE");
    bytes32 public constant NGO_ROLE = keccak256("NGO_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant SYSTEM_INDEXER_ROLE = keccak256("SYSTEM_INDEXER_ROLE");
    bytes32 public constant SUPPLIER_ROLE = keccak256("SUPPLIER_ROLE");

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
}
