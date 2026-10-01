// Why: only the initial value shown in Settings; buildFontFamily() adds the real cross-platform fallback chain.
export function defaultTerminalFontFamily(): string {
  return 'Fira Code'
}

export const getDefaultPrimarySelectionMiddleClickPaste = (
  platform = typeof process !== 'undefined' ? process.platform : ''
): boolean => platform === 'linux' || platform === 'darwin'

export const getDefaultTerminalRightClickToPaste = (
  platform = typeof process !== 'undefined' ? process.platform : ''
): boolean => platform === 'win32'
