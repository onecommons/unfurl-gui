export function sleep(period) {
    return new Promise(resolve => setTimeout(resolve, period))
}
