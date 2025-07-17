import assert from 'assert'
import { type DeployFunction } from 'hardhat-deploy/types'

// RUN: npx hardhat lz:deploy

const contractName = 'TitnVesting'

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments, run } = hre

    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')

    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)

    const deploymentTitn = await deployments.get('Titn')
    const startTimestamp = 1754006400000
    const vestingDurationInYears = 3
    const vestingDuration = vestingDurationInYears * 365 * 24 * 60 * 60 * 1000

    const { address } = await deploy(contractName, {
        from: deployer,
        args: [deploymentTitn.address, startTimestamp, vestingDuration],
        log: true,
        skipIfAlreadyDeployed: false,
    })

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)
    try {
        console.log(`Verifying contract...`)
        await run('verify:verify', {
            address,
            constructorArguments: [deploymentTitn.address, startTimestamp, vestingDuration],
            contract: 'contracts/TitnVesting.sol:TitnVesting',
        })
        console.log(`Verified contract at ${address} ✅`)
    } catch (err) {
        console.error(`Verification failed 🛑:`, err)
    }
}

deploy.tags = [contractName]

export default deploy
