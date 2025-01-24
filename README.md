# TITN + MergeTGT contracts

This repository contains the contracts for deploying TITN on both the BASE and ARBITRUM networks, as well as the MergeTGT contract on ARBITRUM.

## Deployed contracts

### Test

- BASE.TITN: `0xf72EC6551A98fE12B53f7c767AABF1aD57bB6DA1` [explorer](https://basescan.org/token/0xf72EC6551A98fE12B53f7c767AABF1aD57bB6DA1#code)
- ARB.TITN: `0x2923b8ea6530FB0c9516f50Cd334e18d122ADAd3` [explorer](https://arbiscan.io/token/0x2923b8ea6530FB0c9516f50Cd334e18d122ADAd3#code)
- ARB.MergeTGT: `0x22EAafe4004225c670C8A8007887DC0a9433bd86` [explorer](https://arbiscan.io/address/0x22EAafe4004225c670C8A8007887DC0a9433bd86#code)
- ARB.TGT: `0x429fed88f10285e61b12bdf00848315fbdfcc341` [explorer](https://arbiscan.io/address/0x429fed88f10285e61b12bdf00848315fbdfcc341#code) 

### Production

- BASE.TITN: 
- ARB.TITN:
- ARB.MergeTGT:
- ARB.TGT: `0x429fed88f10285e61b12bdf00848315fbdfcc341` [explorer](https://arbiscan.io/address/0x429fed88f10285e61b12bdf00848315fbdfcc341#code) 

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

1. Bridge 173700000 TITN to Arbitrum: `npx hardhat run scripts/sendToArb.ts --network base`

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

## LayerZero Docs

- https://github.com/LayerZero-Labs/devtools/tree/main/examples/oft
- https://docs.layerzero.network/
