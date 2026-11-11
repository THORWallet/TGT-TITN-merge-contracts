import assert from 'assert'
import { type DeployFunction } from 'hardhat-deploy/types'

// RUN: npx hardhat deploy --network <ethereum|arbitrumOne> --tags USDCBridgeV2
// Ethereum is already deployed (0xe62bfbE57763ec24c0F130426F34DbCe11Fc5B06), so this is skipped there.

const contractName = 'USDCBridgeV2'

// CCTP V2 contracts: https://developers.circle.com/cctp/evm-smart-contracts
// TokenMessengerV2 has the same address on every EVM chain.
const TOKEN_MESSENGER_V2 = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d'
const BASE_DOMAIN = 6
const RECIPIENT = '0x76a3B8FeA6F6C7D7af5B47885563955F3ACd9BC2' // splitter contract on Base

const USDC_ADDRESSES: Record<string, string> = {
    ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    arbitrumOne: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
}

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments, run } = hre

    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')
    const usdcAddress = USDC_ADDRESSES[hre.network.name]
    assert(usdcAddress, `${contractName} is not configured for network ${hre.network.name}`)

    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)

    const args = [usdcAddress, TOKEN_MESSENGER_V2, BASE_DOMAIN, RECIPIENT]
    const { address, newlyDeployed } = await deploy(contractName, {
        from: deployer,
        args,
        log: true,
        skipIfAlreadyDeployed: true,
    })

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)
    if (!newlyDeployed) return

    try {
        console.log(`Verifying contract...`)
        await run('verify:verify', {
            address,
            constructorArguments: args,
            contract: 'contracts/USDCBridgeV2.sol:USDCBridgeV2',
        })
        console.log(`Verified contract at ${address} ✅`)
    } catch (err) {
        console.error(`Verification failed 🛑:`, err)
    }
}

deploy.tags = [contractName]

export default deploy
