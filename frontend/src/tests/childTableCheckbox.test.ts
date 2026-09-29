import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import ChildTable from '@/components/Controls/ChildTable.vue'

enableAutoUnmount(afterEach)

// vi.stubGlobal doesn't reach a template's `_ctx.__`; this mirrors setup.ts's
// translate(): the string, or a { format } object when it has a {0}.
const translate = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (match, index) =>
				args[Number(index)] === undefined ? match : String(args[Number(index)])
			),
	}
}

const mountTable = (props: {
	modelValue: Record<string, string | boolean>[]
	columns: string[]
	checkboxKeys?: string[]
}) =>
	mount(ChildTable, {
		props,
		global: { mocks: { __: translate } },
		// addRow() focuses the new row's input via document.querySelectorAll,
		// which only finds anything when the component is actually attached
		// to the live document.
		attachTo: document.body,
	})

const findAddRowButton = (wrapper: ReturnType<typeof mountTable>) => {
	const button = wrapper
		.findAll('button')
		.find((candidate) => candidate.text().includes('Add Row'))
	if (!button) throw new Error('Add Row button not found')
	return button
}

const lastEmittedModel = (wrapper: ReturnType<typeof mountTable>) => {
	const emitted = wrapper.emitted('update:modelValue')
	if (!emitted) throw new Error('update:modelValue was never emitted')
	return emitted[emitted.length - 1][0] as Record<string, string | boolean>[]
}

// Guards checkbox columns, and a new row seeding them true rather than ''.
// Came with this branch's per-case visibility for exercise test cases.
// Added on feat/assessment-visual-redesign to pin ChildTable's seed default.
describe('ChildTable checkbox columns', () => {
	it('renders a checkbox for a declared checkbox key', () => {
		const wrapper = mountTable({
			modelValue: [{ input: '2 3', hidden: true }],
			columns: ['Input', 'Hidden'],
			checkboxKeys: ['hidden'],
		})

		const box = wrapper.get('input[type="checkbox"]')
		expect((box.element as HTMLInputElement).checked).toBe(true)
	})

	it('leaves undeclared keys as text inputs', () => {
		const wrapper = mountTable({
			modelValue: [{ input: '2 3', hidden: true }],
			columns: ['Input', 'Hidden'],
			checkboxKeys: ['hidden'],
		})

		expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(1)
		expect(wrapper.findAll('input:not([type="checkbox"])')).toHaveLength(1)
	})

	it('seeds a newly added row’s checkbox column to true, not empty string', async () => {
		const wrapper = mountTable({
			modelValue: [{ input: '2 3', hidden: true }],
			columns: ['Input', 'Hidden'],
			checkboxKeys: ['hidden'],
		})

		await findAddRowButton(wrapper).trigger('click')

		const newRow = lastEmittedModel(wrapper)[1]
		expect(newRow.hidden).toBe(true)

		const checkboxes = wrapper.findAll('input[type="checkbox"]')
		expect(checkboxes).toHaveLength(2)
		expect((checkboxes[1].element as HTMLInputElement).checked).toBe(true)
	})

	it('seeds a newly added row to empty strings when no checkboxKeys are declared', async () => {
		const wrapper = mountTable({
			modelValue: [{ input: '2 3', expected_output: '5' }],
			columns: ['Input', 'Expected Output'],
		})

		await findAddRowButton(wrapper).trigger('click')

		const newRow = lastEmittedModel(wrapper)[1]
		expect(newRow).toEqual({ input: '', expected_output: '' })
		expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
	})
})
