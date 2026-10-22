// Cursor agent-transcripts JSONL line → NativeChatMessage decoder.
// Record shape: {"role":"user"|"assistant","message":{"content":[...]},"timestamp":"..."}

import type { NativeChatMessage } from '../../shared/native-chat-types'
import {
  asRecord,
  extractString,
  parseJsonObject,
  timestampMs
} from '../ai-vault/session-scanner-values'
import { claudeContentBlocks } from './transcript-record-blocks'

export function decodeCursorTranscriptLine(
  line: string,
  fallbackId: string
): NativeChatMessage | null {
  const record = parseJsonObject(line)
  if (!record) {
    return null
  }
  const role = extractString(record.role)
  if (role !== 'user' && role !== 'assistant') {
    return null
  }
  const timestamp = parseTimestamp(record.timestamp)
  // Cursor nests content under message.content; some records put it directly on content.
  const content = asRecord(record.message)?.content ?? record.content
  const blocks = claudeContentBlocks(content)
  if (blocks.length === 0) {
    return null
  }
  return {
    id: fallbackId,
    role,
    blocks,
    timestamp,
    source: 'transcript'
  }
}

function parseTimestamp(value: unknown): number | null {
  const parsed = timestampMs(value)
  return Number.isFinite(parsed) ? parsed : null
}
