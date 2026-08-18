import { runSession } from './agent'
import { SCENARIOS } from './scenarios'
import type { AgentEvent, Message } from '@agent-lite/core'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline/promises'

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://127.0.0.1:3000/llm'

function printEvent(e: AgentEvent): void {
  switch (e.type) {
    case 'turn_start': console.log(`\n— turn ${e.turn} (${e.phase}) —`); break
    case 'turn_end': break  // 轮末（静默；turn_start 已标识边界）
    case 'phase_changed': console.log(`  ⇆ phase ${e.from} → ${e.to}`); break
    case 'retry': console.log(`  ↻ retry ${e.attempt}/${e.maxAttempts} (${(e.error as Error).message.slice(0, 60)})`); break
    case 'tool_call': console.log(`  ▸ ${e.name}(${JSON.stringify(e.input).slice(0, 120)})`); break
    case 'tool_result': console.log(`  ◂ ${e.id} ${e.is_error ? 'ERROR' : 'ok'}${e.summary ? ': ' + e.summary : ''}`); break
    case 'text': console.log(`  💬 ${e.text}`); break
    case 'present': {
      const dir = path.resolve('output'); fs.mkdirSync(dir, { recursive: true })
      const file = path.join(dir, `${Date.now()}.html`); fs.writeFileSync(file, e.html); console.log(`  🖥 rendered → ${file}`); break
    }
    case 'error': console.log(`  ⚠ error (${e.recoverable ? 'recoverable' : 'permanent'}): ${(e.error as Error).message.slice(0, 120)}`); break
    case 'done': console.log(`  ✓ done: ${e.reason}`); break
  }
}

async function runQuery(messages: Message[]): Promise<Message[]> {
  const { messages: next } = await runSession({ messages, onEvent: printEvent, gatewayUrl: GATEWAY_URL })
  return next
}

async function single(query: string): Promise<void> {
  await runQuery([{ role: 'user', content: [{ type: 'text', text: query }] }])
}

async function scenario(name: string): Promise<void> {
  const s = SCENARIOS.find(x => x.name === name)
  if (!s) { console.error(`unknown scenario: ${name}. Available: ${SCENARIOS.map(x => x.name).join(', ')}`); process.exit(1) }
  console.log(`# scenario: ${s.name}\n# query: ${s.query}`)
  await single(s.query)
}

async function repl(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.on('close', () => process.exit(0))  // Ctrl+D / EOF → 干净退出，而非 "failed: readline was closed"
  let messages: Message[] = []
  console.log(`REPL (gateway ${GATEWAY_URL}). Ctrl+C 退出。`)
  for (;;) {
    const line = (await rl.question('\n你: ')).trim()
    if (!line) continue
    messages = await runQuery([...messages, { role: 'user', content: [{ type: 'text', text: line }] }])
  }
}

async function main(): Promise<void> {
  const [, , ...args] = process.argv
  if (args[0] === '--list') { console.log(SCENARIOS.map(s => `${s.name}\t${s.query}`).join('\n')); return }
  if (args[0] === '--scenario') { await scenario(args[1]!); return }
  if (args[0] === '--repl') { await repl(); return }
  if (args[0]) { await single(args[0]); return }
  console.log('usage: npm start "<query>" | --scenario <name> | --repl | --list')
}

main().catch(e => { console.error('failed:', (e as Error).message); process.exit(1) })
