import { type JSX, useEffect, useRef, useState } from 'react'
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

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) {
      return
    }

    setIsLoading(true)
    setLoadError(null)

    // Convert file content to data URI for the waveform file
    const base64Content = btoa(content)
    const waveformDataUri = `data:application/octet-stream;base64,${base64Content}`

    // Build the iframe source URL pointing to the surfer viewer
    // The surfer viewer will be loaded from the resources directory
    const surferViewerUrl = new URL(
      '../../../../../resources/surfer-viewer/index.html',
      import.meta.url
    ).href

    iframe.onload = () => {
      setIsLoading(false)
      // Once loaded, tell surfer to load the waveform file
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          {
            command: 'LoadUrl',
            url: waveformDataUri
          },
          '*'
        )
      }
    }

    iframe.onerror = () => {
      setIsLoading(false)
      setLoadError(translate('waveform.load_error', 'Failed to load waveform viewer'))
    }

    iframe.src = surferViewerUrl
  }, [content, filePath])

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
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
