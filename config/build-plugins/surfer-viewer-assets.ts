import { createReadStream, cpSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import type { Plugin } from 'vite'

const SURFER_VIEWER_DIR = 'surfer-viewer' as const

function surferViewerRoot(): string {
  return resolve(process.cwd(), 'resources', SURFER_VIEWER_DIR)
}

function assetPath(root: string, pathname: string): string | undefined {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return undefined
  }
  if (decoded.includes('\0') || decoded.includes('\\')) {
    return undefined
  }

  // Check if the path starts with /surfer-viewer/
  if (!decoded.startsWith('/surfer-viewer/')) {
    return undefined
  }

  // Remove the /surfer-viewer/ prefix
  const relativePath = decoded.slice('/surfer-viewer/'.length)
  const parts = relativePath.split('/').filter(Boolean)

  if (parts.length === 0) {
    return undefined
  }
  if (parts.some((part) => part === '.' || part === '..' || part.includes('\\'))) {
    return undefined
  }

  const candidate = resolve(root, ...parts)
  const withinBase = relative(root, candidate)
  if (withinBase.length === 0 || withinBase.startsWith('..') || isAbsolute(withinBase)) {
    return undefined
  }
  return candidate
}

function copyAssets(root: string, outputDir: string): void {
  const targetDir = join(outputDir, SURFER_VIEWER_DIR)
  if (!existsSync(root)) {
    throw new Error(`[surfer-viewer-assets] missing ${root}`)
  }
  cpSync(root, targetDir, { recursive: true })
}

export function createSurferViewerAssetsPlugin(root = surferViewerRoot()): Plugin {
  return {
    name: 'surfer-viewer-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        let pathname: string
        try {
          pathname = new URL(request.url ?? '/', 'http://localhost').pathname
        } catch {
          next()
          return
        }
        const filePath = assetPath(root, pathname)
        if (!filePath || (request.method !== 'GET' && request.method !== 'HEAD')) {
          next()
          return
        }
        let size: number
        try {
          size = statSync(filePath).size
        } catch {
          next()
          return
        }
        if (response.destroyed) {
          return
        }
        response.statusCode = 200
        response.setHeader('Content-Length', size)

        // Set appropriate content type based on file extension
        const ext = extname(filePath)
        let contentType = 'application/octet-stream'
        if (ext === '.wasm') {
          contentType = 'application/wasm'
        } else if (ext === '.js' || ext === '.mjs') {
          contentType = 'application/javascript'
        } else if (ext === '.html') {
          contentType = 'text/html'
        } else if (ext === '.json') {
          contentType = 'application/json'
        }
        response.setHeader('Content-Type', contentType)

        if (request.method === 'HEAD') {
          response.end()
          return
        }
        const stream = createReadStream(filePath)
        const stopReading = (): void => {
          stream.destroy()
        }
        response.once('close', stopReading)
        response.once('error', stopReading)
        stream.once('close', () => {
          response.off('close', stopReading)
          response.off('error', stopReading)
        })
        stream.once('error', () => response.destroy())
        stream.pipe(response)
      })
    },
    writeBundle(options) {
      if (!options.dir) {
        throw new Error('[surfer-viewer-assets] output directory is required')
      }
      mkdirSync(options.dir, { recursive: true })
      copyAssets(root, options.dir)
    }
  }
}
