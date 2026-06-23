import { useEffect, useState, type CSSProperties } from 'react'
import App from './App.tsx'
import {
  DISTRO_PROFILES,
  getActiveDistro,
  getDistroProfile,
  saveCurrentShellSession,
  switchDistro,
  type DistroId,
} from './os/session'

function SessionChooser({ active, onCancel }: { active: DistroId; onCancel: () => void }) {
  return (
    <div className="session-screen" role="dialog" aria-modal="true" aria-label="Linux環境を選択">
      <div className="session-screen__backdrop" />
      <section className="session-panel">
        <header className="session-panel__header">
          <div>
            <p className="session-panel__eyebrow">NEXUS SESSION</p>
            <h1>Linux環境を選択</h1>
            <p>ファイルと倉庫はすべての環境で共通です。ウィンドウ配置は環境ごとに保存されます。</p>
          </div>
          <button type="button" className="session-panel__close" onClick={onCancel} aria-label="デスクトップへ戻る">×</button>
        </header>

        <div className="session-grid">
          {DISTRO_PROFILES.map((profile) => (
            <button
              type="button"
              key={profile.id}
              className={`session-card ${profile.id === active ? 'is-active' : ''}`}
              style={{ '--session-accent': profile.accent } as CSSProperties}
              onClick={() => switchDistro(profile.id)}
            >
              <span className="session-card__icon" aria-hidden="true">{profile.icon}</span>
              <span className="session-card__body">
                <strong>{profile.name}</strong>
                <small>{profile.edition} · {profile.shell}</small>
                <span>{profile.description}</span>
              </span>
              {profile.id === active && <span className="session-card__current">使用中</span>}
            </button>
          ))}
        </div>

        <footer className="session-panel__footer">
          <span>共有: /home/user、Desktop、Documents、Downloads、Pictures</span>
          <span>環境切替: Alt + Shift + L</span>
        </footer>
      </section>
    </div>
  )
}

export default function ShellRoot() {
  const [active] = useState<DistroId>(() => getActiveDistro())
  const [chooserOpen, setChooserOpen] = useState(false)
  const profile = getDistroProfile(active)

  useEffect(() => {
    const openChooser = () => {
      saveCurrentShellSession(active)
      setChooserOpen(true)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        openChooser()
      }
    }
    window.addEventListener('nexus:logout', openChooser)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('nexus:logout', openChooser)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [active])

  return (
    <div className={`nexus-shell nexus-shell-${profile.className}`} data-distro={profile.id}>
      <App />
      <button
        type="button"
        className="session-switch-chip"
        onClick={() => {
          saveCurrentShellSession(active)
          setChooserOpen(true)
        }}
        title="ログアウトしてLinux環境を切り替える"
      >
        <span className="session-switch-chip__icon" aria-hidden="true">{profile.icon}</span>
        <span className="session-switch-chip__label">{profile.name} · {profile.shell}</span>
      </button>
      {chooserOpen && <SessionChooser active={active} onCancel={() => setChooserOpen(false)} />}
    </div>
  )
}
