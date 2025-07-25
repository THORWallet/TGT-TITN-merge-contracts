import axios from 'axios'
import hre from 'hardhat'
import { sendSlackMessage } from './utils/slack'
import { displayNumber } from './utils/display-number'
const fs = require('fs')
const path = require('path')

// RUN: npx hardhat run scripts/stakingStatsBot.ts --network base
// COMPILE & RUN on PM2:
// 1. npx tsc scripts/stakingStatsBot.ts --outDir dist/
// 2. pm2 start dist/stakingStatsBot.js --name stakin-stats-bot

async function loop() {
    const { deployments, ethers } = hre
    const [signer] = await ethers.getSigners()

    const provider = new ethers.providers.JsonRpcProvider('https://arb1.arbitrum.io/rpc')
    const privateKey = process.env.PRIVATE_KEY
    if (!privateKey) throw new Error('Missing PRIVATE_KEY in env')

    const arbWallet = new ethers.Wallet(privateKey, provider)

    console.log(`🟢 Staking Stats Bot started on ${hre.network.name}.`)

    // Initialize contracts
    const titn = await deployments.get('Titn')
    const baseTitnContract = new ethers.Contract(titn.address, titn.abi, signer)
    const arbTitnContract = new ethers.Contract(titn.address, titn.abi, arbWallet)

    const ARB_TGT = '0x429fed88f10285e61b12bdf00848315fbdfcc341'
    const arbTgtContract = new ethers.Contract(ARB_TGT, titn.abi, arbWallet)

    // Path to deployment file
    const deploymentPath = path.join(__dirname, '../deployments/arbitrumOne', `MergeTgt.json`)

    if (!fs.existsSync(deploymentPath)) {
        throw new Error(`Deployment file not found at ${deploymentPath}`)
    }

    const mergeJson = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'))
    const arbMergeContract = new ethers.Contract(mergeJson.address, mergeJson.abi, arbWallet)

    const STAKING_CONTRACT = '0x269E9c0e300dd6c84A38b5781551BF767b2B5327'

    let baseTitnStakedAmount = 72137832
    let arbTitnInMergeAmount = 139351994
    let arbTgtInMergeAmount = 89133924
    let tgtMergedPercent = 20

    while (true) {
        try {
            // get staked TITN amount
            const balance = await baseTitnContract.balanceOf(STAKING_CONTRACT)
            const readable = ethers.utils.formatUnits(balance, 18)
            let newBaseTitnStakedAmount = Number(readable)

            // get amount of TITN in the merge contract
            const balanceMerge = await arbTitnContract.balanceOf(mergeJson.address)
            const readable1 = ethers.utils.formatUnits(balanceMerge, 18)
            let newArbTitnInMergeAmount = Number(readable1)

            const tgtBalanceMerge = await arbTgtContract.balanceOf(mergeJson.address)
            const readable2 = ethers.utils.formatUnits(tgtBalanceMerge, 18)
            let newArbTgtInMergeAmount = Number(readable2)

            if (
                newBaseTitnStakedAmount > baseTitnStakedAmount ||
                newArbTitnInMergeAmount > arbTitnInMergeAmount ||
                newArbTgtInMergeAmount > arbTgtInMergeAmount
            ) {
                console.log(`🕋 Staked TITN \`${displayNumber(Number(readable), false, false)} TITN\``)
                console.log(`🔀 TITN In Merge SC \`${displayNumber(Number(readable1), false, false)} TITN\``)
                console.log(`📦 TGT In Merge SC  \`${displayNumber(Number(readable2), false, false)} TGT\``)

                const change1 =
                    newBaseTitnStakedAmount > baseTitnStakedAmount ? newBaseTitnStakedAmount - baseTitnStakedAmount : -1
                // const change2 =
                //     newArbTitnInMergeAmount > arbTitnInMergeAmount ? newArbTitnInMergeAmount - arbTitnInMergeAmount : -1
                // const change3 =
                //     newArbTgtInMergeAmount > arbTgtInMergeAmount ? newArbTgtInMergeAmount - arbTgtInMergeAmount : -1

                const newTgtMergedPercent = (newArbTgtInMergeAmount * 100) / 444800000

                await sendSlackMessage(
                    `
🕋 Staked TITN \`${displayNumber(Number(readable), false, false)} TITN\` ${change1 !== -1 ? (change1 > 0 ? `  🔼 \`${displayNumber(Number(change1), false, false)}\`` : `  🔽 \`${displayNumber(Number(change1), false, false)}\``) : ''}
📈 TGT Merged  \`${Number(newTgtMergedPercent).toFixed(2)}%\` | \`${displayNumber(Number(readable2), false, false)} TGT\``
                )

                // 🔀 TITN In Merge SC \`${displayNumber(Number(readable1), false, false)} TITN\` ${change2 !== -1 ? (change2 > 0 ? `  🔼 ${displayNumber(Number(change2), false, false)}` : `  🔽 ${displayNumber(Number(change2), false, false)}`) : ''}
                // 📦 TGT In Merge SC  \`${displayNumber(Number(readable2), false, false)} TGT\` ${change3 !== -1 ? (change3 > 0 ? `  🔼 ${displayNumber(Number(change3), false, false)}` : `  🔽 ${displayNumber(Number(change3), false, false)}`) : ''}

                baseTitnStakedAmount = newBaseTitnStakedAmount
                arbTitnInMergeAmount = newArbTitnInMergeAmount
                arbTgtInMergeAmount = newArbTgtInMergeAmount
                tgtMergedPercent = newTgtMergedPercent
            }
        } catch (e: any) {
            console.error('Error', e.message)
        }

        await new Promise((res) => setTimeout(res, 60000)) // Wait 60s before next check
    }
}

loop().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
