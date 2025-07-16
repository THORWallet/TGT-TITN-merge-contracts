import axios from 'axios'
import hre from 'hardhat'

// RUN: npx hardhat run scripts/bridgeUSDC.ts --network arbitrumOne
// COMPILE & RUN on PM2:
// 1. npx tsc scripts/bridgeUSDC.ts --outDir dist/
// 2. pm2 start dist/bridgeUSDC.js --name bridge-watcher

// see: https://developers.circle.com/stablecoins/evm-smart-contracts#tokenmessenger-mainnet
const TOKEN_MESSENGER = '0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca'
const MESSAGE_TRANSMITTER = '0xAD09780d193884d503182aD4588450C416D6F9D4'

const ARBITRUM_USDC = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'

const ABI = ['event MessageSent(bytes message)']
const BRIDGE_THRESHOLD = '100' // USDC

async function loop() {
    const { deployments, ethers } = hre
    const [signer] = await ethers.getSigners()
    const bridgeThreshold = ethers.utils.parseUnits(BRIDGE_THRESHOLD, 6)

    console.log(
        `🟢 Bridge watcher started on ${hre.network.name}. Will wait for the USDC balance to be greater than ${BRIDGE_THRESHOLD}.`
    )

    // Initialize contracts
    const bridgeContract = await deployments.get('USDCBridge')
    const bridge = new ethers.Contract(bridgeContract.address, bridgeContract.abi, signer)

    const usdc = new ethers.Contract(
        ARBITRUM_USDC,
        [
            'function balanceOf(address account) external view returns (uint256)',
            'function decimals() view returns (uint8)',
        ],
        signer
    )

    while (true) {
        try {
            const balance = await usdc.balanceOf(bridge.address)
            const readable = ethers.utils.formatUnits(balance, 6)
            console.log(`[${new Date().toISOString()}] Bridge balance: ${readable} USDC`)

            if (balance.gte(bridgeThreshold)) {
                console.log('🚀 Threshold met, triggering bridge flow')
                await handleBridgeFlow(bridge, usdc, signer, ethers)
            } else {
                console.log('🕒 Threshold not met, checking again in 60 seconds...')
            }
        } catch (e: any) {
            console.error('Error during check/bridge:', e.message)
        }

        await new Promise((res) => setTimeout(res, 60000)) // Wait 60s before next check
    }
}

async function handleBridgeFlow(bridge: any, usdc: any, signer: any, ethers: any) {
    try {
        console.log(`Initialising bridge`)
        const tx = await bridge.connect(signer).bridgeUSDC()
        const receipt = await tx.wait()

        console.log('✅ Bridge initiated')

        // Optional: get your own event if needed
        const event = receipt.events?.find((e: any) => e.event === 'BridgeInitiated')
        const nonce = event?.args?.nonce
        console.log('Bridge nonce:', nonce?.toString())

        // Extract the MessageSent event from the MessageTransmitter
        const msg = getMessageFromLogs(receipt.logs, ethers)
        if (!msg) throw new Error('Failed to get message hash from logs')
        console.log('📦 Message:', msg.message)
        console.log('📦 Message hash:', msg.messageHash)

        const attestation = await waitForAttestation(msg.messageHash)
        const receiveFunds = await receiveMessage(attestation, msg.message, ethers)

        console.log(`Bridge completed`, receiveFunds)
    } catch (err) {
        console.error('Bridge failed 🛑', err)
    }
}

const receiveMessage = async (attestation: string, message: string, ethers: any): Promise<boolean> => {
    try {
        const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org')
        const privateKey = process.env.PRIVATE_KEY
        if (!privateKey) throw new Error('Missing PRIVATE_KEY in env')

        const wallet = new ethers.Wallet(privateKey, provider)

        const messageTransmitterAddress = MESSAGE_TRANSMITTER // MessageTransmitter on Base
        const abi = [
            'function receiveMessage(bytes message, bytes attestation) external returns (bool)',
            'event MessageReceived(bytes message)',
        ]

        const contract = new ethers.Contract(messageTransmitterAddress, abi, wallet)

        const tx = await contract.receiveMessage(message, attestation, {
            gasLimit: 1_000_000, // adjust if needed
        })
        await tx.wait()

        console.log(`✅ Message successfully received on Base! TX hash: ${tx.hash}`)
        return true
    } catch (e: any) {
        console.log('receiveMessage failed', e.message)
        return false
    }
}

const getMessageFromLogs = (logs: any, ethers: any): { message: string; messageHash: string } | false => {
    try {
        const iface = new ethers.utils.Interface(ABI)
        const messageLog = logs.find(
            (log: any) =>
                log.address.toLowerCase() === TOKEN_MESSENGER.toLowerCase() &&
                log.topics[0] === iface.getEventTopic('MessageSent')
        )

        if (!messageLog) {
            throw new Error('❌ Could not find MessageSent event')
        }

        const decoded = iface.decodeEventLog('MessageSent', messageLog.data)
        const message: string = decoded.message
        const messageHash = ethers.utils.keccak256(message)
        return { message, messageHash }
    } catch (e: any) {
        console.log('getMessageHashFromLogs failed', e.message)
        return false
    }
}

const waitForAttestation = async (messageHash: string): Promise<string> => {
    console.log('📡 Polling Circle for attestation...')

    while (true) {
        const res = await axios.get(`https://iris-api.circle.com/v1/attestations/${messageHash}`)

        if (res.data.status === 'complete' && res.data.attestation !== 'PENDING') {
            console.log('✅ Attestation received', res.data.attestation)
            return res.data.attestation
        }

        console.log(`⏳ Still pending... (${res.data.status}) ${new Date().toISOString()}`)
        await new Promise((resolve) => setTimeout(resolve, 30000))
    }
}

loop().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
