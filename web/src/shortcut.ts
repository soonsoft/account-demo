import { IndexedDBShortcutStore, buildShortcut, toolKindsFromTools, replay } from '@agent-lite/core/shortcut'
import type { AgentEvent, ShortcutRecord } from '@agent-lite/core/shortcut'
import { buildTools } from '../../src/tools/render'

const store = new IndexedDBShortcutStore('account-demo-shortcuts')
let opened = false
async function ensureOpen() { if (!opened) { await store.open(); opened = true } }

export async function listShortcuts(): Promise<ShortcutRecord[]> { await ensureOpen(); return store.list() }
export async function deleteShortcut(id: string): Promise<void> { await ensureOpen(); return store.delete(id) }

export function recordShortcut(events: AgentEvent[], name: string, prompt: string): ShortcutRecord {
  return buildShortcut(events, {
    id: crypto.randomUUID(), name, prompt, createdAt: new Date().toISOString(),
    toolKinds: toolKindsFromTools(buildTools()),
  })
}
export async function saveShortcut(record: ShortcutRecord): Promise<void> { await ensureOpen(); return store.put(record) }

export function replayShortcut(record: ShortcutRecord, signal: AbortSignal): AsyncIterable<AgentEvent> {
  return replay({ record, signal }, { tools: buildTools() })
}
