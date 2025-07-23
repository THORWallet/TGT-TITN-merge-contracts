import BigNumber from 'bignumber.js'

export const displayNumber = (
    num: string | number,
    shouldDisplayInFull?: boolean,
    makeLargeNumbersSmall?: boolean
): string => {
    if (shouldDisplayInFull) return thousands(removeDecimalsIfThereAreTooMany(num))

    const _num = new BigNumber(num)
    const hasDecimals = _num.toString().includes('.')
    if (_num.abs().eq(0)) {
        return '0.00'
    }

    if (makeLargeNumbersSmall) {
        return formatLargeNumber(Number(_num.toFixed(2)))
    }

    // no decimals
    if (_num.abs().gt(1000)) {
        return thousands(_num.toFixed(0))
    }

    // decimals if needed only
    if (_num.abs().gte(1)) {
        if (hasDecimals) {
            return thousands(_num.toFixed(2))
        }
        return thousands(_num.toFixed(0))
    }

    // 4 decimals
    if (_num.abs().gt(0.01)) {
        return thousands(_num.toFixed(4))
    }

    // 6 decimals
    if (_num.abs().gt(0.001)) {
        return thousands(_num.toFixed(4))
    }

    // 8 decimals
    if (_num.abs().gt(0.00001)) {
        return thousands(_num.toFixed(5))
    }

    // 10 decimals
    return thousands(_num.abs().toPrecision(3))
}

const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) {
        return `${(num / 1_000_000_000).toFixed(2)}B`
    } else if (num >= 100_000_000) {
        return `${(num / 1_000_000).toFixed(0)}M`
    } else if (num >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(2)}M`
    } else if (num >= 1_000) {
        return `${(num / 1_000).toFixed(2)}k`
    } else {
        return num.toString()
    }
}

const removeDecimalsIfThereAreTooMany = (num: string | number): string | number => {
    const decimals = `${num}`.split('.')
    if (decimals.length !== 2) return num
    if (decimals[1].length > 4 && decimals[1][0] !== '0') return Number(num).toFixed(4)
    return num
}

const thousands = (num: number | string, options?: { forceAtLeastTwoDigits: boolean }): string => {
    const separator = ','
    const forceAtLeastTwoDigits = options?.forceAtLeastTwoDigits || false
    if (!num) {
        return '0'
    }

    const parts = String(num || num === 0 ? num : '').split('.')

    if (parts.length) {
        parts[0] = (parts[0] as string).replace(/(\d)(?=(\d{3})+\b)/g, '$1' + (separator || '.'))
    }

    // Render a number such as 1950.5 as "1'950.5"
    if (parts.length === 2 && forceAtLeastTwoDigits) {
        return `${parts[0]}.${(parts[1] as string).padEnd(2, '0')}`
    }

    if (forceAtLeastTwoDigits) {
        return `${parts[0]}.${''.padEnd(2, '0')}`
    }

    return parts.join('.')
}
