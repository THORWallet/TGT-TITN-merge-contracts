// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ITokenMessenger.sol";

interface IUSDC {
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

contract USDCBridge {
    address public immutable usdc;
    ITokenMessenger public circleTokenMessenger;
    uint32 public immutable destinationDomain; // e.g., Base = 1650553709
    address public destinationCaller; // target contract on Base
    address public owner;

    event BridgeInitiated(address indexed recipient, address indexed from, uint256 amount, uint64 nonce);
    event DestinationCallerUpdated(address indexed newDestinationCaller);
    event OwnerUpdated(address indexed newOwner);
    event EmergencyWithdrawal(address indexed owner, uint256 usdcAmount, uint256 ethAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor(address _usdc, address _circleTokenMessenger, uint32 _destinationDomain, address _destinationCaller) {
        usdc = _usdc;
        destinationDomain = _destinationDomain;
        destinationCaller = _destinationCaller;
        owner = msg.sender;
        circleTokenMessenger = ITokenMessenger(_circleTokenMessenger);
    }

    function bridgeUSDC() external onlyOwner {
        uint256 amount = IUSDC(usdc).balanceOf(address(this));
        require(amount > 0, "No USDC to bridge");

        // Approve USDC to be burned by the protocol
        IUSDC(usdc).approve(address(circleTokenMessenger), IUSDC(usdc).balanceOf(address(this)));

        uint64 nonce = circleTokenMessenger.depositForBurn(
            amount,
            destinationDomain,
            bytes32(uint256(uint160(destinationCaller))),
            usdc
        );

        emit BridgeInitiated(destinationCaller, msg.sender, amount, nonce);
    }

    function setDestinationCaller(address _newDestinationCaller) external onlyOwner {
        require(_newDestinationCaller != address(0), "Invalid address");
        destinationCaller = _newDestinationCaller;
        emit DestinationCallerUpdated(_newDestinationCaller);
    }

    function setOwner(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner address");
        owner = _newOwner;
        emit OwnerUpdated(_newOwner);
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 usdcBalance = IUSDC(usdc).balanceOf(address(this));
        uint256 ethBalance = address(this).balance;

        if (usdcBalance > 0) {
            require(IUSDC(usdc).transfer(owner, usdcBalance), "USDC transfer failed");
        }

        if (ethBalance > 0) {
            (bool success, ) = payable(owner).call{ value: ethBalance }("");
            require(success, "ETH transfer failed");
        }

        emit EmergencyWithdrawal(owner, usdcBalance, ethBalance);
    }

    receive() external payable {}
}
