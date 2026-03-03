import { useReducer, useEffect } from 'preact/hooks'
import { AppContext, appReducer, initialState } from './context'
import { FloatingIcon } from './components/FloatingIcon'
import { ElementSelector } from './components/ElementSelector'
import { AnnotationCard } from './components/AnnotationCard'
import { PinMarker } from './components/PinMarker'
import { ControlPanel } from './components/ControlPanel'
import { ReviewCard } from './components/ReviewCard'
import { ViewportOverlay } from './components/ViewportOverlay'
import { fetchAnnotations } from './utils/api'

export function App() {
  const [state, dispatch] = useReducer(appReducer, initialState)

  useEffect(() => {
    fetchAnnotations().then((data) => {
      dispatch({ type: 'SET_ANNOTATIONS', annotations: data.annotations })
      dispatch({ type: 'SET_VISION_MODE', enabled: data.settings.visionMode })
    })
  }, [])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <FloatingIcon />
      {state.mode === 'selecting' && <ElementSelector />}
      {(state.mode === 'selecting' || state.mode === 'reviewing') && <ControlPanel />}
      {state.mode === 'annotating' && state.activeAnnotation && <AnnotationCard />}
      {state.mode === 'reviewing' && state.activeAnnotation && <ReviewCard />}
      {state.mode !== 'inactive' &&
        state.annotations.map((ann) => {
          const siblingIndex = state.annotations
            .filter((a) => a.element.selector === ann.element.selector)
            .findIndex((a) => a.id === ann.id)
          return <PinMarker key={ann.id} annotation={ann} siblingIndex={siblingIndex} />
        })}
      {state.viewport.width && state.mode !== 'inactive' && (
        <ViewportOverlay width={state.viewport.width} />
      )}
    </AppContext.Provider>
  )
}
