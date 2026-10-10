import type { AppState } from './reducer'
import { backupFilename, buildBackup } from './transfer'

/**
 * Hands the browser a backup file to save.
 *
 * Kept out of `transfer.ts` so that stays pure and testable: this is the one
 * part of backing up that needs the DOM. Two places offer it — Settings and
 * the staleness reminder on Today — and they must produce the same file.
 */
export function downloadBackup(state: AppState): void {
  const blob = new Blob([JSON.stringify(buildBackup(state), null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = backupFilename()
  link.click()
  URL.revokeObjectURL(url)
}
