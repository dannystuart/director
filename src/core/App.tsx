import { useReducer, useEffect, useMemo } from 'preact/hooks'
import { AppContext, appReducer, initialState } from './context'
import { useStorage } from './StorageContext'
import { FloatingIcon } from './components/FloatingIcon'
import { ElementSelector } from './components/ElementSelector'
import { AnnotationCard } from './components/AnnotationCard'
import { PinMarker } from './components/PinMarker'
import { ControlPanel } from './components/ControlPanel'
import { ReviewCard } from './components/ReviewCard'
import { ViewportOverlay } from './components/ViewportOverlay'
import { filterVisibleAnnotations } from './utils/pinFiltering'

export function App() {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const storage = useStorage()

  useEffect(() => {
    storage.load().then((data) => {
      dispatch({ type: 'SET_ANNOTATIONS', annotations: data.annotations })
      dispatch({ type: 'SET_VISION_MODE', enabled: data.settings.visionMode })
    })
  }, [])

  const visibleAnnotations = useMemo(
    () => filterVisibleAnnotations(state.annotations, state.viewport.width),
    [state.annotations, state.viewport.width]
  )

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <FloatingIcon />
      {state.mode === 'selecting' && <ElementSelector />}
      {(state.mode === 'selecting' || state.mode === 'reviewing') && <ControlPanel />}
      {state.mode === 'annotating' && state.activeAnnotation && <AnnotationCard />}
      {state.mode === 'reviewing' && state.activeAnnotation && <ReviewCard />}
      {state.mode !== 'inactive' &&
        visibleAnnotations.map((ann) => {
          const siblingIndex = visibleAnnotations
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
