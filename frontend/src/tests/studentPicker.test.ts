import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import type { StudentOption } from '@/types'

const translate = (text: string, args?: unknown[]) =>
	args ? text.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)])) : text
vi.stubGlobal('__', translate)
enableAutoUnmount(afterEach)

const ENROLLED = ['eve@x.com']
const PURCHASED = ['lisa@x.com']

const USERS: StudentOption[] = [
	{
		value: 'jane@x.com',
		label: 'Jane Doe',
		description: 'jane@x.com',
		image: '/jane.png',
	},
	{
		value: 'john@x.com',
		label: 'John Roe',
		description: 'john@x.com',
		image: null,
	},
	{
		value: 'lisa@x.com',
		label: 'Lisa Smith',
		description: 'lisa@x.com',
		image: null,
	},
	{
		value: 'zed@x.com',
		label: 'Zed Example',
		description: 'zed@x.com',
		image: null,
	},
	...['new', 'a', 'b', 'c', 'n1', 'n2', 'n3', 'eve'].map((id) => ({
		value: `${id}@x.com`,
		label: id.toUpperCase(),
		description: `${id}@x.com`,
		image: null,
	})),
]

const eligible = (params: Record<string, unknown>): StudentOption[] => {
	const blocked = params.include_enrolled ? PURCHASED : ENROLLED
	return USERS.filter((u) => !blocked.includes(u.value))
}

const calls = vi.hoisted(() => ({
	params: [] as Record<string, unknown>[],
	fail: false,
}))

// search_users_to_enroll returns only eligible users: `names` exactly those
// that are eligible; otherwise a `txt` search, two rows per page.
const respond = (params: Record<string, unknown>): StudentOption[] => {
	if (params.names) {
		const names = (JSON.parse(String(params.names)) as string[]).map((n) =>
			n.toLowerCase()
		)
		return eligible(params).filter((u) => names.includes(u.value))
	}
	const txt = String(params.txt ?? '').toLowerCase()
	return eligible(params)
		.filter((u) => !txt || u.label.toLowerCase().includes(txt))
		.slice(0, 2)
}

vi.mock('frappe-ui', () => ({
	Avatar: defineComponent({
		props: ['image', 'label', 'size'],
		setup(props) {
			return () =>
				h('span', {
					'data-testid': 'avatar',
					'data-label': props.label,
					'data-image': props.image ?? '',
				})
		},
	}),
	Button: defineComponent({
		inheritAttrs: false,
		props: ['icon', 'variant'],
		setup(props, { attrs }) {
			return () =>
				h('button', { type: 'button', ...attrs }, [
					props.icon ? h('span', { class: props.icon }) : null,
				])
		},
	}),
	MultiSelect: defineComponent({
		name: 'MultiSelectStub',
		props: [
			'id',
			'modelValue',
			'query',
			'options',
			'loading',
			'filterable',
			'error',
			'label',
			'variant',
		],
		emits: ['update:modelValue', 'update:open', 'update:query'],
		setup(props, { expose, slots }) {
			const trigger = ref<HTMLButtonElement | null>(null)
			expose({ focus: () => trigger.value?.focus() })
			return () =>
				h('div', [
					h(
						'button',
						{ ref: trigger, type: 'button', 'data-testid': 'trigger' },
						slots.prefix?.()
					),
					h('span', { 'data-testid': 'error' }, props.error as string),
					h('input', {
						id: `${props.id}-search-input`,
						'data-testid': 'search-input',
					}),
					h(
						'span',
						{ 'data-testid': 'slots' },
						Object.keys(slots).sort().join(',')
					),
				])
		},
	}),
	createResource: () => ({
		loading: false,
		submit: async (params: Record<string, unknown>) => {
			calls.params.push(params)
			if (calls.fail) throw new Error('offline')
			return respond(params)
		},
	}),
}))

import StudentPicker from '@/components/Enrollment/StudentPicker.vue'

const LIST_SLOT = `<template #list="{ students, remove }">
	<div v-for="s in students" :key="s.value" data-testid="selected-student">
		<span data-testid="avatar" :data-image="s.image ?? ''" />
		<span data-testid="student-name">{{ s.label }}</span>
		<span>{{ s.value }}</span>
		<button type="button" :aria-label="'Remove ' + s.label" @click="remove([s.value])" />
	</div>
	<button type="button" data-testid="remove-first-two" @click="remove(students.slice(0, 2).map((s) => s.value.toUpperCase()))" />
</template>`

const mountPicker = (
	modelValue: string[] = [],
	slots: Record<string, string> = {},
	includeEnrolled = false
) => {
	const wrapper = mount(StudentPicker, {
		slots: { list: LIST_SLOT, ...slots },
		props: {
			enrollDoctype: 'LMS Course',
			enrollDocname: 'course-1',
			includeEnrolled,
			modelValue,
			'onUpdate:modelValue': (value: string[]) => {
				wrapper.setProps({ modelValue: value })
			},
		},
		global: { mocks: { __: translate } },
		attachTo: document.body,
	})
	return wrapper
}

type Wrapper = ReturnType<typeof mountPicker>

const picker = (wrapper: Wrapper) =>
	wrapper.findComponent({ name: 'MultiSelectStub' })

const waitForSearch = async () => {
	await new Promise((r) => setTimeout(r, 300))
	await flushPromises()
}

const open = async (wrapper: Wrapper) => {
	picker(wrapper).vm.$emit('update:open', true)
	await flushPromises()
}

const typeQuery = async (wrapper: Wrapper, text: string) => {
	picker(wrapper).vm.$emit('update:query', text)
	await flushPromises()
}

const pick = async (wrapper: Wrapper, members: string[]) => {
	picker(wrapper).vm.$emit('update:modelValue', members)
	await flushPromises()
}

const optionValues = (wrapper: Wrapper) =>
	(picker(wrapper).props('options') as StudentOption[]).map((o) => o.value)

const selectedNames = (wrapper: Wrapper) =>
	wrapper
		.findAll('[data-testid="selected-student"] [data-testid="student-name"]')
		.map((el) => el.text())

const paste = async (wrapper: Wrapper, text: string) => {
	const event = new Event('paste', { bubbles: true, cancelable: true })
	Object.defineProperty(event, 'clipboardData', {
		value: { getData: () => text },
	})
	wrapper.get('[data-testid="search-input"]').element.dispatchEvent(event)
	await flushPromises()
	return event
}

const lastModel = (wrapper: Wrapper) =>
	wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string[] | undefined

describe('StudentPicker', () => {
	beforeEach(() => {
		calls.params = []
		calls.fail = false
	})

	it('searches this target on open, twenty at a time, with server-side filtering', async () => {
		const wrapper = mountPicker()
		await open(wrapper)
		expect(calls.params[0]).toEqual({
			txt: '',
			enroll_doctype: 'LMS Course',
			enroll_docname: 'course-1',
			include_enrolled: false,
			page_length: 20,
		})
		expect(picker(wrapper).props('filterable')).toBe(false)
		expect(optionValues(wrapper)).toEqual(['jane@x.com', 'john@x.com'])
	})

	it('runs a debounced search for the typed text', async () => {
		const wrapper = mountPicker()
		await typeQuery(wrapper, 'lis')
		expect(calls.params).toHaveLength(0)
		await waitForSearch()
		expect(calls.params.at(-1)?.txt).toBe('lis')
		expect(optionValues(wrapper)).toEqual(['lisa@x.com'])
	})

	it('has no Create New footer, so the default Select All / Clear All shows', () => {
		const wrapper = mountPicker()
		const slots = wrapper.get('[data-testid="slots"]').text().split(',')
		expect(slots).not.toContain('footer')
		expect(slots).toEqual(
			expect.arrayContaining(['prefix', 'item-prefix', 'item-label'])
		)
	})

	// Regression from the bulk-enroll PR (feat/bulk-enroll): a new search replaced
	// the options and a picked student's chip fell back to their bare email.
	it('keeps a picked student as an option and named after the next search', async () => {
		const wrapper = mountPicker()
		await open(wrapper)
		await pick(wrapper, ['jane@x.com'])
		await typeQuery(wrapper, 'Lisa')
		await waitForSearch()
		expect(optionValues(wrapper)).toEqual(['lisa@x.com', 'jane@x.com'])
		expect(selectedNames(wrapper)).toEqual(['Jane Doe'])
	})

	it('shows an empty state until a student is added', async () => {
		const wrapper = mountPicker()
		expect(wrapper.get('[data-testid="selected-empty"]').text()).toContain(
			'Students you add will be listed here.'
		)
		await open(wrapper)
		await pick(wrapper, ['jane@x.com'])
		expect(wrapper.find('[data-testid="selected-empty"]').exists()).toBe(false)
	})

	it('lists each selected student with avatar, name and email', async () => {
		const wrapper = mountPicker()
		await open(wrapper)
		await pick(wrapper, ['jane@x.com'])
		const item = wrapper.get('[data-testid="selected-student"]')
		expect(item.text()).toContain('Jane Doe')
		expect(item.text()).toContain('jane@x.com')
		expect(item.get('[data-testid="avatar"]').attributes('data-image')).toBe(
			'/jane.png'
		)
	})

	it('stacks up to three avatars on the trigger, then +N', async () => {
		const wrapper = mountPicker()
		await open(wrapper)
		await pick(wrapper, [
			'jane@x.com',
			'john@x.com',
			'a@x.com',
			'b@x.com',
			'c@x.com',
		])
		const trigger = wrapper.get('[data-testid="trigger"]')
		expect(trigger.findAll('[data-testid="avatar"]')).toHaveLength(3)
		expect(trigger.text()).toContain('+2')
	})

	it('adds every address in a pasted list, clears the search and names them', async () => {
		const wrapper = mountPicker()
		await typeQuery(wrapper, 'zed@x.com, new@x.com;')
		expect(picker(wrapper).props('query')).toBe('')
		await flushPromises()
		expect(
			calls.params.some((p) => p.names === '["zed@x.com","new@x.com"]')
		).toBe(true)
		expect(lastModel(wrapper)).toEqual(['zed@x.com', 'new@x.com'])
		expect(selectedNames(wrapper)).toEqual(['Zed Example', 'NEW'])
	})

	it('ignores pasted addresses that cannot be enrolled, without a note', async () => {
		const wrapper = mountPicker()
		await typeQuery(wrapper, 'zed@x.com, eve@x.com, ghost@x.com;')
		await flushPromises()
		expect(lastModel(wrapper)).toEqual(['zed@x.com'])
		expect(selectedNames(wrapper)).toEqual(['Zed Example'])
		expect(wrapper.find('[role="status"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="enrolled-note"]').exists()).toBe(false)
		expect(picker(wrapper).props('query')).toBe('')
	})

	it('adds nothing when no pasted address can be enrolled', async () => {
		const wrapper = mountPicker()
		await typeQuery(wrapper, 'eve@x.com, ghost@x.com;')
		await flushPromises()
		expect(wrapper.emitted('update:modelValue')).toBeUndefined()
		expect(wrapper.find('[data-testid="selected-empty"]').exists()).toBe(true)
	})

	it('adds a pasted enrolled address while enrolled students are included', async () => {
		const wrapper = mountPicker([], {}, true)
		await typeQuery(wrapper, 'zed@x.com, eve@x.com, lisa@x.com;')
		await flushPromises()
		expect(lastModel(wrapper)).toEqual(['zed@x.com', 'eve@x.com'])
	})

	it('drops enrolled students when enrolled students stop being included', async () => {
		const wrapper = mountPicker([], {}, true)
		await typeQuery(wrapper, 'zed@x.com, eve@x.com;')
		await flushPromises()
		expect(lastModel(wrapper)).toEqual(['zed@x.com', 'eve@x.com'])
		await wrapper.setProps({ includeEnrolled: false })
		await flushPromises()
		expect(lastModel(wrapper)).toEqual(['zed@x.com'])
		expect(selectedNames(wrapper)).toEqual(['Zed Example'])
	})

	it('keeps the selection when the re-check after a mode change fails', async () => {
		const wrapper = mountPicker([], {}, true)
		await typeQuery(wrapper, 'zed@x.com, eve@x.com;')
		await flushPromises()
		calls.fail = true
		await wrapper.setProps({ includeEnrolled: false })
		await flushPromises()
		calls.fail = false
		expect(lastModel(wrapper)).toEqual(['zed@x.com', 'eve@x.com'])
	})

	it('re-checks a remembered student after the mode changes', async () => {
		const wrapper = mountPicker([], {}, true)
		await typeQuery(wrapper, 'eve@x.com, zed@x.com;')
		await flushPromises()
		await wrapper.setProps({ includeEnrolled: false })
		await flushPromises()
		await typeQuery(wrapper, 'eve@x.com, john@x.com;')
		await flushPromises()
		expect(lastModel(wrapper)).toEqual(['zed@x.com', 'john@x.com'])
	})

	it('adds every address from a pasted column, keeping the newlines', async () => {
		const wrapper = mountPicker()
		const event = await paste(wrapper, 'zed@x.com\nnew@x.com\r\nb@x.com')
		expect(event.defaultPrevented).toBe(true)
		expect(lastModel(wrapper)).toEqual(['zed@x.com', 'new@x.com', 'b@x.com'])
		expect(picker(wrapper).props('query')).toBe('')
	})

	it('adds addresses pasted with spaces or tabs between them', async () => {
		const wrapper = mountPicker()
		await paste(wrapper, 'a@x.com b@x.com\tc@x.com')
		expect(lastModel(wrapper)).toEqual(['a@x.com', 'b@x.com', 'c@x.com'])
	})

	it('lets a pasted name or a single address search as usual', async () => {
		const wrapper = mountPicker()
		expect((await paste(wrapper, 'John Roe')).defaultPrevented).toBe(false)
		expect((await paste(wrapper, 'john@x.com')).defaultPrevented).toBe(false)
		expect(wrapper.emitted('update:modelValue')).toBeUndefined()
	})

	it('names a pasted email whatever its case, and ticks that user', async () => {
		const wrapper = mountPicker()
		await typeQuery(wrapper, 'Jane@X.com,')
		await flushPromises()
		expect(selectedNames(wrapper)).toEqual(['Jane Doe'])
		expect(picker(wrapper).props('modelValue')).toEqual(['jane@x.com'])
		await open(wrapper)
		expect(
			optionValues(wrapper).filter((v) => v.toLowerCase() === 'jane@x.com')
		).toEqual(['jane@x.com'])
	})

	it('renders the beforeList slot between the picker and the selected list', async () => {
		const wrapper = mountPicker(['jane@x.com'], {
			beforeList: '<div data-testid="extra" />',
		})
		await flushPromises()
		const extra = wrapper.get('[data-testid="extra"]').element
		const list = wrapper.get('[data-testid="selected-student"]').element
		expect(
			extra.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy()
	})

	it('hands the selected students to the list slot in a box that fills the rest', async () => {
		const wrapper = mountPicker(['jane@x.com'], {
			beforeList: '<div data-testid="extra" />',
		})
		await flushPromises()
		const root = wrapper.element as HTMLElement
		expect(root.className).toMatch(/\bflex-col\b/)
		expect(root.className).toMatch(/\bh-full\b/)
		expect(root.className).not.toMatch(/overflow/)
		const box = wrapper.get('[data-testid="selected-student"]').element
			.parentElement as HTMLElement
		expect(box.className).toMatch(/\bflex-1\b/)
		expect(box.className).toMatch(/\bmin-h-0\b/)
		expect(box.contains(wrapper.get('[data-testid="extra"]').element)).toBe(
			false
		)
	})

	it('reports checking while pasted emails are looked up', async () => {
		const wrapper = mountPicker()
		await typeQuery(wrapper, 'zed@x.com, new@x.com;')
		const states = (wrapper.emitted('update:checking') ?? []).map((e) => e[0])
		expect(states).toEqual([true, false])
	})

	it('ignores a name search that contains a comma', async () => {
		const wrapper = mountPicker()
		await typeQuery(wrapper, 'Doe, Jane')
		expect(wrapper.emitted('update:modelValue')).toBeUndefined()
		expect(picker(wrapper).props('query')).toBe('Doe, Jane')
	})

	it('adds only the valid addresses from a mixed paste', async () => {
		const wrapper = mountPicker()
		await typeQuery(wrapper, 'a@x.com, junk')
		expect(lastModel(wrapper)).toEqual(['a@x.com'])
	})

	it('stops a paste at fifty students and says so', async () => {
		const existing = Array.from({ length: 49 }, (_, i) => `s${i}@x.com`)
		const wrapper = mountPicker(existing)
		await typeQuery(wrapper, 'n1@x.com, n2@x.com, n3@x.com')
		expect(lastModel(wrapper)).toHaveLength(50)
		expect(wrapper.get('[data-testid="error"]').text()).toBe(
			'You can enroll up to 50 students at a time.'
		)
	})

	it('caps Select All at fifty, keeping the students already picked', async () => {
		const existing = Array.from({ length: 49 }, (_, i) => `s${i}@x.com`)
		const wrapper = mountPicker(existing)
		await open(wrapper)
		await pick(wrapper, ['jane@x.com', 'john@x.com', ...existing])
		expect(lastModel(wrapper)).toEqual([...existing, 'jane@x.com'])
		expect(wrapper.get('[data-testid="error"]').text()).toBe(
			'You can enroll up to 50 students at a time.'
		)
	})

	it('keeps pasted unknown emails selectable after Select All', async () => {
		const wrapper = mountPicker(['new@x.com'])
		await open(wrapper)
		expect(optionValues(wrapper)).toContain('new@x.com')
	})

	// Regression from the bulk-enroll PR (feat/bulk-enroll): removing students
	// dropped focus to the page, so keyboard users lost their place.
	it('removes the given students and focuses the picker', async () => {
		const wrapper = mountPicker()
		await open(wrapper)
		await pick(wrapper, ['jane@x.com', 'john@x.com', 'zed@x.com'])
		await wrapper.get('[aria-label="Remove Jane Doe"]').trigger('click')
		await flushPromises()
		expect(lastModel(wrapper)).toEqual(['john@x.com', 'zed@x.com'])
		expect(document.activeElement).toBe(
			wrapper.get('[data-testid="trigger"]').element
		)
		await wrapper.get('[data-testid="remove-first-two"]').trigger('click')
		await flushPromises()
		expect(lastModel(wrapper)).toEqual([])
	})
})
