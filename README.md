# TITN + MergeTGT contracts

This repository contains the contracts for deploying TITN on both the BASE and ARBITRUM networks, as well as the MergeTGT contract on ARBITRUM.

## Deployed contracts

### Production

- BASE.TITN: `0xe62bfbE57763ec24c0F130426F34DbCe11Fc5B06` [explorer](https://basescan.org/token/0xe62bfbE57763ec24c0F130426F34DbCe11Fc5B06#code)
- ARB.TITN: `0xe62bfbE57763ec24c0F130426F34DbCe11Fc5B06` [explorer](https://arbiscan.io/token/0xe62bfbE57763ec24c0F130426F34DbCe11Fc5B06#code)
- ARB.MergeTGT: `0xfa486b0e67ca52F5F9E5aDf0B79b6CfeB339b6e0` [explorer](https://arbiscan.io/address/0xfa486b0e67ca52F5F9E5aDf0B79b6CfeB339b6e0#code)
- ARB.TGT: `0x429fed88f10285e61b12bdf00848315fbdfcc341` [explorer](https://arbiscan.io/address/0x429fed88f10285e61b12bdf00848315fbdfcc341#code)
- Staking: ProxyAdmin: `0xfa486b0e67ca52F5F9E5aDf0B79b6CfeB339b6e0` [explorer](https://basescan.org/token/0xfa486b0e67ca52F5F9E5aDf0B79b6CfeB339b6e0#code)
- Staking: TitnStaking: `0x2CbeDd08364953f9Ab70A803749eC44C94EF2410` [explorer](https://basescan.org/token/0x2CbeDd08364953f9Ab70A803749eC44C94EF2410#code)
- Staking: TransparentUpgradeableProxy `0x269E9c0e300dd6c84A38b5781551BF767b2B5327` [explorer](https://basescan.org/token/0x269E9c0e300dd6c84A38b5781551BF767b2B5327#code)
- RafflePayout: `0x583ecd462E6a8f3bBBa71eC3A3AaB53a7b6C01C0` [explorer](https://basescan.org/token/0x583ecd462E6a8f3bBBa71eC3A3AaB53a7b6C01C0#code)
- 3-Way Splitter: `0x76a3B8FeA6F6C7D7af5B47885563955F3ACd9BC2` [explorer](https://basescan.org/token/0x76a3B8FeA6F6C7D7af5B47885563955F3ACd9BC2#code)
- USDCBridge: `0x2CbeDd08364953f9Ab70A803749eC44C94EF2410` [explorer](https://arbiscan.io/token/0x2CbeDd08364953f9Ab70A803749eC44C94EF2410#code)

## Overview

The TITN ecosystem enables users to exchange their `ARB.TGT` for `ARB.TITN`, and subsequently bridge their `ARB.TITN` to `BASE.TITN`.

**Key Features**:

1. Token Transfers on BASE:

- Non-bridged TITN Tokens: Holders can transfer their TITN tokens freely to any address as long as the tokens have not been bridged from ARBITRUM.
- Bridged TITN Tokens: Transfers are restricted to a predefined address (`transferAllowedContract`), set by the admin. Initially, this address will be the staking contract to prevent trading until the `isBridgedTokensTransferLocked` flag is disabled by the admin.

2. Token Transfers on ARBITRUM:

- TITN holders are restricted to transferring their tokens only to the LayerZero endpoint address for bridging to BASE.
- Admin/owner retains the ability to transfer tokens to any address.

**Deployment Details:**

- BASE Network:

  - 1 Billion TITN tokens will be minted upon deployment and allocated to the owner.

- ARBITRUM Network:
  - No TITN tokens are minted initially.
  - The owner is responsible for bridging 173.7 Million BASE.TITN to ARBITRUM and depositing them into the MergeTGT contract.

**Transfer Restrictions**

The contracts include a transfer restriction mechanism controlled by the isBridgedTokensTransferLocked flag. This ensures controlled token movement across networks until the admin deems it appropriate to enable unrestricted transfers.

## Deploy contracts

- `npx hardhat lz:deploy` > select both base and arbitrum > then type `Titn`
- `npx hardhat lz:oapp:wire --oapp-config layerzero.config.ts`
- `npx hardhat lz:deploy` > select only arbitrum > then type `MergeTgt`

## Post Deployment steps

### Setup on BASE

1. Bridge 166800000 TITN to Arbitrum: `npx hardhat run scripts/sendToArb.ts --network base`

### Setup on ARBITRUM

1. Approve, deposit, enable merge...: `npx hardhat run scripts/arbitrumSetup.ts --network arbitrumOne`

## User steps

These are the steps a user would take to merge and bridge tokens (from ARB.TGT to ARB.TITN and then to BASE.TITN)

### Merge steps

1. on MergeTGT call the read function quoteTitn() to see how much TITN one can get
2. `await tgt.approve(MERGE_TGT_ADDRESS, amountToDeposit)`
3. `await tgt.transferAndCall(MERGE_TGT_ADDRESS, amountToDeposit, 0x)`
4. `await mergeTgt.claimTitn(claimableAmount)`

### Bridge to Base

1. run `BRIDGE_AMOUNT=10 TO_ADDRESS=0x5166ef11e5dF6D4Ca213778fFf4756937e469663 npx hardhat run scripts/quote.ts --network arbitrumOne`
2. with those params call the `send()` function in the ARB.TITN contract

### Staking Contract

1. This is deployed via Remix due to incompatible dependencies
2. First deploy the `ProxyAdmin` contract, then the `TitnStaking` contract and finally the `TransparentUpgradeableProxy` contract
3. For the `TransparentUpgradeableProxy` you'll need to run `npx hardhat run scripts/stakingProxyData.ts` to get the `bytes` input field data
4. Once deployed head over to the `titn` on BASE contract and call `setTransferAllowedContract` providing the address of the `TransparentUpgradeableProxy` contract.

### Raffle Payout Contract

1. Deploy the RafflePayout contract `npx hardhat lz:deploy` > Select Base > Type `RafflePayout`
2. Set the delegate (manually on basescan). The BE should have access to the private key of the delegate (to submit raffle winners)

### Splitter Contract

1. Deploy the splitter contract on Base `npx hardhat lz:deploy` > Select Base > Type `ERC20Splitter3Way`
2. Set up the contract params `npx hardhat run scripts/splitter3WaySetup.ts --network base`

### USDC Bridge Contract

1. Deploy the USDC Bridge contract on Arbitrum `npx hardhat lz:deploy` > Select Arbitrum > Type `USDCBridge`
2. Run the bot to bridge USDC on arbitrum to Base and send it to the splitter contract

## LayerZero Docs

- https://github.com/LayerZero-Labs/devtools/tree/main/examples/oft
- https://docs.layerzero.network/
