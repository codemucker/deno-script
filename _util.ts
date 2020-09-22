import { extractFunctionDocs, rightPad } from './util.ts'
export { extractFunctionDocs, rightPad }

export function printTasks(lines: string[], tasks: { [name: string]: any }) {
    Object.keys(tasks)
        .sort()
        .forEach((key) => {
            let docs = extractFunctionDocs(tasks[key]) || ''
            let name = key
            if (name.startsWith('task_')) {
                name = name.substring(5)
            }
            lines.push(`     ${rightPad(name, 25)} : ${docs}`)
        })
}
