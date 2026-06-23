import { useEffect, useState, type CSSProperties } from 'react'
import App from './App.tsx'
import './session.css'
import './shell-layout.css'
import {
  DISTRO_PROFILES,
  getActiveDistro,
  getDistroProfile,
  saveCurrentShellSession,
  switchDistro,
  type DistroId,
} from './os/session'

type LauncherApp = {
  id: string
  label: string
  targetTitle: string
  glyph: string
}

const LAUNCHER_APPS: LauncherApp[] = [
  { id: 'files', label: 'ファイル', targetTitle: 'エクスプローラー', glyph: '▣' },
  { id: 'terminal', label: 'ターミナル', targetTitle: 'kitty', glyph: '>_' },
  { id: 'editor', label: 'エディタ', targetTitle: 'エディタ', glyph: 'Aa' },
  { id: 'browser', label: 'ブラウザ', targetTitle: 'ブラウザ', glyph: '◎' },
  { id: 'settings', label: '設定', targetTitle: '設定', glyph: '⚙' },
]

function openDesktopApp(app: LauncherApp) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button[title]'))
  const target = buttons.find((button) => button.title === app.targetTitle)
  target?.click()
}

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

function ArchLauncher({ onSession }: { onSession: () => void }) {
  return (
    <nav className="arch-launcher" aria-label="Archアプリランチャー">
      <button type="button" className="arch-launcher__brand" onClick={onSession} title="Linux環境を切り替える">▲</button>
      <span className="shell-launcher__separator" />
      {LAUNCHER_APPS.map((app) => (
        <button key={app.id} type="button" className="shell-app-button" onClick={() => openDesktopApp(app)} title={app.label}>
          <span aria-hidden="true">{app.glyph}</span>
        </button>
      ))}
    </nav>
  )
}

function StartMenu({ distroName, distroIcon, onSession }: { distroName: string; distroIcon: string; onSession: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="start-shell">
      {open && (
        <section className="start-menu" aria-label={`${distroName}スタートメニュー`}>
          <header className="start-menu__header">
            <span className="start-menu__logo" aria-hidden="true">{distroIcon}</span>
            <span><strong>{distroName}</strong><small>NEXUS Desktop</small></span>
          </header>
          <div className="start-menu__apps">
            {LAUNCHER_APPS.map((app) => (
              <button key={app.id} type="button" onClick={() => { openDesktopApp(app); setOpen(false) }}>
                <span className="start-menu__app-icon" aria-hidden="true">{app.glyph}</span>
                <span>{app.label}</span>
              </button>
            ))}
          </div>
          <footer className="start-menu__footer">
            <button type="button" onClick={onSession}>ログアウト / Linux環境を切り替える</button>
          </footer>
        </section>
      )}
      <button type="button" className={`start-button ${open ? 'is-open' : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span aria-hidden="true">{distroIcon}</span>
        <span>メニュー</span>
      </button>
    </div>
  )
}

export default function ShellRoot() {
  const [active] = useState<DistroId>(() => getActiveDistro())
  const [chooserOpen, setChooserOpen] = useState(false)
  const profile = getDistroProfile(active)
  const isArch = active === 'arch-hyprland'

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

  const openSessionChooser = () => {
    saveCurrentShellSession(active)
    setChooserOpen(true)
  }

  return (
    <div className={`nexus-shell nexus-shell-${profile.className}`} data-distro={profile.id}>
      <App />
      {isArch ? (
        <ArchLauncher onSession={openSessionChooser} />
      ) : (
        <StartMenu distroName={profile.name} distroIcon={profile.icon} onSession={openSessionChooser} />
      )}
      {chooserOpen && <SessionChooser active={active} onCancel={() => setChooserOpen(false)} />}
    </div>
  )
}
