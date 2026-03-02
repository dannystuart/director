import { defineConfig } from 'vite'
import { annotateUI } from 'vibe-annotator'

export default defineConfig({
  plugins: [annotateUI()],
})
