#!/bin/bash
cd /home/ubuntu/TGT-TITN-merge-contracts
export NODE_ENV=production
npx hardhat run scripts/bridgeUSDC.ts --network arbitrumOne