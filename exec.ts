import { getLogger } from './logger.ts'

const decoder = new TextDecoder()
const log = getLogger('exec')

/**
 * Run a script or function, optionally setting a relative dir to run it within (temporary
 * change to the cwd)
 */
export async function exec(
    opts:
        | string
        | string[]
        | {
              cmd: (() => any) | string | string[]
              dir?: string
              env?: { [name: string]: string }
              silent?: boolean
              logError?: boolean
          }
): Promise<string> {
    if (typeof opts === 'string') {
        opts = { cmd: opts }
    } else if (Array.isArray(opts)) {
        opts = { cmd: opts }
    }
    const cwdOrginal = Deno.cwd()
    if (opts.dir) {
        try {
            Deno.chdir(opts.dir)
        } catch (err) {
            throw Error(
                `Error changing working dir. Dir='${opts.dir}', cmd='${opts.cmd}', err=${err}`
            )
        }
    }
    try {
        const cmd = opts.cmd
        if (Array.isArray(cmd)) {
            log.trace('exec (string[])', cmd)
            const out: string[] = []
            for (let i = 0; i < cmd.length; i++) {
                const c = cmd[i]
                const o = await _exec({ cmd: c }).catch((err) => {
                    throw err
                })
                out.push(o)
            }
            if (opts.silent == false) {
                console.log(out.join('\n'))
            }
            return out.join('\n')
        } else if (typeof cmd == 'string') {
            log.trace('exec (string)', cmd)
            const out = await _exec({ cmd: cmd }).catch((err) => {
                throw err
            })
            if (opts.silent == false) {
                console.log(out)
            }
            return out
        } else {
            log.trace('exec (function)', cmd)
            await cmd().catch((err: unknown) => {
                throw err
            })
            return ''
        }
    } catch (err) {
        if (opts.logError != false) {
            log.error('error while executing', opts, err)
        }
        throw Error(
            `Error executing ${JSON.stringify(opts)}, error ${JSON.stringify(
                err
            )}`
        )
    } finally {
        if (opts.dir) {
            Deno.chdir(cwdOrginal)
        }
    }
}

export type ExecOptions = Omit<Deno.RunOptions, 'stdout' | 'stderr'>

const _exec = async (opts: {
    cmd: string | string[] | ExecOptions
    env?: { [name: string]: string }
}): Promise<string> => {
    let o: Deno.RunOptions
    if (typeof opts.cmd === 'string') {
        o = {
            cmd: opts.cmd.split(' '),
        }
    } else if (Array.isArray(opts.cmd)) {
        o = {
            cmd: opts.cmd,
        }
    } else {
        o = opts.cmd
    }

    o.env = opts.env
    o.stdout = 'piped'
    o.stderr = 'piped'

    log.trace(`cmd=${o.cmd}`)

    const process: Deno.Process = Deno.run(o)
    const stdOut = process.output()
    const stdErr = process.stderrOutput()

    const output: string = decoder.decode(await stdOut)

    const status = await process.status()
    if (!status.success) {
        const errOutput: string = stdErr ? decoder.decode(await stdErr) : ''
        process.close()

        throw new Error(
            `error while running '${opts.cmd}', status code '${status.code}', error '${errOutput}'`
        )
    }
    return output
}
