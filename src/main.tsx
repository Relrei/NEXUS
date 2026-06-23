import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ShellRoot from './ShellRoot.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('NEXUS root element was not found')

createRoot(root).render(
  <StrictMode>
    <ShellRoot />
  </StrictMode>,
)
