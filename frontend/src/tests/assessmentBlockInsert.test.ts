// Guards a newly inserted quiz, assignment or exercise block showing its
// preview on Save and being saved, without a lesson reload.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

vi.mock('@/stores/user', () => ({
	usersStore: () => ({
		userResource: { data: { name: 'author@example.com' } },
	}),
}))
vi.mock('@/router', () => ({ default: { install: () => {} } }))
vi.mock('@/components/Controls/Link.vue', () => ({
	default: {
		emits: ['update:modelValue'],
		mounted(this: { $emit: (event: string, value: string) => void }) {
			this.$emit('update:modelValue', 'picked-1')
		},
		template: '<div />',
	},
}))
vi.mock('@/components/QuizBlock.vue', () => ({ default: {} }))
vi.mock('@/components/Assignment.vue', () => ({ default: {} }))
vi.mock(
	'@/pages/ProgrammingExercises/ProgrammingExerciseSubmission.vue',
	() => ({ default: {} })
)
vi.mock('@/components/Assessment/AssessmentBlockPreview.vue', () => ({
	default: {
		props: ['kind', 'name'],
		template: `<div data-testid="preview">{{ kind }}:{{ name }}</div>`,
	},
}))

import { Quiz } from '@/utils/quiz'
import { Assignment } from '@/utils/assignment'
import { Program } from '@/utils/program'

type Tool = {
	wrapper: HTMLDivElement
	render: () => HTMLDivElement
	save: () => Record<string, unknown>
	destroy: () => void
}

const dispatchChange = vi.fn()
let tools: Tool[] = []

const blockTools = [
	{
		kind: 'quiz',
		saved: { quiz: 'picked-1' },
		create: (data: object) =>
			new Quiz({ data, readOnly: false, block: { dispatchChange } } as any),
	},
	{
		kind: 'assignment',
		saved: { assignment: 'picked-1' },
		create: (data: object) =>
			new Assignment({
				data,
				readOnly: false,
				block: { dispatchChange },
			} as any),
	},
	{
		kind: 'exercise',
		saved: { exercise: 'picked-1' },
		create: (data: object) =>
			new Program({
				data,
				api: {},
				readOnly: false,
				block: { dispatchChange },
			} as any),
	},
]

const renderTool = async (tool: Tool) => {
	tools.push(tool)
	document.body.append(tool.render())
	await flushPromises()
	return tool
}

const saveButton = () =>
	Array.from(document.querySelectorAll('button')).find(
		(button) => button.textContent?.trim() === 'Save'
	)

const preview = (tool: Tool) =>
	tool.wrapper.querySelector('[data-testid="preview"]')?.textContent

beforeEach(() => {
	Object.assign(window, { translatedMessages: {} })
	dispatchChange.mockClear()
})

afterEach(() => {
	for (const tool of tools) tool.destroy()
	tools = []
	document.body.replaceChildren()
})

describe.each(blockTools)(
	'inserting a $kind block',
	({ kind, saved, create }) => {
		it('previews a block that already has data', async () => {
			const tool = await renderTool(create({ ...saved }))

			expect(preview(tool)).toBe(`${kind}:picked-1`)
		})

		it('previews the pick and saves it without a reload', async () => {
			const tool = await renderTool(create({}))
			saveButton()!.click()
			await flushPromises()

			expect(preview(tool)).toBe(`${kind}:picked-1`)
			expect(tool.save()).toEqual(saved)
			expect(dispatchChange).toHaveBeenCalledTimes(1)
		})

		it('unmounts the picker when the block is removed before a pick', async () => {
			const tool = await renderTool(create({}))
			expect(saveButton()).toBeDefined()
			tool.destroy()
			await flushPromises()

			expect(saveButton()).toBeUndefined()
		})
	}
)
