export const WAVEFORM_EXTENSIONS = ['.vcd', '.fst', '.ghw'] as const
export type WaveformExtension = (typeof WAVEFORM_EXTENSIONS)[number]

export function isWaveformFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return (WAVEFORM_EXTENSIONS as readonly string[]).includes(ext)
}

export function getWaveformExtension(filePath: string): WaveformExtension | null {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  if ((WAVEFORM_EXTENSIONS as readonly string[]).includes(ext)) {
    return ext as WaveformExtension
  }
  return null
}
