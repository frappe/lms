/**
 * `text-ink-base` may only sit on a solid surface.
 *
 * `--ink-base` is the ink for inverted surfaces: in light mode it is
 * oklch(1 0 0), the exact value of `--surface-base`. The `-1`..`-4` steps of a
 * colour surface are pale tints (`--surface-green-3` is oklch(.908 .07 154.3),
 * `--surface-blue-3` is oklch(.925 .039 243.489)), so white ink on one lands
 * around 1.1:1 and the content is invisible. Dark mode inverts the ink to
 * oklch(.205 0 0) but those surfaces only reach oklch(.33), so it stays bad.
 *
 * frappe-ui's own pairings are the reference (Badge.vue:47-78): solid is
 * `text-ink-<colour>-1` on `bg-surface-<colour>-7`, subtle is
 * `text-ink-<colour>-8` on `bg-surface-<colour>-2`.
 *
 * Raw palette colours (`bg-purple-500`) are banned in the same sweep: the preset
 * builds them from lightModeColors whatever the theme, so they never adapt while
 * the ink on top of them does.
 */
import { describe, expect, it } from 'vitest'

// Vite's own loader rather than node:fs — it needs no @types/node, so the type
// check stays clean, and it resolves the same tree the app builds from.
const sources = import.meta.glob('../**/*.vue', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>

// A tint step, i.e. everything below the solid -7 the pairings use.
const INK_BASE_ON_TINT = /bg-surface-(?!gray-(?:9|10))[a-z]+-[1-4]\b/
const RAW_PALETTE =
	/\bbg-(purple|violet|pink|teal|cyan|indigo|emerald|lime|sky|fuchsia|rose|green|blue|red|amber|orange|yellow)-\d{2,3}\b/

describe('ink-on-tint contrast', () => {
	const files = Object.entries(sources)

	it('finds components to scan', () => {
		expect(files.length).toBeGreaterThan(50)
	})

	it('never puts text-ink-base on a tinted surface', () => {
		const offenders: string[] = []

		for (const [file, source] of files) {
			for (const [i, line] of source.split('\n').entries()) {
				if (!line.includes('text-ink-base')) continue
				if (INK_BASE_ON_TINT.test(line)) {
					offenders.push(`${file}:${i + 1}`)
				}
			}
		}

		expect(offenders).toEqual([])
	})

	it('uses no raw palette background', () => {
		const offenders: string[] = []

		for (const [file, source] of files) {
			for (const [i, line] of source.split('\n').entries()) {
				if (RAW_PALETTE.test(line)) {
					offenders.push(`${file}:${i + 1} — ${line.trim()}`)
				}
			}
		}

		expect(offenders).toEqual([])
	})
})
