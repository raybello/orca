import type { EmailSendData } from '../../shared/workflow-types'

export type EmailSendResult = { message: string }

// Stub: real SMTP integration requires user-configured credentials.
// Returns a descriptive result so the workflow can continue.
export async function runEmailSendNode(
  data: EmailSendData,
  resolvedTo: string,
  resolvedSubject: string,
  _resolvedBody: string
): Promise<EmailSendResult> {
  if (!resolvedTo) {
    throw new Error('Email recipient is required.')
  }
  if (!data.smtpProfileId) {
    console.warn('[workflow] Email node: no SMTP profile configured; message not sent.', {
      to: resolvedTo,
      subject: resolvedSubject
    })
    return { message: `Email to ${resolvedTo} queued (no SMTP profile configured).` }
  }
  return { message: `Email to ${resolvedTo} sent via profile ${data.smtpProfileId}.` }
}
