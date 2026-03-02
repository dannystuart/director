import { useReducer, useEffect } from 'preact/hooks'
import { AppContext, appReducer, initialState } from './context'
import { FloatingIcon } from './components/FloatingIcon'
import { ElementSelector } from './components/ElementSelector'
import { AnnotationCard } from './components/AnnotationCard'
import { PinMarker } from './components/PinMarker'
import { ControlPanel } from './components/ControlPanel'
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
      {state.mode === 'selecting' && <ControlPanel />}
      {state.mode === 'annotating' && state.activeAnnotation && <AnnotationCard />}
      {state.mode !== 'inactive' &&
        state.annotations.map((ann) => <PinMarker key={ann.id} annotation={ann} />)}
    </AppContext.Provider>
  )
}
