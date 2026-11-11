module.exports = {
    apps: [
        {
            name: 'splitter-rewards',
            script: './scripts/run-splitter.sh',
            interpreter: '/bin/bash',
        },
        {
            name: 'bridge-usdc',
            script: './scripts/bridge-usdc.sh',
            interpreter: '/bin/bash',
        },
        {
            // CCTP V2: ETH->BASE and ARB->BASE. Replaces 'bridge-usdc' (V1) once Maya pays into the new ARB bridge.
            name: 'bridge-usdc-v2',
            script: './scripts/bridge-usdc-v2.sh',
            interpreter: '/bin/bash',
        },
        {
            name: 'staking-stats-bot',
            script: './scripts/staking-stats-bot.sh',
            interpreter: '/bin/bash',
        },
    ],
};
