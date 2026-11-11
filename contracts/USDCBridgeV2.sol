// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ITokenMessengerV2.sol";

interface IERC20Minimal {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

/// @title USDCBridgeV2
/// @notice Same behaviour as USDCBridge, but on Circle CCTP V2 (CCTP V1 is shut down on Dec 1, 2026).
///         Holds USDC and, when the owner calls bridgeUSDC(), burns the full balance so it is minted
///         to `mintRecipient` on the destination domain.
/// @dev Ethereum -> Base deployment params:
///        usdc               0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
///        tokenMessenger     0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d (TokenMessengerV2)
///        destinationDomain  6 (Base)
contract USDCBridgeV2 {
    uint32 public constant FINALITY_FAST = 1000;
    uint32 public constant FINALITY_STANDARD = 2000;

    address public immutable usdc;
    ITokenMessengerV2 public immutable tokenMessenger;
    uint32 public immutable destinationDomain;

    address public mintRecipient; // receives the minted USDC on the destination chain
    address public owner;
    uint256 public maxFee; // 0 for Standard Transfers (free)
    uint32 public minFinalityThreshold = FINALITY_STANDARD;

    event BridgeInitiated(address indexed recipient, address indexed from, uint256 amount);
    event MintRecipientUpdated(address indexed newMintRecipient);
    event TransferParamsUpdated(uint256 maxFee, uint32 minFinalityThreshold);
    event OwnerUpdated(address indexed newOwner);
    event EmergencyWithdrawal(address indexed owner, uint256 usdcAmount, uint256 ethAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor(address _usdc, address _tokenMessenger, uint32 _destinationDomain, address _mintRecipient) {
        require(_usdc != address(0) && _tokenMessenger != address(0), "Invalid address");
        require(_mintRecipient != address(0), "Invalid recipient");
        usdc = _usdc;
        tokenMessenger = ITokenMessengerV2(_tokenMessenger);
        destinationDomain = _destinationDomain;
        mintRecipient = _mintRecipient;
        owner = msg.sender;
    }

    function bridgeUSDC() external onlyOwner {
        uint256 amount = IERC20Minimal(usdc).balanceOf(address(this));
        require(amount > 0, "No USDC to bridge");

        require(IERC20Minimal(usdc).approve(address(tokenMessenger), amount), "Approve failed");

        tokenMessenger.depositForBurn(
            amount,
            destinationDomain,
            bytes32(uint256(uint160(mintRecipient))),
            usdc,
            bytes32(0), // anyone may call receiveMessage on the destination chain
            maxFee,
            minFinalityThreshold
        );

        emit BridgeInitiated(mintRecipient, msg.sender, amount);
    }

    function setMintRecipient(address _newMintRecipient) external onlyOwner {
        require(_newMintRecipient != address(0), "Invalid address");
        mintRecipient = _newMintRecipient;
        emit MintRecipientUpdated(_newMintRecipient);
    }

    /// @notice Switch between Standard (maxFee 0, threshold 2000) and Fast (maxFee > 0, threshold 1000) transfers.
    function setTransferParams(uint256 _maxFee, uint32 _minFinalityThreshold) external onlyOwner {
        require(
            _minFinalityThreshold == FINALITY_FAST || _minFinalityThreshold == FINALITY_STANDARD,
            "Invalid finality threshold"
        );
        maxFee = _maxFee;
        minFinalityThreshold = _minFinalityThreshold;
        emit TransferParamsUpdated(_maxFee, _minFinalityThreshold);
    }

    function setOwner(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner address");
        owner = _newOwner;
        emit OwnerUpdated(_newOwner);
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 usdcBalance = IERC20Minimal(usdc).balanceOf(address(this));
        uint256 ethBalance = address(this).balance;

        if (usdcBalance > 0) {
            require(IERC20Minimal(usdc).transfer(owner, usdcBalance), "USDC transfer failed");
        }

        if (ethBalance > 0) {
            (bool success, ) = payable(owner).call{value: ethBalance}("");
            require(success, "ETH transfer failed");
        }

        emit EmergencyWithdrawal(owner, usdcBalance, ethBalance);
    }

    receive() external payable {}
}
