// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

/// @notice Minimal interface for Circle's CCTP V2 TokenMessengerV2.
/// Source: https://github.com/circlefin/evm-cctp-contracts/blob/master/src/v2/TokenMessengerV2.sol
/// Mainnet address (same on Ethereum, Base, Arbitrum, ...): 0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d
interface ITokenMessengerV2 {
    event DepositForBurn(
        address indexed burnToken,
        uint256 amount,
        address indexed depositor,
        bytes32 mintRecipient,
        uint32 destinationDomain,
        bytes32 destinationTokenMessenger,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 indexed minFinalityThreshold,
        bytes hookData
    );

    /// @param amount amount of tokens to burn
    /// @param destinationDomain destination domain (Ethereum = 0, Arbitrum = 3, Base = 6)
    /// @param mintRecipient address of mint recipient on destination domain, as bytes32
    /// @param burnToken token to burn on the local domain
    /// @param destinationCaller authorized caller of receiveMessage on destination; bytes32(0) = anyone
    /// @param maxFee maximum fee paid on destination, in units of burnToken (0 for Standard Transfers)
    /// @param minFinalityThreshold 1000 = Fast Transfer, 2000 = Standard Transfer
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external;
}
