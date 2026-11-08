import type { RecoverResult } from './types'
import { parseSnapshot } from './validate'

/**
 * Prefer the current snapshot. If it is missing or malformed, use the previous
 * recovery copy. Never invent seed data here.
 */
export function recoverSnapshot(
  currentRaw: string | null | undefined,
  previousRaw: string | null | undefined,
): RecoverResult {
  const currentEmpty = currentRaw == null || currentRaw.trim() === ''
  const previousEmpty = previousRaw == null || previousRaw.trim() === ''

  if (!currentEmpty) {
    const current = parseSnapshot(currentRaw)
    if (current.ok) return { source: 'current', data: current.data }
    if (!previousEmpty) {
      const previous = parseSnapshot(previousRaw)
      if (previous.ok) {
        return { source: 'previous', data: previous.data, currentError: current.error }
      }
      return {
        source: 'none',
        currentError: current.error,
        previousError: previous.error,
      }
    }
    return { source: 'none', currentError: current.error }
  }

  if (!previousEmpty) {
    const previous = parseSnapshot(previousRaw)
    if (previous.ok) return { source: 'previous', data: previous.data }
    return { source: 'none', previousError: previous.error }
  }

  return { source: 'none' }
}
