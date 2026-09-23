import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
	resolve(
		process.cwd(),
		'src/pages/ProgrammingExercises/ProgrammingExerciseSubmission.vue'
	),
	'utf8'
)

describe('programming exercise submission editor', () => {
	it('renders the editable Ace component instead of the auto-imported Code icon', () => {
		expect(source).toContain(
			"import CodeEditor from '@/components/Controls/CodeEditor.vue'"
		)
		expect(source).toMatch(/<CodeEditor[\s\S]*?v-model="code"[\s\S]*?\/>/)
		expect(source).not.toMatch(/<Code\s/)
	})

	it('does not override the solid Run button with dark-mode ink', () => {
		const runButton = [...source.matchAll(/<Button\b[\s\S]*?>/g)]
			.map(([tag]) => tag)
			.find((tag) => tag.includes('@click="submitCode"'))
		expect(runButton).toBeTruthy()
		expect(runButton).not.toContain('text-ink-gray-9')
	})

	it('fails fast on runner disconnects and preserves execution errors', () => {
		expect(source).toContain("session.ws?.addEventListener('error', handleConnectionFailure)")
		expect(source).toContain("session.ws?.addEventListener('close', handleConnectionFailure)")
		expect(source).toContain("errorChunks.push(msg.data)")
		expect(source).toContain("errorChunks.join('').trim()")
		expect(source).toContain('await runCode()')
		expect(source).toContain('await createSubmission()')
		expect(source).toContain('finally {\n\t\trunning.value = false')
	})
})
