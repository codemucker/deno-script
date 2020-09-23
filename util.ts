export function rightPad(s: string, size: number, padChar = ' '): string {
    while (s.length < size) {
        s = s + padChar
    }
    return s
}

export function extractFunctionDocs(func: Function): string | undefined {
    if (!func) {
        return undefined
    }
    const srcLines = func.toString().split(/\r?\n/)
    const commentDelims = '\'"`'
    for (var i = 0; i < srcLines.length && i < 4; i++) {
        const line = srcLines[i].trim()
        if (line.length == 0) {
            continue
        }
        const startChar = line[0]
        const isBeginComment = commentDelims.indexOf(startChar) != -1
        if (isBeginComment) {
            const startIdx = i
            let endIdx = -1
            for (var j = i; j < srcLines.length; j++) {
                const line = srcLines[j].trim()
                if (
                    line.endsWith(`${startChar};`) ||
                    line.endsWith(startChar)
                ) {
                    //done, found end of comments
                    endIdx = j

                    let docs = srcLines
                        .slice(startIdx, endIdx + 1)
                        .join('\n')
                        .trim()
                    if (docs.endsWith(';')) {
                        docs = docs.substr(0, docs.length - 1)
                    }
                    docs = docs.substr(1, docs.length - 2)
                    return docs
                }
            }
            return undefined
        }
    }
    return undefined
}
