// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./interfaces/IERC20.sol";

/// @title UsdcDistributor
/// @notice Owner-managed USDC allocation contract. Owner funds the contract
///         with USDC and assigns per-address allocations. Recipients pull
///         their allocation via claim(). Owner may cancel unclaimed
///         allocations to recover the funds.
/// @dev    Invariant: totalAllocated == sum of unclaimed allocations,
///         and totalAllocated <= USDC.balanceOf(this) at all times.
contract UsdcDistributor {
    IERC20 public immutable usdc;

    address public owner;

    /// @notice Sum of currently-allocated, unclaimed USDC. Reserved for
    ///         recipients; only the surplus above this can be withdrawn
    ///         by the owner via withdrawExcess().
    uint256 public totalAllocated;

    struct Allocation {
        uint256 amount;
        bool claimed;
    }

    mapping(address => Allocation) public allocations;

    event Allocated(address indexed account, uint256 amount);
    event Cancelled(address indexed account, uint256 amount);
    event Claimed(address indexed account, uint256 amount);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event ExcessWithdrawn(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Distributor: not the owner");
        _;
    }

    constructor(address usdcToken) {
        require(usdcToken != address(0), "Distributor: zero usdc");
        usdc = IERC20(usdcToken);
        owner = msg.sender;
        emit OwnerTransferred(address(0), msg.sender);
    }

    /// @notice Transfer ownership to a new address.
    function transferOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Distributor: zero owner");
        require(newOwner != address(this), "Distributor: this contract");
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Add allocations for a list of addresses. Addresses that
    ///         already have an allocation (claimed or unclaimed) are
    ///         silently skipped. Reverts if the contract does not hold
    ///         enough USDC to cover totalAllocated after the additions.
    /// @dev    Reverts on zero address or zero amount entries to catch
    ///         caller-side mistakes early. Cancelled addresses can be
    ///         re-added (cancel deletes the mapping entry).
    function addAllocations(address[] calldata accounts, uint256[] calldata amounts) external onlyOwner {
        require(accounts.length == amounts.length, "Distributor: length mismatch");

        uint256 added;
        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            uint256 amount = amounts[i];

            require(account != address(0), "Distributor: zero account");
            require(amount > 0, "Distributor: zero amount");

            if (allocations[account].amount > 0) {
                // already allocated (claimed or unclaimed) — skip
                continue;
            }

            allocations[account] = Allocation({ amount: amount, claimed: false });
            added += amount;
            emit Allocated(account, amount);
        }

        if (added > 0) {
            totalAllocated += added;
            require(
                totalAllocated <= usdc.balanceOf(address(this)),
                "Distributor: insufficient USDC"
            );
        }
    }

    /// @notice Cancel an unclaimed allocation and return its USDC to the
    ///         owner. The address is removed from the mapping so it can
    ///         be re-added later if desired.
    function cancelAllocation(address account) external onlyOwner {
        Allocation memory a = allocations[account];
        require(a.amount > 0, "Distributor: no allocation");
        require(!a.claimed, "Distributor: already claimed");

        delete allocations[account];
        totalAllocated -= a.amount;

        emit Cancelled(account, a.amount);
        require(usdc.transfer(owner, a.amount), "Distributor: transfer failed");
    }

    /// @notice Claim the caller's full allocation. One-shot per address.
    function claim() external {
        Allocation storage a = allocations[msg.sender];
        require(a.amount > 0, "Distributor: no allocation");
        require(!a.claimed, "Distributor: already claimed");

        uint256 amount = a.amount;
        a.claimed = true;
        totalAllocated -= amount;

        emit Claimed(msg.sender, amount);
        require(usdc.transfer(msg.sender, amount), "Distributor: transfer failed");
    }

    /// @notice Withdraw any USDC held by the contract above what is
    ///         reserved for unclaimed allocations. Useful for recovering
    ///         excess funds without disturbing the allocation accounting.
    function withdrawExcess(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Distributor: zero to");
        uint256 balance = usdc.balanceOf(address(this));
        require(balance >= totalAllocated, "Distributor: invariant broken");
        uint256 excess = balance - totalAllocated;
        require(amount <= excess, "Distributor: exceeds excess");

        emit ExcessWithdrawn(to, amount);
        require(usdc.transfer(to, amount), "Distributor: transfer failed");
    }

    /// @notice View helper for an account's allocation.
    function allocationOf(address account) external view returns (uint256 amount, bool claimed) {
        Allocation memory a = allocations[account];
        return (a.amount, a.claimed);
    }
}
