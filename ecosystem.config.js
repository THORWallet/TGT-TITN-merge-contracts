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
            name: 'staking-stats-bot',
            script: './scripts/staking-stats-bot.sh',
            interpreter: '/bin/bash',
        },
    ],
};
