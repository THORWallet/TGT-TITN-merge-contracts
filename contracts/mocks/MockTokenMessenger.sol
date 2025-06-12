// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockTokenMessenger {
    event DepositForBurn(
        uint64 indexed nonce,
        address indexed burnToken,
        uint256 amount,
        address indexed depositor,
        bytes32 mintRecipient,
        uint32 destinationDomain,
        bytes32 destinationTokenMessenger,
        bytes32 destinationCaller
    );

    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken
    ) external returns (uint64) {
        emit DepositForBurn(1, burnToken, amount, msg.sender, mintRecipient, destinationDomain, 0, 0);
        return 1; // dummy nonce
    }
}
