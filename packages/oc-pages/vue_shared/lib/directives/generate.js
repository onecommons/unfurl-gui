
function rangeLength(range) {
    return range[1] - range[0] + 1

}
function totalRangesLength(ranges) {
    let result = 0
    for(const range of ranges) {
        result += rangeLength(range)
    }
    return result
}

function getRandomCode(ranges) {
    const r = Math.floor(Math.random() * totalRangesLength(ranges))
    let lastAccumulated = 0
    for(let i = 0; i < ranges.length; i++) {
        const accumulated = totalRangesLength(ranges.slice(0, i + 1))
        if(r < accumulated) {
            const indexInRange = r - lastAccumulated
            return ranges[i][0] + indexInRange
        }
        lastAccumulated = accumulated
    }
}

export default function resolve(params) {
    if(params.preset == 'password') {
        return resolve({ranges: [[33, 126]], len: 15})
    }
    const {ranges} = params
    const len = params.length || params.len
    const codes = Array.from(Array(len), getRandomCode.bind(null, ranges))

    return String.fromCodePoint.apply(null, codes)
}
