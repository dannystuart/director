export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface ComputedStyles {
  fontSize?: string
  fontWeight?: string
  fontFamily?: string
  color?: string
  backgroundColor?: string
  lineHeight?: string
  letterSpacing?: string
  padding?: string
  margin?: string
  borderRadius?: string
  border?: string
  width?: string
  height?: string
  display?: string
  flexDirection?: string
  alignItems?: string
  justifyContent?: string
  gap?: string
  opacity?: string
  boxShadow?: string
  textAlign?: string
  textTransform?: string
}

export type Priority = 'high' | 'medium' | 'low'

export type QuickAction = 'color' | 'spacing' | 'font' | 'align' | 'reference' | 'comment'

export interface ElementData {
  selector: string
  xpath: string
  tag: string
  textContent: string
  boundingBox: BoundingBox
}

export interface Annotation {
  id: string
  number: number
  timestamp: string
  priority: Priority
  element: ElementData
  computedStyles: ComputedStyles
  targetStyles: Partial<ComputedStyles>
  comment: string
  quickActions: QuickAction[]
  quickActionIntents: string[]
  screenshot: string | null
  referenceImage: string | null
}

export interface PageInfo {
  url: string
  viewport: { width: number; height: number }
  userAgent: string
  capturedAt: string
}

export interface AnnotationsFile {
  annotations: Annotation[]
  settings: {
    visionMode: boolean
  }
  page: PageInfo
}

export interface PluginOptions {
  storagePath?: string
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  screenshotPadding?: number
}
