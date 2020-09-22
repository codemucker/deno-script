// from https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
export const hashCode = function (s: string) {
    var hash = 0
    for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i)
        hash |= 0 // Convert to 32bit integer
    }
    return hash
}
