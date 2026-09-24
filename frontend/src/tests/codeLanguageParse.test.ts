import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { loadLanguage } from 'frappe-ui/code-editor'

describe('code editor languages parse with the app copy of CodeMirror', () => {
	it.each([
		['html', '<p class="note">Hello</p>'],
		['javascript', 'const total = items.length + 1'],
	])('%s builds a non-empty syntax tree', async (key, doc) => {
		const language = await loadLanguage(key)
		expect(language).not.toBeNull()

		const state = EditorState.create({ doc, extensions: [language!] })

		expect(syntaxTree(state).length).toBeGreaterThan(0)
	})
})
