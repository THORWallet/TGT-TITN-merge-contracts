import axios from 'axios'

export const sendSlackMessage = async (msg: string): Promise<boolean> => {
    const slackChannel = process.env.SLACK
    if (!slackChannel) return false
    try {
        await axios.post(
            slackChannel,
            {
                text: msg,
            },
            {
                headers: {
                    'Content-type': 'application/json',
                },
            }
        )
        return true
    } catch (e) {
        return false
    }
}
