// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ERC20Splitter3Way is Ownable {
    address[3] public recipients;
    uint256[3] public percentages;
    IERC20 public token;

    event RecipientsUpdated(address[3] recipients, uint256[3] percentages);
    event TokenUpdated(address token);
    event Distributed(uint256 amount);
    event TokensWithdrawn(address token, uint256 amount);
    event ETHWithdrawn(uint256 amount);

    constructor() Ownable(msg.sender) {}

    function setRecipients(address[3] memory _recipients, uint256[3] memory _percentages) external onlyOwner {
        require(_recipients[0] != address(0), "At least one recipient required");
        uint256 totalPercent = _percentages[0] + _percentages[1] + _percentages[2];
        require(totalPercent == 100, "Percentages must sum to 100");

        recipients = _recipients;
        percentages = _percentages;
        emit RecipientsUpdated(_recipients, _percentages);
    }

    function setToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        token = IERC20(_token);
        emit TokenUpdated(_token);
    }

    function distribute() external {
        require(address(token) != address(0), "Token not set");
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "No tokens to distribute");

        for (uint256 i = 0; i < 3; i++) {
            if (recipients[i] != address(0) && percentages[i] > 0) {
                uint256 amount = (balance * percentages[i]) / 100;
                token.transfer(recipients[i], amount);
            }
        }
        emit Distributed(balance);
    }

    function withdrawTokens(address _token) external onlyOwner {
        require(_token != address(token), "Cannot withdraw primary token");
        IERC20 otherToken = IERC20(_token);
        uint256 balance = otherToken.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        otherToken.transfer(owner(), balance);
        emit TokensWithdrawn(_token, balance);
    }

    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        payable(owner()).transfer(balance);
        emit ETHWithdrawn(balance);
    }
}
