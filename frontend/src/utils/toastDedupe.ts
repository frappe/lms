import { toast } from 'frappe-ui'
import type { ToastOptions } from 'frappe-ui'

const TYPES = ['success', 'error', 'warning', 'info'] as const

/**
 * A repeated message replaces the toast already on screen instead of stacking
 * a copy: a double click, a retry or a loop that fails the same way showed the
 * same text several times. vue-sonner updates a toast in place when it is given
 * an id it already shows, so the message (with its type) is the id. A caller's
 * own id still wins.
 */
export function dedupeToasts(): void {
	for (const type of TYPES) {
		const show = toast[type]
		toast[type] = (message, data?: ToastOptions) =>
			show(message, {
				...(typeof message === 'string' ? { id: `${type}:${message}` } : {}),
				...data,
			})
	}
}
