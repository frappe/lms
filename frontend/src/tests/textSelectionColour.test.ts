// Guards lesson text selection staying readable in dark mode. EditorJS injects
// a fixed light-blue ::selection with no text colour. Came with this branch's
// lesson selection-colour fix; added on feat/assessment-visual-redesign.
import { describe, expect, it } from 'vitest'
import { onDisk } from '@/tests/helpers/designTokens'

const css = onDisk('styles/blockEditor.css')

const ruleFor = (selector: string): string => {
	const at = css.indexOf(`${selector} {`)
	expect(at, `${selector} is styled`).toBeGreaterThanOrEqual(0)
	return css.slice(at, css.indexOf('}', at))
}

describe('text selection in the lesson editor', () => {
	it.each(['::selection', '::-moz-selection'])(
		'draws %s from theme tokens, text colour included',
		(pseudo) => {
			const rule = ruleFor(`body .codex-editor ${pseudo}`)

			expect(rule).toContain('background-color: var(--surface-blue-3)')
			expect(rule).toContain('color: var(--ink-gray-9)')
		}
	)
})
