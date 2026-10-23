import { access, constants } from 'node:fs/promises'
import {
  RuntimeTerminalFileGrants,
  type RuntimeTerminalFileGrantHost,
  type TerminalFileGrant
} from './file-grants'
import type {
  RuntimeFilePreviewResult,
  RuntimeFileReadResult,
  RuntimeTerminalPathResolution
} from '../../../../shared/runtime-file-contracts'
import {
  canonicalPathForArtifactComparison,
  isTerminalArtifactHardLinked,
  truncateMobileFilePreview
} from './artifact-integrity'
import {
  resolveAllowedLocalTerminalArtifactPath,
  openLocalTerminalArtifactGrant,
  readLocalTerminalArtifactFileFromHandle,
  readLocalTerminalArtifactPreviewFromHandle
} from './local-artifact-read'
import { statLocalTerminalArtifact } from './artifact-stat'
import { requireReachableFilesystemRoute } from '../../../providers/execution-host-provider-dispatch'
import { getConnectionExecutionHostId } from '../../../../shared/execution-host'
import {
  assertPreviewWithinTransportBudget,
  MOBILE_FILE_READ_MAX_BYTES
} from '../../files/file-preview-budget'
import { SshHostNotServedError } from '../../../providers/ssh-host-not-served-error'
import { isMobileBinaryPath } from '../../files/mobile-file-kind'
import { writeTerminalArtifactFile } from './artifact-write'

export class RuntimeTerminalArtifacts {
  private readonly grants: RuntimeTerminalFileGrants

  constructor(host: RuntimeTerminalFileGrantHost) {
    this.grants = new RuntimeTerminalFileGrants(host)
  }

  async resolveAllowedTerminalArtifactPath(args: {
    absolutePath: string
    connectionId?: string
    worktreePath: string
  }): Promise<string | null> {
    if (args.connectionId) {
      throw new SshHostNotServedError(args.connectionId)
    }
    return resolveAllowedLocalTerminalArtifactPath(args.absolutePath, args.worktreePath)
  }

  async resolveNativeChatArtifactPath(
    absolutePath: string,
    connectionId?: string
  ): Promise<string> {
    requireReachableFilesystemRoute(getConnectionExecutionHostId(connectionId))
    return canonicalPathForArtifactComparison(absolutePath)
  }

  async resolveAbsoluteFileGrant(args: {
    worktreeId: string
    artifactPath: string
    rejectedAbsolutePath?: string
    clientId?: string
    readOnly?: boolean
    /** Lets the host's own permissions decide, for a path the user asked to edit. */
    editableWhenWritable?: boolean
    provenance?: TerminalFileGrant['provenance']
  }): Promise<RuntimeTerminalPathResolution> {
    const { stats, contentDigest } = await statLocalTerminalArtifact(args.artifactPath)
    const isDirectory = stats.isDirectory()
    if (!isDirectory && isTerminalArtifactHardLinked(stats)) {
      return {
        worktree: args.worktreeId,
        relativePath: null,
        absolutePath: args.rejectedAbsolutePath ?? args.artifactPath,
        exists: false,
        isDirectory: false
      }
    }
    const grant = isDirectory
      ? null
      : this.grants.createTerminalFileGrant({
          worktreeId: args.worktreeId,
          absolutePath: args.artifactPath,
          clientId: args.clientId,
          // Why size too: a truncated read would let a save shrink the file it only partly saw.
          readOnly:
            args.readOnly === true ||
            (args.editableWhenWritable === true &&
              !(await isEditableFile(args.artifactPath, stats.size))),
          provenance: args.provenance ?? 'terminal-output',
          stats,
          contentDigest
        })
    return {
      worktree: args.worktreeId,
      relativePath: null,
      absolutePath: args.artifactPath,
      exists: true,
      isDirectory,
      openTarget: grant
        ? {
            kind: 'absolute-file',
            provider: grant.provider,
            absolutePath: args.artifactPath,
            grantId: grant.id,
            ...(grant.readOnly ? { readOnly: true } : {})
          }
        : undefined
    }
  }

  async readTerminalArtifactFile(
    worktreeSelector: string,
    grantId: string,
    absolutePath: string,
    clientId?: string
  ): Promise<RuntimeFileReadResult> {
    const { grant, target } = await this.grants.requireTerminalFileGrant(
      worktreeSelector,
      grantId,
      absolutePath,
      clientId
    )
    if (isMobileBinaryPath(grant.absolutePath)) {
      throw new Error('binary_file')
    }
    let content: string
    const handle = await openLocalTerminalArtifactGrant(grant, constants.O_RDONLY)
    try {
      content = await readLocalTerminalArtifactFileFromHandle(handle, grant)
    } finally {
      await handle.close()
    }
    this.grants.refreshTerminalFileGrant(grant)
    const truncated = truncateMobileFilePreview(content)

    return {
      worktree: target.worktree.id,
      relativePath: grant.absolutePath,
      content: truncated.content,
      truncated: truncated.truncated,
      byteLength: truncated.byteLength
    }
  }

  async readTerminalArtifactPreview(
    worktreeSelector: string,
    grantId: string,
    absolutePath: string,
    clientId?: string,
    maxContentBytes?: number
  ): Promise<RuntimeFilePreviewResult> {
    const { grant } = await this.grants.requireTerminalFileGrant(
      worktreeSelector,
      grantId,
      absolutePath,
      clientId
    )
    const handle = await openLocalTerminalArtifactGrant(grant, constants.O_RDONLY)
    try {
      const preview = await readLocalTerminalArtifactPreviewFromHandle(
        handle,
        grant,
        maxContentBytes
      )
      this.grants.refreshTerminalFileGrant(grant)
      return assertPreviewWithinTransportBudget(preview, maxContentBytes)
    } finally {
      await handle.close()
    }
  }

  revokeTerminalFileGrantsForClient(clientId: string): void {
    this.grants.revokeTerminalFileGrantsForClient(clientId)
  }

  writeTerminalArtifactFile(
    worktreeSelector: string,
    grantId: string,
    absolutePath: string,
    content: string,
    clientId?: string
  ): Promise<{ ok: true }> {
    return writeTerminalArtifactFile(
      this.grants,
      worktreeSelector,
      grantId,
      absolutePath,
      content,
      clientId
    )
  }
}

/**
 * A tab may edit only when one read holds the whole file and the host's own permissions allow a
 * write; either refusal is what the read-only tab communicates.
 */
async function isEditableFile(absolutePath: string, size: number | undefined): Promise<boolean> {
  if (Number(size ?? 0) > MOBILE_FILE_READ_MAX_BYTES) {
    return false
  }
  try {
    await access(absolutePath, constants.W_OK)
    return true
  } catch {
    return false
  }
}
