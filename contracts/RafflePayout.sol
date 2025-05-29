// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract RafflePayout {
    address public owner;
    address public delegate; // can submit raffle winners (call the finalizeRaffle function)
    IERC20 public usdc;
    uint256 public constant CLAIM_DURATION = 30 days;
    uint256 public lockedAmount; // USDC reserved to winners

    struct Raffle {
        uint256 totalAmount;
        uint256 timestamp;
        bool finalized;
        mapping(address => uint256) winners; // winner => amount
        mapping(address => bool) claimed;
    }

    mapping(uint256 => Raffle) private raffles;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyOwnerOrDelegate() {
        require(msg.sender == owner || msg.sender == delegate, "Not authorized");
        _;
    }

    function setDelegate(address _delegate) external onlyOwner {
        delegate = _delegate;
    }

    event RaffleFinalized(uint256 indexed raffleId, uint256 totalAmount, uint256 timestamp);
    event Claimed(address indexed winner, uint256 indexed raffleId, uint256 amount);
    event ExpiredFundsRecovered(uint256 indexed raffleId, uint256 amount);

    constructor(address _usdc) {
        owner = msg.sender;
        usdc = IERC20(_usdc);
    }

    function finalizeRaffle(
        uint256 raffleId,
        address[] calldata winners,
        uint256[] calldata amounts,
        uint256 totalAmount
    ) external onlyOwnerOrDelegate {
        require(!raffles[raffleId].finalized, "Already finalized");
        require(winners.length == amounts.length, "Length mismatch");

        require(usdc.balanceOf(address(this)) >= lockedAmount + totalAmount, "Insufficient available USDC in contract");

        Raffle storage raffle = raffles[raffleId];
        raffle.totalAmount = totalAmount;
        raffle.timestamp = block.timestamp;
        raffle.finalized = true;

        for (uint i = 0; i < winners.length; i++) {
            require(winners[i] != address(0), "Zero address");
            require(amounts[i] > 0, "Zero amount");
            raffle.winners[winners[i]] = amounts[i];
        }

        lockedAmount += totalAmount;

        emit RaffleFinalized(raffleId, totalAmount, block.timestamp);
    }

    function claim(uint256 raffleId) external {
        Raffle storage raffle = raffles[raffleId];
        require(raffle.finalized, "Not finalized");
        require(block.timestamp <= raffle.timestamp + CLAIM_DURATION, "Claim period expired");

        uint256 amount = raffle.winners[msg.sender];
        require(amount > 0, "Not a winner");
        require(!raffle.claimed[msg.sender], "Already claimed");

        raffle.claimed[msg.sender] = true;
        require(usdc.transfer(msg.sender, amount), "USDC transfer failed");

        lockedAmount -= amount;

        emit Claimed(msg.sender, raffleId, amount);
    }

    function recoverExpiredFunds(uint256 raffleId, address[] calldata unclaimedWinners) external onlyOwner {
        Raffle storage raffle = raffles[raffleId];
        require(raffle.finalized, "Not finalized");
        require(block.timestamp > raffle.timestamp + CLAIM_DURATION, "Claim period not expired");

        uint256 reclaimed;

        for (uint i = 0; i < unclaimedWinners.length; i++) {
            address winner = unclaimedWinners[i];
            if (!raffle.claimed[winner] && raffle.winners[winner] > 0) {
                uint256 amount = raffle.winners[winner];
                raffle.claimed[winner] = true; // mark as claimed to prevent later access
                reclaimed += amount;
            }
        }

        if (reclaimed > 0) {
            require(usdc.transfer(owner, reclaimed), "USDC refund failed");
            lockedAmount -= reclaimed;
            emit ExpiredFundsRecovered(raffleId, reclaimed);
        }
    }

    function getClaimable(address user, uint256 raffleId) external view returns (uint256) {
        Raffle storage raffle = raffles[raffleId];
        if (!raffle.finalized || raffle.claimed[user]) return 0;
        if (block.timestamp > raffle.timestamp + CLAIM_DURATION) return 0;
        return raffle.winners[user];
    }

    function updateOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        owner = newOwner;
    }

    function getAvailableUsdc() external view returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        return balance > lockedAmount ? balance - lockedAmount : 0;
    }
}
