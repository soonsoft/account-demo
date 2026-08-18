import { useState } from 'react'
import type { Scenario } from '../../../src/scenarios'
export function Composer({ running, onSend, onStop, scenarios }: {
  running: boolean; onSend: (t: string) => void; onStop: () => void; scenarios: Scenario[]
}) {
  const [text, setText] = useState('')
  const submit = () => { onSend(text); setText('') }
  return (
    <div className="composer">
      <select defaultValue="" onChange={e => { const s = scenarios.find(x => x.name === e.target.value); if (s) setText(s.query) }}>
        <option value="" disabled>载入场景…</option>
        {scenarios.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
      </select>
      <input value={text} placeholder="问点什么，如：列出 KYC 待审核客户" disabled={running}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !running && submit()} />
      {running ? <button onClick={onStop}>停止</button> : <button onClick={submit} disabled={!text.trim()}>发送</button>}
    </div>
  )
}
