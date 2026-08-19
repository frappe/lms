import { describe, expect, it } from 'vitest'

// Every createApp() builds its own app context, and global directives are not
// inherited from the main app. An unresolved directive is then dropped in
// silence: withDirectives guards the binding push behind `if (dir)`, and
// resolveDirective's warning is compiled out of a production build.
//
// That is how v-safe-html on Quiz.vue and v-external on PdfBlock.vue rendered
// correctly through the router and did nothing at all through the EditorJS
// block mounts in src/utils — on Safari and iOS only, for the PDF one.
const sources = import.meta.glob('../utils/*.{js,ts}', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>

const CREATE_APP = /\bcreateApp\s*\(/

describe('sub-apps register the global directives', () => {
	const mounts = Object.entries(sources).filter(([, src]) =>
		CREATE_APP.test(src)
	)

	it('finds the sub-app mounts to scan', () => {
		expect(mounts.length).toBeGreaterThan(0)
	})

	it('registers directives wherever it calls createApp', () => {
		const offenders = mounts
			.filter(([, src]) => {
				const creates = src.match(/\bcreateApp\s*\(/g)?.length ?? 0
				const registers = src.match(/\bregisterDirectives\s*\(/g)?.length ?? 0
				return registers < creates
			})
			.map(([path]) => path)
		expect(offenders, offenders.join('\n')).toEqual([])
	})
})
