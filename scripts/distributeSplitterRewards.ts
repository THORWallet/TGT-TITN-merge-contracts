import axios from 'axios'
import hre from 'hardhat'
import { sendSlackMessage } from './utils/slack'
import { displayNumber } from './utils/display-number'

// RUN: npx hardhat run scripts/distributeSplitterRewards.ts --network base
// COMPILE & RUN on PM2:
// 1. npx tsc scripts/distributeSplitterRewards.ts --outDir dist/
// 2. pm2 start dist/distributeSplitterRewards.js --name splitter-rewards-distributor

const THRESHOLD = '100' // USDC

async function loop() {
    const { deployments, ethers } = hre
    const [signer] = await ethers.getSigners()
    const distributeThreshold = ethers.utils.parseUnits(THRESHOLD, 6)

    const BASE_USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'

    console.log(
        `🟢 Splitter Rewards distributor started on ${hre.network.name}. Will wait for the USDC balance to be greater than ${THRESHOLD} to distribute.`
    )

    // Initialize contracts
    const splitter = await deployments.get('ERC20Splitter3Way')
    const splitterContract = new ethers.Contract(splitter.address, splitter.abi, signer)

    const usdc = new ethers.Contract(
        BASE_USDC_ADDRESS,
        [
            'function balanceOf(address account) external view returns (uint256)',
            'function decimals() view returns (uint8)',
        ],
        signer
    )

    while (true) {
        try {
            const balance = await usdc.balanceOf(splitter.address)
            const readable = ethers.utils.formatUnits(balance, 6)
            console.log(`[${new Date().toISOString()}] Splitter balance: ${readable} USDC`)

            if (balance.gte(distributeThreshold)) {
                console.log('🚀 Threshold met, triggering distribution')
                await distributeRewards(splitterContract, Number(readable), signer)
            } else {
                console.log('🕒 Threshold not met, checking again in 60 seconds...')
            }
        } catch (e: any) {
            console.error('Error during check/bridge:', e.message)
        }

        await new Promise((res) => setTimeout(res, 60000)) // Wait 60s before next check
    }
}

async function distributeRewards(splitter: any, amount: number, signer: any) {
    try {
        console.log(`Initialising distribution`)
        const tx = await splitter.connect(signer).distribute()
        await tx.wait()

        await sendSlackMessage(
            `🔀 3-Way-Splitter distributed \`${displayNumber(amount.toFixed(0), false, true)} USDC\` | <https://basescan.org/tx/${tx.hash}|TX>`
        )
        console.log(`✅ Distribution completed for USDC ${displayNumber(amount.toFixed(0), false, true)}`)
    } catch (err: any) {
        console.error('Distribution failed 🛑', err)
        await sendSlackMessage(`🔀🛑 3-Way-Splitter distribution failed: ${err.msg} `)
    }
}

loop().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
