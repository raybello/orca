import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runFileReadNode, runFileWriteNode } from './workflow-node-runner-file'

let tmpDir: string

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'orca-file-runner-test-'))
})

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('runFileReadNode', () => {
  it('reads the content of an existing file', async () => {
    const path = join(tmpDir, 'read-test.txt')
    await runFileWriteNode(
      { filePath: path, content: 'hello', mode: 'overwrite', createParents: false },
      'hello'
    )
    const result = await runFileReadNode({ filePath: path })
    expect(result.content).toBe('hello')
  })

  it('throws when file does not exist', async () => {
    await expect(runFileReadNode({ filePath: join(tmpDir, 'nonexistent.txt') })).rejects.toThrow()
  })
})

describe('runFileWriteNode', () => {
  it('creates a new file with overwrite mode', async () => {
    const path = join(tmpDir, 'write-new.txt')
    const result = await runFileWriteNode(
      { filePath: path, content: 'content', mode: 'overwrite', createParents: false },
      'content'
    )
    expect(result.bytesWritten).toBeGreaterThan(0)
    expect(await readFile(path, 'utf8')).toBe('content')
  })

  it('replaces existing content in overwrite mode', async () => {
    const path = join(tmpDir, 'overwrite.txt')
    await runFileWriteNode(
      { filePath: path, content: 'original', mode: 'overwrite', createParents: false },
      'original'
    )
    await runFileWriteNode(
      { filePath: path, content: 'replaced', mode: 'overwrite', createParents: false },
      'replaced'
    )
    expect(await readFile(path, 'utf8')).toBe('replaced')
  })

  it('appends to existing content in append mode', async () => {
    const path = join(tmpDir, 'append.txt')
    await runFileWriteNode(
      { filePath: path, content: 'first', mode: 'overwrite', createParents: false },
      'first'
    )
    await runFileWriteNode(
      { filePath: path, content: 'second', mode: 'append', createParents: false },
      'second'
    )
    expect(await readFile(path, 'utf8')).toBe('firstsecond')
  })

  it('creates parent directories when createParents is true', async () => {
    const path = join(tmpDir, 'nested', 'deep', 'file.txt')
    await runFileWriteNode(
      { filePath: path, content: 'hi', mode: 'overwrite', createParents: true },
      'hi'
    )
    expect(await readFile(path, 'utf8')).toBe('hi')
  })

  it('throws when parent directory does not exist and createParents is false', async () => {
    const path = join(tmpDir, 'missing-parent', 'file.txt')
    await expect(
      runFileWriteNode(
        { filePath: path, content: 'hi', mode: 'overwrite', createParents: false },
        'hi'
      )
    ).rejects.toThrow()
  })

  it('reports bytesWritten matching the byte length of the content', async () => {
    const path = join(tmpDir, 'bytes.txt')
    const content = 'hello'
    const result = await runFileWriteNode(
      { filePath: path, content, mode: 'overwrite', createParents: false },
      content
    )
    expect(result.bytesWritten).toBe(Buffer.byteLength(content, 'utf8'))
  })
})
