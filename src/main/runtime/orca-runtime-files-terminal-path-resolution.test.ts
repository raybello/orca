import { SshHostNotServedError } from '../providers/ssh-host-not-served-error'
import { describe, expect, it, vi } from 'vitest'
import { chmod, mkdtemp, readFile, realpath } from 'node:fs/promises'
import type * as NodeFsPromises from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renameMock, resolveAuthorizedPathMock, statMock } from './orca-runtime-files-mock-registry'
import {
  createRuntimeFileCommands,
  useRuntimeFileCommandsLifecycle
} from './orca-runtime-files-test-harness'
import {
  absoluteFileTarget,
  resolveTerminalArtifactPath,
  statAsFile,
  useTerminalArtifactTempFiles
} from './orca-runtime-files-terminal-artifact-fixtures'

vi.mock('fs', async () => (await import('./orca-runtime-files-mock-registry')).fsModuleMock())
vi.mock('fs/promises', async () =>
  (await import('./orca-runtime-files-mock-registry')).fsPromisesModuleMock()
)
vi.mock(
  './file-watcher-host',
  async () => (await import('./orca-runtime-files-mock-registry')).fileWatcherHostMock
)
vi.mock('../ipc/filesystem-auth', async () =>
  (await import('./orca-runtime-files-mock-registry')).filesystemAuthModuleMock()
)
vi.mock('../git/runner', async () =>
  (await import('./orca-runtime-files-mock-registry')).gitRunnerModuleMock()
)
vi.mock(
  '../ipc/local-worktree-runtime-options',
  async () => (await import('./orca-runtime-files-mock-registry')).localWorktreeRuntimeOptionsMock
)

describe('RuntimeFileCommands', () => {
  useRuntimeFileCommandsLifecycle()

  describe('resolveTerminalPath', () => {
    const { tempFile } = useTerminalArtifactTempFiles()
    it('resolves an absolute path inside the worktree to a relative path', async () => {
      const { commands } = createRuntimeFileCommands({ path: '/repo' })
      statAsFile()

      const result = await commands.resolveTerminalPath('id:wt-1', '/repo/src/index.ts')

      expect(result).toEqual({
        worktree: 'wt-1',
        relativePath: 'src/index.ts',
        absolutePath: '/repo/src/index.ts',
        exists: true,
        isDirectory: false,
        openTarget: {
          kind: 'worktree-file',
          provider: 'local',
          relativePath: 'src/index.ts',
          absolutePath: '/repo/src/index.ts'
        }
      })
    })

    it('keeps in-worktree resolution unchanged when chat provenance is present', async () => {
      const hasRecentNativeChatOutputPath = vi.fn(() => true)
      const { commands } = createRuntimeFileCommands({
        path: '/repo',
        hasRecentNativeChatOutputPath
      })
      statAsFile()

      const result = await commands.resolveTerminalPath(
        'id:wt-1',
        '/repo/src/index.ts',
        null,
        'client-a',
        null,
        true,
        { tabId: 'tab-1', sessionId: 'session-1' }
      )

      expect(result).toMatchObject({ relativePath: 'src/index.ts', exists: true })
      expect(hasRecentNativeChatOutputPath).not.toHaveBeenCalled()
    })

    it('resolves an absolute path through a known sibling workspace', async () => {
      const sibling = {
        id: 'wt-2',
        repoId: 'repo-2',
        path: '/sibling',
        git: {
          path: '/sibling',
          head: '',
          branch: '',
          isBare: false,
          isMainWorktree: true
        }
      }
      const resolveKnownWorkspaceFileTarget = vi.fn(async () => ({
        worktree: sibling,
        executionHostId: 'local',
        relativePath: 'docs/readme.md'
      }))
      const { commands } = createRuntimeFileCommands({
        path: '/repo',
        resolveKnownWorkspaceFileTarget
      })
      statAsFile()

      const result = await commands.resolveTerminalPath(
        'id:wt-1',
        '/sibling/docs/readme.md',
        null,
        undefined,
        null,
        true
      )

      expect(resolveKnownWorkspaceFileTarget).toHaveBeenCalledWith(
        '/sibling/docs/readme.md',
        'local'
      )
      expect(result).toEqual({
        worktree: 'wt-2',
        relativePath: 'docs/readme.md',
        absolutePath: '/sibling/docs/readme.md',
        exists: true,
        isDirectory: false,
        openTarget: {
          kind: 'worktree-file',
          provider: 'local',
          relativePath: 'docs/readme.md',
          absolutePath: '/sibling/docs/readme.md'
        }
      })
    })

    it('resolves an exact local sibling workspace root as a directory without a grant', async () => {
      const sibling = {
        id: 'wt-2',
        repoId: 'repo-2',
        path: '/sibling',
        git: {
          path: '/sibling',
          head: '',
          branch: '',
          isBare: false,
          isMainWorktree: true
        }
      }
      const resolveKnownWorkspaceFileTarget = vi.fn(async () => ({
        worktree: sibling,
        executionHostId: 'local',
        relativePath: ''
      }))
      const hasRecentTerminalOutputPath = vi.fn(() => true)
      const { commands } = createRuntimeFileCommands({
        path: '/repo',
        resolveKnownWorkspaceFileTarget,
        hasRecentTerminalOutputPath
      })
      resolveAuthorizedPathMock.mockImplementation(async (p: string) => p)
      statMock.mockResolvedValue({ isDirectory: () => true })

      const result = await resolveTerminalArtifactPath(commands, '/sibling', null, 'client-a', true)

      expect(resolveKnownWorkspaceFileTarget).toHaveBeenCalledWith('/sibling', 'local')
      expect(result).toEqual({
        worktree: 'wt-2',
        relativePath: '',
        absolutePath: '/sibling',
        exists: true,
        isDirectory: true,
        openTarget: undefined
      })
      expect(hasRecentTerminalOutputPath).not.toHaveBeenCalled()
    })

    it('refuses an SSH workspace path instead of stating this machine', async () => {
      const { commands, store } = createRuntimeFileCommands({ path: '/repo' })
      store.getRepo.mockReturnValue({ connectionId: 'ssh-1' })

      await expect(commands.resolveTerminalPath('id:wt-1', 'src/app.ts')).rejects.toThrow(
        SshHostNotServedError
      )
      expect(statMock).not.toHaveBeenCalled()
    })

    // The host was `runtime:env-a` until this process stopped dispatching runtime hosts at all
    // (see runtime-file-target-execution-host.test.ts); an SSH host proves the same scoping on a
    // host this process actually serves.
    it('scopes sibling lookup to the selected worktree execution host', async () => {
      const resolveKnownWorkspaceFileTarget = vi.fn(async () => null)
      const { commands } = createRuntimeFileCommands({
        path: '/repo-a',
        hostId: 'ssh:openclaw',
        resolveKnownWorkspaceFileTarget
      })

      await commands.resolveTerminalPath(
        'id:wt-1',
        '/repo-b/docs/readme.md',
        null,
        undefined,
        null,
        true
      )

      expect(resolveKnownWorkspaceFileTarget).toHaveBeenCalledWith(
        '/repo-b/docs/readme.md',
        'ssh:openclaw'
      )
    })

    // Why: clients predating crossWorkspace (mobile <=0.0.36) reuse their own worktree
    // id for files.open, so they must keep the pre-sibling-resolution contract.
    it('keeps the caller worktree and a null relativePath when crossWorkspace is not requested', async () => {
      const resolveKnownWorkspaceFileTarget = vi.fn(async () => ({
        worktree: {
          id: 'wt-2',
          repoId: 'repo-2',
          path: '/sibling',
          git: { path: '/sibling', head: '', branch: '', isBare: false, isMainWorktree: true }
        },
        relativePath: 'docs/readme.md'
      }))
      const { commands } = createRuntimeFileCommands({
        path: '/repo',
        resolveKnownWorkspaceFileTarget
      })
      statAsFile()

      const result = await commands.resolveTerminalPath('id:wt-1', '/sibling/docs/readme.md')

      expect(resolveKnownWorkspaceFileTarget).not.toHaveBeenCalled()
      expect(result).toEqual({
        worktree: 'wt-1',
        relativePath: null,
        absolutePath: '/sibling/docs/readme.md',
        exists: false,
        isDirectory: false
      })
    })

    // Why: go-to-file accepts a path the user typed anywhere on the host, as a local one does.
    it('grants a user-opened file outside every workspace with the host edit capability', async () => {
      const artifactPath = await realpath(await tempFile('Dockerfile', 'FROM scratch\n'))
      const { commands } = createRuntimeFileCommands({ path: '/repo' })

      const result = await commands.resolveTerminalPath(
        'id:wt-1',
        artifactPath,
        null,
        'client-a',
        null,
        false,
        null,
        true
      )
      const target = absoluteFileTarget(result)

      expect(result).toMatchObject({
        worktree: 'wt-1',
        relativePath: null,
        absolutePath: artifactPath,
        exists: true,
        isDirectory: false,
        openTarget: {
          kind: 'absolute-file',
          provider: 'local',
          absolutePath: artifactPath
        }
      })
      expect(result.openTarget).not.toHaveProperty('readOnly')
      await expect(
        commands.readTerminalArtifactFile(
          'id:wt-1',
          target.grantId,
          target.absolutePath,
          'client-a'
        )
      ).resolves.toMatchObject({ content: 'FROM scratch\n' })

      // The shared fs mock stubs rename; this case exercises the real atomic replace.
      const actualFsPromises = await vi.importActual<typeof NodeFsPromises>('node:fs/promises')
      renameMock.mockImplementation((from, to) => actualFsPromises.rename(from, to))
      const written = await commands.writeTerminalArtifactFile(
        'id:wt-1',
        target.grantId,
        target.absolutePath,
        'FROM alpine\n',
        'client-a'
      )
      expect(written).toEqual({ ok: true })
      expect(await readFile(artifactPath, 'utf8')).toBe('FROM alpine\n')
      await expect(
        commands.readTerminalArtifactFile(
          'id:wt-1',
          target.grantId,
          target.absolutePath,
          'client-a'
        )
      ).resolves.toMatchObject({ content: 'FROM alpine\n' })
    })

    it('keeps a user-opened file the host cannot write read-only', async () => {
      const artifactPath = await realpath(await tempFile('locked.txt', 'locked\n'))
      await chmod(artifactPath, 0o444)
      try {
        const { commands } = createRuntimeFileCommands({ path: '/repo' })
        const result = await commands.resolveTerminalPath(
          'id:wt-1',
          artifactPath,
          null,
          'client-a',
          null,
          false,
          null,
          true
        )
        const target = absoluteFileTarget(result)

        expect(result.openTarget).toMatchObject({ readOnly: true })
        await expect(
          commands.writeTerminalArtifactFile(
            'id:wt-1',
            target.grantId,
            target.absolutePath,
            'changed\n',
            'client-a'
          )
        ).rejects.toThrow('terminal_file_grant_read_only')
      } finally {
        await chmod(artifactPath, 0o644)
      }
    })

    it('reports a missing user-opened path as missing instead of refusing it', async () => {
      const missingPath = join(
        await realpath(await mkdtemp(join(tmpdir(), 'orca-user-opened-'))),
        'nope.ts'
      )
      const { commands } = createRuntimeFileCommands({ path: '/repo' })

      const result = await commands.resolveTerminalPath(
        'id:wt-1',
        missingPath,
        null,
        'client-a',
        null,
        false,
        null,
        true
      )

      expect(result).toMatchObject({ exists: false, relativePath: null })
      expect(result.openTarget).toBeUndefined()
    })

    it('answers a user-opened directory without a grant and keeps the refusal without the flag', async () => {
      const directory = await realpath(await mkdtemp(join(tmpdir(), 'orca-user-opened-dir-')))
      const { commands } = createRuntimeFileCommands({ path: '/repo' })

      const unopened = await commands.resolveTerminalPath('id:wt-1', directory)
      const opened = await commands.resolveTerminalPath(
        'id:wt-1',
        directory,
        null,
        'client-a',
        null,
        false,
        null,
        true
      )

      expect(unopened).toMatchObject({ exists: false, relativePath: null })
      expect(opened).toMatchObject({
        exists: true,
        isDirectory: true,
        relativePath: null,
        openTarget: undefined
      })
    })

    it('resolves a relative path against the provided cwd', async () => {
      const { commands } = createRuntimeFileCommands({ path: '/repo' })
      statAsFile()

      const result = await commands.resolveTerminalPath('id:wt-1', 'index.ts', '/repo/src')

      expect(result).toMatchObject({ relativePath: 'src/index.ts', exists: true })
    })

    it('prefers the source terminal cwd over stale mobile cached cwd metadata', async () => {
      const resolveTerminalCwd = vi.fn(() => '/repo/current')
      const { commands } = createRuntimeFileCommands({ path: '/repo', resolveTerminalCwd })
      statAsFile()

      const result = await commands.resolveTerminalPath(
        'id:wt-1',
        'index.ts',
        '/repo/stale',
        'client-a',
        'term-1'
      )

      expect(resolveTerminalCwd).toHaveBeenCalledWith('term-1')
      expect(result).toMatchObject({ relativePath: 'current/index.ts', exists: true })
    })

    it('falls back to the source terminal cwd when mobile has not cached cwd metadata', async () => {
      const resolveTerminalCwd = vi.fn(() => '/repo/src')
      const { commands } = createRuntimeFileCommands({ path: '/repo', resolveTerminalCwd })
      statAsFile()

      const result = await commands.resolveTerminalPath(
        'id:wt-1',
        'index.ts',
        null,
        'client-a',
        'term-1'
      )

      expect(resolveTerminalCwd).toHaveBeenCalledWith('term-1')
      expect(result).toMatchObject({ relativePath: 'src/index.ts', exists: true })
    })

    it('awaits async source terminal cwd fallback from the PTY provider', async () => {
      const resolveTerminalCwd = vi.fn(async () => '/repo/packages/app')
      const { commands } = createRuntimeFileCommands({ path: '/repo', resolveTerminalCwd })
      statAsFile()

      const result = await commands.resolveTerminalPath(
        'id:wt-1',
        'package.json',
        null,
        'client-a',
        'term-1'
      )

      expect(result).toMatchObject({ relativePath: 'packages/app/package.json', exists: true })
    })

    it('resolves a relative path against the worktree root when no cwd is given', async () => {
      const { commands } = createRuntimeFileCommands({ path: '/repo' })
      statAsFile()

      const result = await commands.resolveTerminalPath('id:wt-1', 'docs/readme.md')

      expect(result).toMatchObject({ relativePath: 'docs/readme.md', exists: true })
    })

    it('reports directories including the workspace root', async () => {
      const { commands } = createRuntimeFileCommands({ path: '/repo' })
      resolveAuthorizedPathMock.mockImplementation(async (p: string) => p)
      statMock.mockResolvedValue({ isDirectory: () => true })

      const nestedResult = await commands.resolveTerminalPath('id:wt-1', '/repo/src')
      const rootResult = await commands.resolveTerminalPath('id:wt-1', '/repo')

      expect(nestedResult).toMatchObject({ relativePath: 'src', isDirectory: true, exists: true })
      expect(rootResult).toMatchObject({
        relativePath: '',
        isDirectory: true,
        exists: true,
        openTarget: undefined
      })
    })

    it('keeps an exact selected nested root instead of resolving it to a parent workspace', async () => {
      const resolveKnownWorkspaceFileTarget = vi.fn(async () => ({
        worktree: { id: 'wt-parent', repoId: 'repo-parent', path: '/repo' },
        relativePath: 'nested'
      }))
      const { commands } = createRuntimeFileCommands({
        path: '/repo/nested',
        resolveKnownWorkspaceFileTarget
      })
      resolveAuthorizedPathMock.mockImplementation(async (p: string) => p)
      statMock.mockResolvedValue({ isDirectory: () => true })

      const result = await commands.resolveTerminalPath('id:wt-1', '/repo/nested')

      expect(resolveKnownWorkspaceFileTarget).not.toHaveBeenCalled()
      expect(result).toMatchObject({
        worktree: 'wt-1',
        relativePath: '',
        isDirectory: true,
        openTarget: undefined
      })
    })

    it('reports a nonexistent in-worktree path as not existing', async () => {
      const { commands } = createRuntimeFileCommands({ path: '/repo' })
      resolveAuthorizedPathMock.mockImplementation(async (p: string) => p)
      statMock.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

      const result = await commands.resolveTerminalPath('id:wt-1', 'src/missing.ts')

      expect(result).toMatchObject({ relativePath: 'src/missing.ts', exists: false })
    })

    it('does not expand ~/ on a remote worktree (home is unknown)', async () => {
      const { commands, store } = createRuntimeFileCommands({ path: '/repo' })
      store.getRepo.mockReturnValue({ connectionId: 'ssh-1' })

      const result = await commands.resolveTerminalPath('id:wt-1', '~/notes.md')

      expect(result).toMatchObject({ relativePath: null, exists: false })
      expect(statMock).not.toHaveBeenCalled()
    })

    it('still refuses a native-chat ~/ path on a remote worktree', async () => {
      const hasRecentNativeChatOutputPath = vi.fn(() => true)
      const { commands, store } = createRuntimeFileCommands({
        path: '/repo',
        hasRecentNativeChatOutputPath
      })
      store.getRepo.mockReturnValue({ connectionId: 'ssh-1' })

      const result = await commands.resolveTerminalPath(
        'id:wt-1',
        '~/notes.md',
        null,
        'client-a',
        null,
        true,
        { tabId: 'tab-1', sessionId: 'session-1' }
      )

      expect(result).toMatchObject({ relativePath: null, exists: false })
      expect(hasRecentNativeChatOutputPath).not.toHaveBeenCalled()
    })
  })
})
