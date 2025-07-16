import assert from 'assert'
import { ethers } from 'hardhat'
import { type DeployFunction } from 'hardhat-deploy/types'

// RUN: npx hardhat lz:deploy

const contractName = 'USDCBridge'

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments, run } = hre

    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')

    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)

    const ARBITRUM_USDC_ADDRESS = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
    const BASE_USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' // not needed as we'll only deploy on arbitrum

    // CCTP contracts: https://developers.circle.com/stablecoins/evm-smart-contracts#tokenmessenger-mainnet
    const TOKEN_MESSANGER = '0x19330d10D9Cc8751218eaf51E8885D058642E08A' // Arbitrum
    const usdcAddress = hre.network.name === 'arbitrumOne' ? ARBITRUM_USDC_ADDRESS : BASE_USDC_ADDRESS
    const destinationDomain = hre.network.name === 'arbitrumOne' ? 6 : 3 // if deploying on arbitrum the destination is base therefore it's 6 otherwise it's 3

    const recipient = '0x76a3B8FeA6F6C7D7af5B47885563955F3ACd9BC2' // splitter contract on Base

    const { address } = await deploy(contractName, {
        from: deployer,
        args: [usdcAddress, TOKEN_MESSANGER, destinationDomain, recipient],
        log: true,
        skipIfAlreadyDeployed: false,
    })

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)
    try {
        console.log(`Verifying contract...`)
        await run('verify:verify', {
            address,
            constructorArguments: [usdcAddress, TOKEN_MESSANGER, destinationDomain, recipient],
            contract: 'contracts/USDCBridge.sol:USDCBridge',
        })
        console.log(`Verified contract at ${address} ✅`)
    } catch (err) {
        console.error(`Verification failed 🛑:`, err)
    }
}

deploy.tags = [contractName]

export default deploy
