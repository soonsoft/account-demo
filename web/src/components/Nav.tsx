export function Nav({ shortcuts, activeView, activeShortcutId, onSelectChat, onSelectShortcut, onDeleteShortcut }: {
  shortcuts: { id: string; name: string; prompt: string }[]
  activeView: 'chat' | 'shortcut'; activeShortcutId?: string
  onSelectChat(): void; onSelectShortcut(id: string): void; onDeleteShortcut(id: string): void
}) {
  return (
    <nav className="nav">
      <button className={activeView === 'chat' ? 'nav-item active' : 'nav-item'} onClick={onSelectChat}>💬 对话</button>
      <hr className="nav-sep" />
      <div className="nav-title">Shortcuts</div>
      {shortcuts.length === 0 && <div className="nav-empty">暂无 shortcut</div>}
      {shortcuts.map(s => (
        <div key={s.id} className={activeView === 'shortcut' && activeShortcutId === s.id ? 'nav-item active' : 'nav-item'}>
          <button className="nav-link" title={`${s.prompt}\n${s.name}`} onClick={() => onSelectShortcut(s.id)}>{s.name}</button>
          <button className="nav-del" onClick={() => onDeleteShortcut(s.id)}>✕</button>
        </div>
      ))}
    </nav>
  )
}
