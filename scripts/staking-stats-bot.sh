#!/bin/bash
cd /home/ubuntu/TGT-TITN-merge-contracts
export NODE_ENV=production
npx hardhat run scripts/stakingStatsBot.ts --network base