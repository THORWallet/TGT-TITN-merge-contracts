import assert from 'assert'
import { type DeployFunction } from 'hardhat-deploy/types'

// RUN: npx hardhat lz:deploy

const contractName = 'LiquidRewards'

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments, run } = hre

    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')

    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)

    const deploymentTitn = await deployments.get('Titn')
    const startTimestamp = 1776297599 // 15th April 2026 23:59:59 (GMT)
    const vestingDurationInDays = 90
    const vestingDuration = vestingDurationInDays * 24 * 60 * 60

    const { address } = await deploy(contractName, {
        from: deployer,
        args: [deploymentTitn.address, startTimestamp, vestingDuration],
        log: true,
        skipIfAlreadyDeployed: false,
    })

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)
    console.log(`Waiting 30 seconds for block explorer to index the contract...`)
    await new Promise((resolve) => setTimeout(resolve, 30000))
    try {
        console.log(`Verifying contract...`)
        await run('verify:verify', {
            address,
            constructorArguments: [deploymentTitn.address, startTimestamp, vestingDuration],
            contract: 'contracts/LiquidRewards.sol:LiquidRewards',
        })
        console.log(`Verified contract at ${address} ✅`)
    } catch (err) {
        console.error(`Verification failed 🛑:`, err)
    }
}

deploy.tags = [contractName]

export default deploy
