import { createContext } from 'preact'
import { useContext } from 'preact/hooks'
import type { StorageAdapter } from '../shared/storage'

export const StorageContext = createContext<StorageAdapter | null>(null)

export function useStorage(): StorageAdapter {
  const adapter = useContext(StorageContext)
  if (!adapter) throw new Error('StorageContext not provided — wrap your app in <StorageContext.Provider>')
  return adapter
}
