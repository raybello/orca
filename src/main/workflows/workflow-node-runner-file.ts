import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { FileReadData, FileWriteData } from '../../shared/workflow-types'

export type FileReadResult = { content: string }
export type FileWriteResult = { bytesWritten: number }

export async function runFileReadNode(data: FileReadData): Promise<FileReadResult> {
  const content = await readFile(data.filePath, 'utf8')
  return { content }
}

export async function runFileWriteNode(
  data: FileWriteData,
  resolvedContent: string
): Promise<FileWriteResult> {
  if (data.createParents) {
    await mkdir(dirname(data.filePath), { recursive: true })
  }
  await writeFile(
    data.filePath,
    resolvedContent,
    data.mode === 'append' ? { flag: 'a', encoding: 'utf8' } : { encoding: 'utf8' }
  )
  return { bytesWritten: Buffer.byteLength(resolvedContent, 'utf8') }
}
