import { parse, path } from './deps.ts'
import { getLogger, Logger, loggerFactory } from './logger.ts'
import * as util from './util.ts'

export { exec, ExecOptions } from './exec.ts'
export { scriptLogger as log }
export { getLoggerWithoutPrefix as getLogger }

loggerFactory.level = 'info'
loggerFactory.rootName = 'deno.runner'

const scriptLogger = getLogger('script')

function getLoggerWithoutPrefix(name: string): Logger {
    return getLogger(name, /*relative*/ false)
}

/**
 * Task context
 */
export interface TaskContext {
    args: { [key: string]: any }
    log: Logger
}

type Task = ((context: TaskContext) => any) | (() => any)
type TaskArgs = { [key: string]: any } & { log?: string; deir?: string }
type NamedTasks = { [name: string]: Task }

function parseTaskArgs(): TaskArgs {
    return parse(Deno.args) as TaskArgs
}

/*
 * Allow callers to access the task contect globally
 */
export function getTaskContext(taskName: string = 'default') {
    return {
        args: parseTaskArgs(),
        log: getLoggerWithoutPrefix(`task.${taskName}`),
    } as TaskContext
}

// we parse all the args now so we can setup all the logger etc, even before user call 'run'
function init() {
    const taskArgs = parseTaskArgs()

    // allow passing '--trace' directly through as an option
    ;['error', 'warn', 'info', 'debug', 'trace'].forEach((level) => {
        if (taskArgs[level]) {
            loggerFactory.level = level
        }
    })
    if (taskArgs.log) {
        loggerFactory.level = taskArgs.log
    }
}

init()

const log = getLogger('run')

// Create a builtin using the user supplied args so we can build help tasks etc
function newBuiltinsTasks(
    namedTasks: NamedTasks,
    opts: { dir?: string; default?: string; logLevel?: string }
): NamedTasks {
    const builtins: NamedTasks = {
        _cache_clear: async function (ctxt: TaskContext) {
            'Clear the deno script cache in $HOME/.cache/deno'

            const home = Deno.env.get('HOME')
            const cacheDir = `${home}/.cache/deno/`
            ctxt.log.info(`Deleting cache dir: '${cacheDir}'`)
            await Deno.remove(cacheDir, { recursive: true })
        },

        _help: async function (ctxt: TaskContext) {
            'Print this help'

            const lines: string[] = []

            lines.push('Help:')
            lines.push('  User Tasks:')
            util.printTasks(lines, namedTasks)

            lines.push('  Builtin Tasks:')
            util.printTasks(lines, builtins)

            lines.push('  User supplied options:')
            lines.push(`      defaultTask: ${opts.default}`)
            lines.push(`      dir: ${opts.dir}`)
            lines.push(`      logLevel: ${opts.logLevel}`)

            console.log(lines.join('\n'))
        },
    }

    return builtins
}

type RunOpts = {
    dir?: string
    default?: string
    logLevel?: string
    tasks: NamedTasks
    meta: any
}
/**
 * Main entry point for users of this module
 */
export async function run(opts: RunOpts) {
    const defaultTaskName = opts.default || '_help'
    const taskArgs = parseTaskArgs()

    //allow setting of default log level. Commandline args win
    if (!taskArgs.log && opts.logLevel) {
        loggerFactory.level = opts.logLevel
    }

    let tasks = taskArgs['_'] as string[]
    if (!tasks || tasks.length == 0) {
        tasks = [defaultTaskName]
    }
    delete taskArgs['_']

    if (taskArgs['help']) {
        tasks = ['_help']
    }

    const initCwd = Deno.cwd()
    setWorkingDir(opts)
    const builtinTasks = newBuiltinsTasks(opts.tasks, opts)
    try {
        await runTasks(opts.tasks, builtinTasks, tasks, taskArgs)
    } finally {
        Deno.chdir(initCwd)
    }
}

function isWindows() {
    return Deno.build.os === 'windows'
}

function setWorkingDir(opts: RunOpts) {
    if (!opts.meta) {
        throw `No 'meta' (import.meta.url) set on RunArgs. THis needs to be set to calculate the basedir to use for all path related operations`
    }
    const runDir = opts.dir
    if (!runDir) {
        return
    }
    // extract the scritp location from the calling script
    let entryScript = new URL(opts.meta.url).pathname
    if (isWindows()) {
        // remove leading '/' for windows paths
        entryScript = entryScript.substring(1)
    }
    log.trace('entryScript', entryScript)

    const entryScriptDir = path.dirname(entryScript)
    log.trace('entryScriptDir', entryScriptDir)

    const baseDir = path.join(entryScriptDir, runDir)
    log.trace('baseDir', baseDir)

    Deno.chdir(baseDir)
}

/**
 * Run the given tasks
 *
 * @param userTasks user/build-script provided tasks
 * @param builtinsTasks
 * @param tasksToRun
 * @param taskArgs
 */
async function runTasks(
    userTasks: NamedTasks,
    builtinsTasks: NamedTasks,
    tasksToRun: string[],
    taskArgs: {}
) {
    for (var i = 0; i < tasksToRun.length; i++) {
        // allow both underscore and dashes in task names (to stay inline with cli conventions)
        const taskName = tasksToRun[i].replace('-', '_')
        let task: Task
        task = userTasks[taskName]
        if (!task) {
            task = userTasks[`task_${taskName}`]
        }
        if (!task) {
            task = builtinsTasks[taskName]
        }
        if (!task) {
            log.error(
                `could not find task function '${taskName}'. Run '_help' to show available tasks`
            )
            return
        }
        log.debug(`running task: '${taskName}'`)
        try {
            const taskContext: TaskContext = {
                args: { ...taskArgs },
                log: getLoggerWithoutPrefix(`task.${taskName}`),
            }
            await task(taskContext).catch((err: unknown) => {
                throw err
            })
        } catch (err) {
            log.error(`Task '${taskName}' threw an error`, err)
            throw `Task '${taskName} threw an error`
        }
    }
}

export default run
