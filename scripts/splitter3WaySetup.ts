import hre from 'hardhat'

// RUN: npx hardhat run scripts/splitter3WaySetup.ts --network arbitrumOne
// RUN: npx hardhat run scripts/splitter3WaySetup.ts --network base

async function main() {
    const { deployments, ethers } = hre
    const [signer] = await ethers.getSigners()
    console.log(`Network: ${hre.network.name}`)

    // PARAMS
    const ARBITRUM_USDC_ADDRESS = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
    const BASE_USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    const AFFILIATE_ADDRESS = '0x19Dd3215A1C7CA4459d9C9F277654E5D266737dc'
    const ARBITRUM_STAKING_ADDRESS = '0x6745c897ab1f4fda9f7700e8be6ea2ee03672759'
    const BASE_STAKING_ADDRESS = '0xe740ACc1e0233109381187db9801BE9a40FEb77C'
    const BASE_RUFFLE_ADDRESS = BASE_STAKING_ADDRESS // TODO
    const ARBITRUM_RUFFLE_ADDRESS = ARBITRUM_STAKING_ADDRESS // TODO

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
            [10, 30, 60]
        )
        console.log(`2/2 splitter.setRecipients([affiliateAddress, stakingAddress], [10, 30, 60]) ✅`)

        console.log(`Splitter setup steps completed`)
    } catch (err) {
        console.error('Splitter setup steps failed 🛑', err)
    }
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
