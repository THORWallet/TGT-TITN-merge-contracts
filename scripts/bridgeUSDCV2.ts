import axios from 'axios'
import fs from 'fs'
import path from 'path'
import hre from 'hardhat'
import { sendSlackMessage } from './utils/slack'
import { displayNumber } from './utils/display-number'

// Same flow as bridgeUSDC.ts, but on Circle CCTP V2 (CCTP V1 shuts down Dec 1, 2026), watching every
// USDCBridgeV2 in SOURCES (Ethereum and Arbitrum) from a single process. Destination is always Base
// (the splitter set as mintRecipient in each USDCBridgeV2).
//
// RUN: npx hardhat run scripts/bridgeUSDCV2.ts
// PM2: pm2 start ecosystem.config.js --only bridge-usdc-v2
//
// Optional env vars:
//   BRIDGE_NETWORKS=arbitrumOne  only watch these networks (comma separated, default: all in SOURCES)
//   BRIDGE_THRESHOLD=10          bridge once a balance is >= this many USDC (default 100)
//   DRY_RUN=true                 run all checks + gas estimates, post the result to Slack, send no tx, exit
//   RESUME_TX=0x...              finish an already-sent burn on any source chain (attest + mint on Base), exit

// see: https://developers.circle.com/cctp/evm-smart-contracts (V2 addresses are the same on every chain)
const MESSAGE_TRANSMITTER_V2 = '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64'
const BASE_RPC = 'https://mainnet.base.org'

interface SourceConfig {
    network: string // hardhat network name (RPC url + deployments folder)
    label: string
    domain: number // CCTP domain id
    usdc: string
    explorer: string
}

const SOURCES: SourceConfig[] = [
    {
        network: 'ethereum',
        label: 'ETH',
        domain: 0,
        usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        explorer: 'https://etherscan.io',
    },
    {
        network: 'arbitrumOne',
        label: 'ARB',
        domain: 3,
        usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        explorer: 'https://arbiscan.io',
    },
]

const BRIDGE_THRESHOLD = process.env.BRIDGE_THRESHOLD || '100' // USDC
const DRY_RUN = process.env.DRY_RUN === 'true'
const RESUME_TX = process.env.RESUME_TX
const CHECK_INTERVAL = 60_000
const ATTESTATION_POLL_INTERVAL = 30_000
const ATTESTATION_TIMEOUT = 90 * 60_000 // Standard Transfers wait for (Ethereum) finality, usually ~15-20 min

const ERC20_ABI = ['function balanceOf(address account) external view returns (uint256)']
const TRANSMITTER_ABI = [
    'function receiveMessage(bytes message, bytes attestation) external returns (bool)',
    'function usedNonces(bytes32 nonce) external view returns (uint256)',
]

interface CircleMessage {
    message: string
    attestation: string
    eventNonce: string
    status: string
    decodedMessage?: { decodedMessageBody?: { amount?: string } }
}

interface Source extends SourceConfig {
    route: string
    provider: any
    bridge: any
    usdc: any
}

const { ethers } = hre
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const formatUsdc = (amount: any) => ethers.utils.formatUnits(amount, 6)
const display = (amount: any) => displayNumber(Number(formatUsdc(amount)).toFixed(0), false, true)
const log = (route: string, ...args: any[]) => console.log(`[${new Date().toISOString()}] [${route}]`, ...args)

// Both source loops send receiveMessage from the same wallet on Base: serialise those txs to avoid nonce clashes
let baseTxLock: Promise<unknown> = Promise.resolve()
const withBaseTxLock = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = baseTxLock.then(fn, fn)
    baseTxLock = run.catch(() => undefined)
    return run
}

async function main() {
    // Same as bridgeUSDC.ts: PRIVATE_KEY is the bridge owner and pays gas on every chain
    const privateKey = process.env.PRIVATE_KEY
    if (!privateKey) throw new Error('Missing PRIVATE_KEY in env')

    const baseProvider = new ethers.providers.StaticJsonRpcProvider(BASE_RPC, 8453)
    const baseWallet = new ethers.Wallet(privateKey, baseProvider)
    const transmitter = new ethers.Contract(MESSAGE_TRANSMITTER_V2, TRANSMITTER_ABI, baseWallet)

    const enabled = (process.env.BRIDGE_NETWORKS || SOURCES.map((s) => s.network).join(','))
        .split(',')
        .map((n) => n.trim())
    const sources: Source[] = SOURCES.filter((s) => enabled.includes(s.network)).map((s) =>
        initSource(s, privateKey)
    )
    if (!sources.length) throw new Error(`No sources enabled (BRIDGE_NETWORKS=${process.env.BRIDGE_NETWORKS})`)

    // Preflight: the wallet must own every bridge
    const baseBalance = await baseWallet.getBalance()
    const gasLines = [`\`${ethers.utils.formatEther(baseBalance).slice(0, 7)} ETH\` on Base`]
    for (const s of sources) {
        const owner: string = await s.bridge.owner()
        if (owner.toLowerCase() !== baseWallet.address.toLowerCase()) {
            throw new Error(`[${s.route}] Wallet ${baseWallet.address} is not the USDCBridgeV2 owner (${owner})`)
        }
        const balance = await s.provider.getBalance(baseWallet.address)
        gasLines.unshift(`\`${ethers.utils.formatEther(balance).slice(0, 7)} ETH\` on ${s.network}`)
        log(s.route, `Bridge: ${s.bridge.address}`)
    }
    const gasBalances = `Gas: ${gasLines.join(', ')}`
    console.log(`Wallet: ${baseWallet.address} | ${gasBalances}`)

    if (RESUME_TX) {
        const source = await findSourceOfTx(sources, RESUME_TX)
        await mintOnBase(source, RESUME_TX, transmitter, baseProvider)
        return
    }

    if (DRY_RUN) {
        const lines: string[] = []
        for (const s of sources) {
            const balance = await s.usdc.balanceOf(s.bridge.address)
            let gasInfo = ''
            if (!balance.isZero()) {
                const gas = await s.bridge.estimateGas.bridgeUSDC()
                const fees = await feeOverrides(s.provider)
                gasInfo = ` | bridgeUSDC() gas estimate: ${gas.toString()} (max ~${ethers.utils.formatEther(gas.mul(fees.maxFeePerGas)).slice(0, 8)} ETH)`
            }
            lines.push(`${s.route}: balance \`${formatUsdc(balance)} USDC\`${gasInfo}`)
        }
        const msg = `🌈🧪 USDC Bridge V2 dry run OK (threshold \`${BRIDGE_THRESHOLD} USDC\`)\n${lines.join('\n')}\n${gasBalances}`
        console.log(msg)
        await sendSlackMessage(msg)
        return
    }

    console.log(
        `🟢 Bridge watcher started for ${sources.map((s) => s.route).join(', ')}. Will wait for the USDC balance to be greater than ${BRIDGE_THRESHOLD}.`
    )
    await Promise.all(sources.map((s) => watch(s, transmitter, baseProvider)))
}

function initSource(config: SourceConfig, privateKey: string): Source {
    const networkConfig: any = hre.config.networks[config.network]
    if (!networkConfig?.url) throw new Error(`Network ${config.network} is missing in hardhat.config.ts`)
    const provider = new ethers.providers.StaticJsonRpcProvider(networkConfig.url, networkConfig.chainId)
    const wallet = new ethers.Wallet(privateKey, provider)

    const deploymentPath = path.join(hre.config.paths.root, 'deployments', config.network, 'USDCBridgeV2.json')
    if (!fs.existsSync(deploymentPath)) throw new Error(`No USDCBridgeV2 deployment found at ${deploymentPath}`)
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'))

    return {
        ...config,
        route: `${config.label}->BASE`,
        provider,
        bridge: new ethers.Contract(deployment.address, deployment.abi, wallet),
        usdc: new ethers.Contract(config.usdc, ERC20_ABI, provider),
    }
}

// One loop per source chain, so a ~15-20 min attestation wait on one chain doesn't block the other
async function watch(source: Source, transmitter: any, baseProvider: any) {
    const bridgeThreshold = ethers.utils.parseUnits(BRIDGE_THRESHOLD, 6)

    while (true) {
        try {
            const balance = await source.usdc.balanceOf(source.bridge.address)
            log(source.route, `Bridge balance: ${formatUsdc(balance)} USDC`)

            if (!balance.isZero() && balance.gte(bridgeThreshold)) {
                log(source.route, '🚀 Threshold met, triggering bridge flow')
                await handleBridgeFlow(source, balance, transmitter, baseProvider)
            }
        } catch (e: any) {
            console.error(`[${source.route}] Error during check/bridge:`, e.message)
        }

        await sleep(CHECK_INTERVAL)
    }
}

async function handleBridgeFlow(source: Source, amount: any, transmitter: any, baseProvider: any) {
    let burnTx: string | undefined
    try {
        log(source.route, 'Initialising bridge')
        const tx = await source.bridge.bridgeUSDC(await feeOverrides(source.provider))
        burnTx = tx.hash
        await tx.wait()

        log(source.route, '✅ Bridge initiated', tx.hash)
        await sendSlackMessage(
            `🌈 ${source.route} USDC Bridge initialised for \`${display(amount)} USDC\` | <${source.explorer}/tx/${tx.hash}|TX>`
        )

        await mintOnBase(source, tx.hash, transmitter, baseProvider)
    } catch (err: any) {
        console.error(`[${source.route}] Bridge failed 🛑`, err)
        const resumeHint = burnTx ? `\nBurn TX: ${burnTx} (finish with RESUME_TX=${burnTx})` : ''
        await sendSlackMessage(`🌈🛑 ${source.route} Bridge failed: ${err.reason || err.message}${resumeHint}`)
    }
}

async function mintOnBase(source: Source, burnTxHash: string, transmitter: any, baseProvider: any) {
    const messages = await waitForAttestations(source, burnTxHash)

    for (const m of messages) {
        const amount = m.decodedMessage?.decodedMessageBody?.amount
        const used = await transmitter.usedNonces(m.eventNonce)
        if (!used.isZero()) {
            log(source.route, `Message ${m.eventNonce} was already received on Base`)
            await sendSlackMessage(
                `🌈 ${source.route} Bridge: message already received on Base (relayed by someone else) ✅`
            )
            continue
        }

        const txHash = await withBaseTxLock(async () => {
            const tx = await transmitter.receiveMessage(m.message, m.attestation, await feeOverrides(baseProvider))
            await tx.wait()
            return tx.hash as string
        })

        log(source.route, `✅ Message successfully received on Base! TX hash: ${txHash}`)
        await sendSlackMessage(
            `🌈 ${source.route} Bridge completed ✅ \`${amount ? display(amount) : '?'} USDC\` minted to the splitter on Base | <https://basescan.org/tx/${txHash}|TX>`
        )
    }
}

// CCTP V2: the attestation is looked up by source domain + tx hash (V1 used the message hash)
const waitForAttestations = async (source: Source, txHash: string): Promise<CircleMessage[]> => {
    log(source.route, '📡 Polling Circle for attestation...')
    const started = Date.now()

    while (Date.now() - started < ATTESTATION_TIMEOUT) {
        try {
            const res = await axios.get(
                `https://iris-api.circle.com/v2/messages/${source.domain}?transactionHash=${txHash}`,
                { validateStatus: () => true }
            )
            const messages: CircleMessage[] = res.status === 200 ? res.data.messages || [] : []
            if (messages.length && messages.every((m) => m.status === 'complete' && m.attestation?.startsWith('0x'))) {
                log(source.route, '✅ Attestation received')
                return messages
            }
            const status = messages.map((m) => m.status).join(', ') || `not indexed yet (HTTP ${res.status})`
            log(source.route, `⏳ Still pending... (${status})`)
        } catch (e: any) {
            log(source.route, 'Iris API error:', e.message)
        }
        await sleep(ATTESTATION_POLL_INTERVAL)
    }

    throw new Error(`Timed out waiting for Circle attestation`)
}

const findSourceOfTx = async (sources: Source[], txHash: string): Promise<Source> => {
    for (const s of sources) {
        if (await s.provider.getTransactionReceipt(txHash)) return s
    }
    throw new Error(`RESUME_TX ${txHash} not found on ${sources.map((s) => s.network).join(', ')}`)
}

// EIP-1559 fees using the node's suggested tip (ethers v5 defaults to a 1.5 gwei tip, which overpays on L1)
const feeOverrides = async (provider: any) => {
    const [block, tip] = await Promise.all([
        provider.getBlock('latest'),
        provider.send('eth_maxPriorityFeePerGas', []).then(ethers.BigNumber.from),
    ])
    return { maxPriorityFeePerGas: tip, maxFeePerGas: block.baseFeePerGas.mul(2).add(tip) }
}

main().catch(async (error) => {
    console.error(error)
    await sendSlackMessage(`🌈🛑 USDC Bridge V2 bot stopped: ${error.reason || error.message}`)
    process.exitCode = 1
})
