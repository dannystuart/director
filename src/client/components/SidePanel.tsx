import { h, ComponentChildren } from 'preact'

interface SidePanelProps {
  title: string
  children: ComponentChildren
  onClose: () => void
}

export function SidePanel({ title, children, onClose }: SidePanelProps) {
  return (
    <div class="va-side-panel">
      <div class="va-side-panel-header">
        <span class="va-side-panel-title">{title}</span>
        <button class="va-side-panel-close" onClick={onClose}>{'\u2715'}</button>
      </div>
      <div class="va-side-panel-body">
        {children}
      </div>
    </div>
  )
}
