import hre from 'hardhat'

// RUN: npx hardhat run scripts/stakingProxyData.ts --network arbitrumOne

// generates the data required to deploy the proxy contract
// used for the staking contract. It basically encodes the data
// in the `initialize` function in the staking contract.
// Use the output when deploying the TransparentUpgradeableProxy.sol contract

async function main() {
    const { ethers } = hre

    const iface = new ethers.utils.Interface(['function initialize(address,address,uint256)'])
    const data = iface.encodeFunctionData('initialize', [
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // _rewardToken USDC on Base
        '0xE69Bc665F54d49279D0d5279220440Ea23096aba', // _feeCollector
        '0', // _depositFeePercent
    ])
    console.log(data)
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
