export type DistroId = 'arch-hyprland' | 'ubuntu-gnome' | 'fedora-gnome' | 'mint-cinnamon'

export type DistroProfile = {
  id: DistroId
  name: string
  edition: string
  shell: string
  icon: string
  description: string
  className: string
  accent: string
}

export const DISTRO_PROFILES: readonly DistroProfile[] = [
  {
    id: 'arch-hyprland',
    name: 'Arch Linux',
    edition: 'JaKooLit style',
    shell: 'Hyprland',
    icon: '▲',
    description: 'タイル操作とWaybarを中心にしたNEXUSの標準環境。',
    className: 'arch',
    accent: '#7dd3fc',
  },
  {
    id: 'ubuntu-gnome',
    name: 'Ubuntu',
    edition: 'Desktop',
    shell: 'GNOME',
    icon: '●',
    description: 'アクティビティとドックを中心にしたGNOME系の操作。',
    className: 'ubuntu',
    accent: '#f97316',
  },
  {
    id: 'fedora-gnome',
    name: 'Fedora',
    edition: 'Workstation',
    shell: 'GNOME',
    icon: 'f',
    description: '素のGNOMEに近い、整理されたワークスペース中心の環境。',
    className: 'fedora',
    accent: '#60a5fa',
  },
  {
    id: 'mint-cinnamon',
    name: 'Linux Mint',
    edition: 'Cinnamon',
    shell: 'Cinnamon',
    icon: 'LM',
    description: '従来型デスクトップに近く、初めてでも扱いやすい環境。',
    className: 'mint',
    accent: '#86efac',
  },
] as const

const ACTIVE_KEY = 'nexus.shell.active'
const LIVE_SESSION_KEY = 'nexus.session'
const profileSessionKey = (id: DistroId) => `nexus.shell.session.${id}`

export function isDistroId(value: string | null): value is DistroId {
  return DISTRO_PROFILES.some((profile) => profile.id === value)
}

export function getActiveDistro(): DistroId {
  const saved = localStorage.getItem(ACTIVE_KEY)
  return isDistroId(saved) ? saved : 'arch-hyprland'
}

export function getDistroProfile(id = getActiveDistro()): DistroProfile {
  return DISTRO_PROFILES.find((profile) => profile.id === id) ?? DISTRO_PROFILES[0]
}

export function saveCurrentShellSession(id = getActiveDistro()) {
  const session = localStorage.getItem(LIVE_SESSION_KEY)
  if (session) localStorage.setItem(profileSessionKey(id), session)
  else localStorage.removeItem(profileSessionKey(id))
}

export function switchDistro(next: DistroId) {
  const current = getActiveDistro()
  saveCurrentShellSession(current)
  localStorage.setItem(ACTIVE_KEY, next)

  const targetSession = localStorage.getItem(profileSessionKey(next))
  if (targetSession) localStorage.setItem(LIVE_SESSION_KEY, targetSession)
  else localStorage.removeItem(LIVE_SESSION_KEY)

  localStorage.setItem('nexus.shell.lastSwitch', String(Date.now()))
  location.reload()
}

export function requestLogout() {
  window.dispatchEvent(new CustomEvent('nexus:logout'))
}
