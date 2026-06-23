import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import App from './App.tsx'
import './session.css'
import './shell-layout.css'
import { IconFolder, IconGear, IconGlobe, IconPower, IconTerminal, IconText } from './icons'
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
  icon: ReactNode
}

const LAUNCHER_APPS: LauncherApp[] = [
  { id: 'files', label: 'ファイル', targetTitle: 'エクスプローラー', icon: <IconFolder className="shell-icon" /> },
  { id: 'terminal', label: 'ターミナル', targetTitle: 'kitty', icon: <IconTerminal className="shell-icon" /> },
  { id: 'editor', label: 'エディタ', targetTitle: 'エディタ', icon: <IconText className="shell-icon" /> },
  { id: 'browser', label: 'ブラウザ', targetTitle: 'ブラウザ', icon: <IconGlobe className="shell-icon" /> },
  { id: 'settings', label: '設定', targetTitle: '設定', icon: <IconGear className="shell-icon" /> },
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
            <p>ファイルと倉庫は全環境で共通です。ウィンドウ配置は環境ごとに保存されます。</p>
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

function RofiLauncher({ onClose, onSession }: { onClose: () => void; onSession: () => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const apps = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? LAUNCHER_APPS.filter((app) => app.label.toLowerCase().includes(needle)) : LAUNCHER_APPS
  }, [query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="rofi-screen" role="dialog" aria-modal="true" aria-label="アプリランチャー" onMouseDown={onClose}>
      <section className="rofi-panel" onMouseDown={(event) => event.stopPropagation()}>
        <div className="rofi-search">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose()
              if (event.key === 'Enter' && apps[0]) {
                openDesktopApp(apps[0])
                onClose()
              }
            }}
            placeholder="アプリを検索…"
          />
          <kbd>Alt D</kbd>
        </div>
        <div className="rofi-grid">
          {apps.map((app) => (
            <button key={app.id} type="button" onClick={() => { openDesktopApp(app); onClose() }}>
              <span className="rofi-app-icon">{app.icon}</span>
              <span>{app.label}</span>
            </button>
          ))}
        </div>
        <footer className="rofi-footer">
          <button type="button" onClick={onSession}><IconPower className="shell-icon shell-icon--small" />ログアウト / Linux切替</button>
        </footer>
      </section>
    </div>
  )
}

function ArchTouchDock({ onLauncher, onSession }: { onLauncher: () => void; onSession: () => void }) {
  return (
    <nav className="arch-touch-dock" aria-label="Archタッチランチャー">
      <button type="button" className="arch-touch-dock__brand" onClick={onLauncher} title="アプリランチャー">▲</button>
      {LAUNCHER_APPS.slice(0, 4).map((app) => (
        <button key={app.id} type="button" onClick={() => openDesktopApp(app)} title={app.label}>{app.icon}</button>
      ))}
      <button type="button" onClick={onSession} title="Linux環境を切り替える"><IconPower className="shell-icon" /></button>
    </nav>
  )
}

function UbuntuDock({ onSession }: { onSession: () => void }) {
  return (
    <nav className="ubuntu-dock" aria-label="Ubuntu Dock">
      <button type="button" className="ubuntu-dock__activities" title="アプリケーション">●</button>
      {LAUNCHER_APPS.map((app) => (
        <button key={app.id} type="button" onClick={() => openDesktopApp(app)} title={app.label}>{app.icon}</button>
      ))}
      <span className="ubuntu-dock__spacer" />
      <button type="button" onClick={onSession} title="ログアウト"><IconPower className="shell-icon" /></button>
    </nav>
  )
}

function MintPanel({ onSession }: { onSession: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mint-panel-shell">
      {open && (
        <section className="mint-menu" aria-label="Linux Mintメニュー">
          <div className="mint-menu__search">アプリケーション</div>
          <div className="mint-menu__body">
            <aside>
              {LAUNCHER_APPS.map((app) => (
                <button key={app.id} type="button" onClick={() => { openDesktopApp(app); setOpen(false) }} title={app.label}>{app.icon}</button>
              ))}
              <button type="button" onClick={onSession} title="ログアウト"><IconPower className="shell-icon" /></button>
            </aside>
            <div className="mint-menu__apps">
              {LAUNCHER_APPS.map((app) => (
                <button key={app.id} type="button" onClick={() => { openDesktopApp(app); setOpen(false) }}>
                  <span className="mint-menu__app-icon">{app.icon}</span>
                  <span>{app.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
      <nav className="mint-panel" aria-label="Linux Mintパネル">
        <button type="button" className={`mint-menu-button ${open ? 'is-open' : ''}`} onClick={() => setOpen((value) => !value)}>
          <span>LM</span><span>メニュー</span>
        </button>
        {LAUNCHER_APPS.slice(0, 4).map((app) => (
          <button key={app.id} type="button" className="mint-panel__app" onClick={() => openDesktopApp(app)} title={app.label}>{app.icon}</button>
        ))}
        <span className="mint-panel__space" />
        <span className="mint-panel__clock">NEXUS</span>
      </nav>
    </div>
  )
}

export default function ShellRoot() {
  const [active] = useState<DistroId>(() => getActiveDistro())
  const [chooserOpen, setChooserOpen] = useState(false)
  const [rofiOpen, setRofiOpen] = useState(false)
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
      if (active === 'arch-hyprland' && (event.altKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        setRofiOpen((value) => !value)
      }
      if (event.key === 'Escape') setRofiOpen(false)
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
      {active === 'arch-hyprland' && <ArchTouchDock onLauncher={() => setRofiOpen(true)} onSession={openSessionChooser} />}
      {active === 'ubuntu-gnome' && <UbuntuDock onSession={openSessionChooser} />}
      {active === 'mint-cinnamon' && <MintPanel onSession={openSessionChooser} />}
      {rofiOpen && <RofiLauncher onClose={() => setRofiOpen(false)} onSession={openSessionChooser} />}
      {chooserOpen && <SessionChooser active={active} onCancel={() => setChooserOpen(false)} />}
    </div>
  )
}
