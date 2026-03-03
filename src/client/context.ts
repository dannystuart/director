import { createContext } from 'preact'
import type { Annotation } from '../shared/types'

export type Mode = 'inactive' | 'selecting' | 'annotating' | 'reviewing'

export interface AppState {
  mode: Mode
  annotations: Annotation[]
  activeAnnotation: string | null
  visionMode: boolean
  hoveredElement: HTMLElement | null
}

export type AppAction =
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'SET_ANNOTATIONS'; annotations: Annotation[] }
  | { type: 'SET_ACTIVE'; id: string | null }
  | { type: 'SET_VISION_MODE'; enabled: boolean }
  | { type: 'SET_HOVERED'; element: HTMLElement | null }
  | { type: 'ADD_ANNOTATION'; annotation: Annotation }
  | { type: 'UPDATE_ANNOTATION'; annotation: Annotation }
  | { type: 'REMOVE_ANNOTATION'; id: string }
  | { type: 'MARK_PROCESSED'; ids: string[] }

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.mode, hoveredElement: null }
    case 'SET_ANNOTATIONS':
      return { ...state, annotations: action.annotations }
    case 'SET_ACTIVE':
      return { ...state, activeAnnotation: action.id }
    case 'SET_VISION_MODE':
      return { ...state, visionMode: action.enabled }
    case 'SET_HOVERED':
      return { ...state, hoveredElement: action.element }
    case 'ADD_ANNOTATION':
      return { ...state, annotations: [...state.annotations, action.annotation] }
    case 'UPDATE_ANNOTATION':
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === action.annotation.id ? action.annotation : a
        ),
      }
    case 'REMOVE_ANNOTATION':
      return {
        ...state,
        annotations: state.annotations.filter((a) => a.id !== action.id),
        activeAnnotation: state.activeAnnotation === action.id ? null : state.activeAnnotation,
      }
    case 'MARK_PROCESSED':
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          action.ids.includes(a.id) ? { ...a, processed: true } : a
        ),
      }
    default:
      return state
  }
}

export const initialState: AppState = {
  mode: 'inactive',
  annotations: [],
  activeAnnotation: null,
  visionMode: true,
  hoveredElement: null,
}

export const AppContext = createContext<{
  state: AppState
  dispatch: (action: AppAction) => void
}>({ state: initialState, dispatch: () => {} })
