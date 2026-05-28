// Get the environment configuration from .env file
//
// To make use of automatic environment setup:
// - Duplicate .env.example file and name it .env
// - Fill in the environment variables
import 'dotenv/config'

import 'hardhat-deploy'
import 'hardhat-contract-sizer'
import '@nomiclabs/hardhat-ethers'
import '@layerzerolabs/toolbox-hardhat'
import { HardhatUserConfig, HttpNetworkAccountsUserConfig } from 'hardhat/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'
import '@nomicfoundation/hardhat-verify'

// Set your preferred authentication method
//
// If you prefer using a mnemonic, set a MNEMONIC environment variable
// to a valid mnemonic
const MNEMONIC = process.env.MNEMONIC

// If you prefer to be authenticated using a private key, set a PRIVATE_KEY environment variable
const PRIVATE_KEY = process.env.PRIVATE_KEY

const accounts: HttpNetworkAccountsUserConfig | undefined = MNEMONIC
    ? { mnemonic: MNEMONIC }
    : PRIVATE_KEY
      ? [PRIVATE_KEY]
      : undefined

if (accounts == null) {
    console.warn(
        'Could not find MNEMONIC or PRIVATE_KEY environment variables. It will not be possible to execute transactions in your example.'
    )
}

const config: HardhatUserConfig = {
    paths: {
        cache: 'cache/hardhat',
    },
    solidity: {
        compilers: [
            {
                version: '0.8.22',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    networks: {
        arbitrumOne: {
            eid: EndpointId.ARBITRUM_V2_MAINNET,
            url: 'https://arb1.arbitrum.io/rpc',
            accounts,
            chainId: 42161,
        },
        base: {
            eid: EndpointId.BASE_V2_MAINNET,
            url: 'https://mainnet.base.org',
            accounts,
            chainId: 8453,
        },
        bsc: {
            eid: EndpointId.BSC_V2_MAINNET,
            url: 'https://bsc-dataseed.binance.org',
            accounts,
            chainId: 56,
        },
        hardhat: {
            // Need this for testing because TestHelperOz5.sol is exceeding the compiled contract size limit
            allowUnlimitedContractSize: true,
            chainId: 42161, // Simulate Arbitrum chain ID for testing ARB.TITN transfers
        },
    },
    etherscan: {
        // Etherscan V2 uses a single unified API key across all supported
        // chains. Any Etherscan-family key (basescan.org, arbiscan.io, etc.)
        // works since they share an account system.
        apiKey: process.env.ETHERSCAN_KEY || process.env.BASESCAN_KEY || process.env.ARBISCAN_KEY || '',
    },
    namedAccounts: {
        deployer: {
            default: 0, // wallet address of index[0], of the mnemonic in .env
        },
    },
}

export default config
