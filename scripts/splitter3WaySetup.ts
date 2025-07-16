import hre from 'hardhat'

// RUN: npx hardhat run scripts/splitter3WaySetup.ts --network arbitrumOne
// RUN: npx hardhat run scripts/splitter3WaySetup.ts --network base

async function main() {
    const { deployments, ethers } = hre
    const [signer] = await ethers.getSigners()
    console.log(`Network: ${hre.network.name}`)

    // PARAMS
    const ARBITRUM_USDC_ADDRESS = '0x' // not needed as we only deploy on base
    const BASE_USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    const AFFILIATE_ADDRESS = '0x19Dd3215A1C7CA4459d9C9F277654E5D266737dc'
    const ARBITRUM_STAKING_ADDRESS = '0x' // not needed as we only deploy on base
    const BASE_STAKING_ADDRESS = '0x269E9c0e300dd6c84A38b5781551BF767b2B5327'
    const BASE_RUFFLE_ADDRESS = '0x583ecd462E6a8f3bBBa71eC3A3AaB53a7b6C01C0'
    const ARBITRUM_RUFFLE_ADDRESS = '0x' // not needed as we only deploy on base

    // Initialize contract
    const deploymentSplitter = await deployments.get('ERC20Splitter3Way')
    const splitter = new ethers.Contract(deploymentSplitter.address, deploymentSplitter.abi, signer)

    try {
        console.log(`Initialting splitter setup steps:`)
        await splitter.setToken(hre.network.name === 'arbitrumOne' ? ARBITRUM_USDC_ADDRESS : BASE_USDC_ADDRESS)
        console.log(`1/2 splitter.setToken(usdcAddress) ✅`)
        await splitter.setRecipients(
            [
                AFFILIATE_ADDRESS,
                hre.network.name === 'arbitrumOne' ? ARBITRUM_STAKING_ADDRESS : BASE_STAKING_ADDRESS,
                hre.network.name === 'arbitrumOne' ? ARBITRUM_RUFFLE_ADDRESS : BASE_RUFFLE_ADDRESS,
            ],
            [45, 50, 5]
        )
        console.log(`2/2 splitter.setRecipients([affiliateAddress, stakingAddress, raffle], [45, 50, 5]) ✅`)

        console.log(`Splitter setup steps completed`)
    } catch (err) {
        console.error('Splitter setup steps failed 🛑', err)
    }
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
