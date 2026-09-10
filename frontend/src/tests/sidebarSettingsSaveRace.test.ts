/**
 * save_sidebar_items carries no request sequence. Two rapid edits fire two
 * overlapping full-table saves; if the older one's response arrives after
 * the newer one's, its completion handler must not run at all, or it
 * reloads a snapshot the newer edit has already moved past.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

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

const { settingsDoc, reload, call, toast } = vi.hoisted(() => {
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
	}
})

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
	default: { template: '<div />' },
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
	it('ignores a stale response that resolves after a newer one', async () => {
		armCall()
		const wrapper = build()
		await wrapper.vm.$nextTick()

		const boxes = wrapper.findAll('input[type="checkbox"]')
		expect(boxes).toHaveLength(2)

		// Two edits in quick succession, before either save resolves.
		await boxes[0].setValue(false)
		await boxes[1].setValue(false)
		expect(call).toHaveBeenCalledTimes(2)

		// The older request (call #1) resolves last.
		resolvers[1](undefined)
		await wrapper.vm.$nextTick()
		await Promise.resolve()
		resolvers[0](undefined)
		await wrapper.vm.$nextTick()
		await Promise.resolve()
		await Promise.resolve()

		// Only the newer call's completion should have reloaded and re-synced;
		// the superseded one must not have run its own reload.
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
