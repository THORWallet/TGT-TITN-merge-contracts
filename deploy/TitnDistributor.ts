import assert from 'assert'
import { type DeployFunction } from 'hardhat-deploy/types'

// RUN: npx hardhat lz:deploy --tags TitnDistributor

const contractName = 'TitnDistributor'

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments, run } = hre

    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')
    assert(
        hre.network.name === 'base' || hre.network.name === 'hardhat',
        `TitnDistributor is intended for Base; got network ${hre.network.name}`
    )

    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)

    const deploymentTitn = await deployments.get('Titn')
    const titnAddress = deploymentTitn.address

    console.log(`TITN: ${titnAddress}`)

    const { address } = await deploy(contractName, {
        from: deployer,
        args: [titnAddress],
        log: true,
        skipIfAlreadyDeployed: false,
    })

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)

    if (hre.network.name === 'hardhat') {
        return
    }

    console.log(`Waiting 30 seconds for block explorer to index the contract...`)
    await new Promise((resolve) => setTimeout(resolve, 30000))
    try {
        console.log(`Verifying contract...`)
        await run('verify:verify', {
            address,
            constructorArguments: [titnAddress],
            contract: 'contracts/TitnDistributor.sol:TitnDistributor',
        })
        console.log(`Verified contract at ${address} ✅`)
    } catch (err) {
        console.error(`Verification failed 🛑:`, err)
    }
}

deploy.tags = [contractName]

export default deploy
