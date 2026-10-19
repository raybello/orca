import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createPdfjsViewerAssetsPlugin } from './build-plugins/pdfjs-viewer-assets'
import { createSurferViewerAssetsPlugin } from './build-plugins/surfer-viewer-assets'
import { createViteCacheRetentionPlugin } from './build-plugins/vite-cache-retention'

export function createRendererPlugins(): Plugin[] {
  return [
    react(),
    tailwindcss(),
    createPdfjsViewerAssetsPlugin(),
    createSurferViewerAssetsPlugin(),
    createViteCacheRetentionPlugin()
  ]
}
