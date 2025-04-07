import assert from 'assert'
import { type DeployFunction } from 'hardhat-deploy/types'

// RUN: npx hardhat lz:deploy

const contractName = 'ERC20Splitter'

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments, run } = hre

    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')

    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)

    const { address } = await deploy(contractName, {
        from: deployer,
        log: true,
        skipIfAlreadyDeployed: false,
    })

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)
    try {
        console.log(`Verifying contract...`)
        await run('verify:verify', {
            address,
            contract: 'contracts/ERC20Splitter.sol:ERC20Splitter',
        })
        console.log(`Verified contract at ${address} ✅`)
    } catch (err) {
        console.error(`Verification failed 🛑:`, err)
    }
}

deploy.tags = [contractName]

export default deploy
