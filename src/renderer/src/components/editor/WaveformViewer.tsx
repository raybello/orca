import { type JSX, useCallback, useEffect, useRef, useState } from 'react'
import { FileChartColumn } from 'lucide-react'
import { translate } from '@/i18n/i18n'

type WaveformViewerProps = {
  content: string
  filePath: string
}

export default function WaveformViewer({ content, filePath }: WaveformViewerProps): JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const waveformDataUriRef = useRef<string | null>(null)

  // Convert file content to data URI
  useEffect(() => {
    try {
      const base64Content = btoa(content)
      waveformDataUriRef.current = `data:application/octet-stream;base64,${base64Content}`
    } catch (error) {
      console.error('Failed to encode waveform content:', error)
      setLoadError('Failed to encode waveform file')
    }
  }, [content])

  // Handle messages from the iframe
  const handleMessage = useCallback((event: MessageEvent) => {
    const iframe = iframeRef.current
    if (!iframe || !iframe.contentWindow) {
      return
    }

    // Check if message is from our iframe
    if (event.source !== iframe.contentWindow) {
      return
    }

    // Handle the 'loaded' message from surfer
    if (event.data?.command === 'loaded') {
      console.log('Surfer viewer loaded, sending waveform file...')
      setIsLoading(false)

      // Send the waveform file to the viewer
      if (waveformDataUriRef.current) {
        iframe.contentWindow.postMessage(
          {
            command: 'LoadUrl',
            url: waveformDataUriRef.current
          },
          '*'
        )
      }
    }
  }, [])

  useEffect(() => {
    // Add message listener
    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [handleMessage])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) {
      return
    }

    setIsLoading(true)
    setLoadError(null)

    iframe.onerror = () => {
      setIsLoading(false)
      setLoadError(translate('waveform.load_error', 'Failed to load waveform viewer'))
    }

    // The surfer viewer assets are served by the Vite plugin at /surfer-viewer/
    iframe.src = '/surfer-viewer/index.html'
  }, [filePath])

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted/20 p-8 text-sm text-muted-foreground">
        <FileChartColumn size={40} />
        <div>{loadError}</div>
        <div className="max-w-md break-all text-center text-xs">{filePath}</div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 text-sm text-muted-foreground">
          {translate('waveform.loading', 'Loading waveform...')}
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="h-full w-full border-0"
        title={`Waveform viewer - ${filePath}`}
        sandbox="allow-scripts allow-same-origin allow-modals"
      />
    </div>
  )
}
