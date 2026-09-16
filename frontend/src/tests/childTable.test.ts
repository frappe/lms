/**
 * ChildTable's add-row button label. `ProgrammingExerciseForm` had always
 * passed `:placeholder="__('Add Test Case')"`, but ChildTable never declared
 * the prop, so every table read "Add Row" regardless.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

import ChildTable from '@/components/Controls/ChildTable.vue'

function build(props: Record<string, unknown>) {
	return mount(ChildTable, {
		attachTo: document.body,
		props: { columns: ['Input', 'Output'], ...props },
		global: { mocks: { __: (text: string) => text } },
	})
}

function addRowLabel(wrapper: ReturnType<typeof build>) {
	return wrapper.findAll('button').at(-1)?.text()
}

describe('ChildTable add-row button', () => {
	it('uses the placeholder the caller passes', () => {
		expect(addRowLabel(build({ placeholder: 'Add Test Case' }))).toBe(
			'Add Test Case'
		)
	})

	it('falls back to Add Row', () => {
		expect(addRowLabel(build({}))).toBe('Add Row')
	})
})
