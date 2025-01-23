# Official repo:

https://github.com/LayerZero-Labs/devtools/tree/main/examples/oft

## Docs

https://docs.layerzero.network/

## Deploy contracts

- `npx hardhat lz:deploy` > select both base and arbitrum > then type `Titn`
- `npx hardhat lz:oapp:wire --oapp-config layerzero.config.ts`
- `npx hardhat lz:deploy` > select only arbitrum > then type `MergeTgt`

## Post Deployment steps

### Setup in BASE

1. Bridge 173700000 TITN to Arbitrum: `npx hardhat run scripts/sendToArb.ts --network base`

### Setup in ARBITRUM

1. Approve, deposit, enable merge...: `npx hardhat run scripts/arbitrumSetup.ts --network arbitrumOne`

### User steps

1. on MergeTGT call the read function quoteTitn() to see how much TITN one can get
2. await tgt.approve(MERGE_TGT_ADDRESS, amountToDeposit);
3. await tgt.transferAndCall(MERGE_TGT_ADDRESS, amountToDeposit, 0x)
4. await mergeTgt.claimTitn(claimableAmount)

### User bridge to Base

1. run `BRIDGE_AMOUNT=10 TO_ADDRESS=0x5166ef11e5dF6D4Ca213778fFf4756937e469663 npx hardhat run scripts/quote.ts --network arbitrumOne`
2. with those params call the `send()` function in the ARB.TITN contract
