/**
 * save_sidebar_items replaces the whole table and carries no request
 * sequence. Two overlapping saves could commit out of order on the server,
 * leaving the older table, so a save waits for the one before it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

type Row = {
	name: string
	name1: string
	label: string
	item_type: string
	is_standard: number
	hidden: number
	route: string | null
	web_page: string | null
	url: string | null
	icon: string | null
}

const row = (overrides: Partial<Row>): Row => ({
	name: '',
	name1: '',
	label: '',
	item_type: 'External',
	is_standard: 0,
	hidden: 0,
	route: null,
	web_page: null,
	url: null,
	icon: null,
	...overrides,
})

const { settingsDoc, reload, call, toast, completeStep } = vi.hoisted(() => {
	const settingsDoc = {
		doc: {
			name: 'LMS Settings',
			sidebar_items: [] as Row[],
		},
	}
	return {
		settingsDoc,
		reload: vi.fn(async () => settingsDoc.doc),
		call: vi.fn(),
		toast: { error: vi.fn(), success: vi.fn() },
		completeStep: vi.fn(),
	}
})

vi.mock('@/onboarding/useLearningOnboarding', () => ({
	useLearningOnboarding: () => ({ completeStep }),
}))

vi.mock('frappe-ui', () => ({
	Button: { template: '<button><slot /></button>' },
	Checkbox: {
		props: ['modelValue', 'disabled'],
		emits: ['update:modelValue'],
		template:
			'<input type="checkbox" :checked="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
	},
	Dropdown: { template: '<div><slot /></div>' },
	call,
	createDocumentResource: () => ({ doc: settingsDoc.doc, reload }),
	toast,
}))

vi.mock('vuedraggable', () => ({
	default: {
		props: ['modelValue'],
		emits: ['update:modelValue', 'end'],
		template:
			'<div><template v-for="element in modelValue" :key="element._clientId"><slot name="item" :element="element" /></template></div>',
	},
}))

vi.mock('@/components/Layouts/settings/desktop/SettingsLayout.vue', () => ({
	default: { template: '<div><slot name="header-actions" /><slot /></div>' },
}))

vi.mock('@/components/Settings/Sidebar/SidebarPageModal.vue', () => ({
	default: { name: 'SidebarPageModal', emits: ['saved'], template: '<div />' },
}))

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ loadSidebarSettings: vi.fn(async () => null) }),
}))

vi.mock('@/utils', () => ({
	cleanError: (message: string) => message,
}))

vi.stubGlobal('__', (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: string[]) =>
			message.replace(
				/{(\d+)}/g,
				(match, index) => args[Number(index)] ?? match
			),
	}
})

import SidebarSettings from '@/components/Settings/Sidebar/SidebarSettings.vue'

beforeEach(() => {
	settingsDoc.doc.sidebar_items = [
		row({
			name: 'row-a',
			name1: 'row-a',
			label: 'Row A',
			url: 'https://a.example',
		}),
		row({
			name: 'row-b',
			name1: 'row-b',
			label: 'Row B',
			url: 'https://b.example',
		}),
	]
	reload.mockClear()
	call.mockReset()
	toast.error.mockClear()
	completeStep.mockClear()
})

const build = () =>
	mount(SidebarSettings, {
		props: { label: 'Sidebar' },
		global: { mocks: { __: (globalThis as any).__ } },
	})

/** Resolves the nth pending call() invocation. */
const resolvers: Array<(value: unknown) => void> = []
const armCall = () => {
	resolvers.length = 0
	call.mockImplementation(
		() =>
			new Promise((resolve) => {
				resolvers.push(resolve)
			})
	)
}

describe('overlapping sidebar saves', () => {
	it('sends the next save only after the previous one has finished', async () => {
		armCall()
		const wrapper = build()
		await wrapper.vm.$nextTick()

		const boxes = wrapper.findAll('input[type="checkbox"]')
		expect(boxes).toHaveLength(2)

		// Two edits in quick succession, before the first save resolves.
		await boxes[0].setValue(false)
		await boxes[1].setValue(false)
		expect(call).toHaveBeenCalledTimes(1)

		resolvers[0](undefined)
		await flushPromises()

		// The second save goes out after the first, carrying both edits, so the
		// server cannot commit the older table last.
		expect(call).toHaveBeenCalledTimes(2)
		const hidden = call.mock.calls[1][1].rows.map((r: Row) => r.hidden)
		expect(hidden).toEqual([1, 1])

		resolvers[1](undefined)
		await flushPromises()

		// Only the newest save reloads; the superseded one must not.
		expect(reload).toHaveBeenCalledTimes(1)
		expect(toast.error).not.toHaveBeenCalled()
	})

	it('reloads once for a single edit, the ordinary case', async () => {
		armCall()
		const wrapper = build()
		await wrapper.vm.$nextTick()

		const boxes = wrapper.findAll('input[type="checkbox"]')
		await boxes[0].setValue(false)
		resolvers[0](undefined)
		await wrapper.vm.$nextTick()
		await Promise.resolve()

		expect(reload).toHaveBeenCalledTimes(1)
	})
})

describe('Customize the sidebar', () => {
	// Guards: saving the sidebar leaving the basic setup step open, since no
	// stored value says the sidebar was customised. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to tick it on save.
	it('ticks once a sidebar save lands', async () => {
		call.mockResolvedValue(undefined)
		const wrapper = build()
		await wrapper.vm.$nextTick()
		await wrapper.findAll('input[type="checkbox"]')[0].setValue(false)
		await flushPromises()
		expect(completeStep).toHaveBeenCalledWith('customise_sidebar')
	})

	// Guards: a page added through the modal leaving the step open. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// tick it on the modal's save too.
	it('ticks once the page modal saves', async () => {
		const wrapper = build()
		await wrapper.vm.$nextTick()
		wrapper.findComponent({ name: 'SidebarPageModal' }).vm.$emit('saved')
		await flushPromises()
		expect(completeStep).toHaveBeenCalledWith('customise_sidebar')
	})

	// Guards: a refused save ticking the step as if it saved. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to tick on
	// success only.
	it('stays open when the save is refused', async () => {
		call.mockRejectedValue({ messages: ['refused'] })
		const wrapper = build()
		await wrapper.vm.$nextTick()
		await wrapper.findAll('input[type="checkbox"]')[0].setValue(false)
		await flushPromises()
		expect(toast.error).toHaveBeenCalled()
		expect(completeStep).not.toHaveBeenCalled()
	})
})
