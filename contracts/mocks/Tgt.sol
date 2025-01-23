// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Tgt is ERC20, Ownable {
    constructor(
        string memory _name,
        string memory _symbol,
        address _delegate,
        uint256 initialMintAmount
    ) ERC20(_name, _symbol) Ownable(_delegate) {
        _mint(msg.sender, initialMintAmount);
    }
}
