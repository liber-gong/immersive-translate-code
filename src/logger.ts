import type * as vscode from 'vscode'

let channel: vscode.OutputChannel | undefined

export function initLogger(): vscode.OutputChannel {
  if (!channel) {
    // Lazy require so non-VSCode contexts (e.g. unit tests) don't need to resolve 'vscode'
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vs = require('vscode') as typeof vscode
    channel = vs.window.createOutputChannel('Immersive Translate')
  }
  return channel
}

export function log(tag: string, ...args: unknown[]): void {
  const msg = args
    .map(a => (typeof a === 'string' ? a : a instanceof Error ? `${a.message}\n${a.stack}` : JSON.stringify(a)))
    .join(' ')
  const line = `[${tag}] ${msg}`

  console.log(line)
  channel?.appendLine(`${new Date().toISOString()} ${line}`)
}
