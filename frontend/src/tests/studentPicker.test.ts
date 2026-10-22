import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

const translate = (text: string, args?: unknown[]) =>
	args ? text.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)])) : text
vi.stubGlobal('__', translate)
enableAutoUnmount(afterEach)

const { openSettings } = vi.hoisted(() => ({ openSettings: vi.fn() }))

vi.mock('@/utils', () => ({ openSettings }))

const labels: Record<string, string> = {
	'jane@x.com': 'Jane Doe',
	'john@x.com': 'John Roe',
}

vi.mock('@/components/Controls/MultiLink.vue', () => ({
	default: defineComponent({
		name: 'MultiLinkStub',
		props: [
			'modelValue',
			'query',
			'url',
			'searchParams',
			'error',
			'onCreate',
			'label',
		],
		emits: ['update:modelValue', 'update:query'],
		setup(_, { expose }) {
			expose({
				optionByValue: new Map(
					Object.entries(labels).map(([value, label]) => [
						value,
						{ value, label },
					])
				),
			})
		},
		render() {
			return h('div', { 'data-testid': 'multilink' }, this.error as string)
		},
	}),
}))

import StudentPicker from '@/components/Enrollment/StudentPicker.vue'

const mountPicker = (modelValue: string[] = []) =>
	mount(StudentPicker, {
		props: {
			enrollDoctype: 'LMS Course',
			enrollDocname: 'course-1',
			includeEnrolled: false,
			modelValue,
			'onUpdate:modelValue': (value: string[]) => {
				wrapper.setProps({ modelValue: value })
			},
		},
		global: { mocks: { __: translate } },
	})

let wrapper: ReturnType<typeof mountPicker>

const link = () => wrapper.findComponent({ name: 'MultiLinkStub' })

const paste = async (text: string) => {
	link().vm.$emit('update:query', text)
	await flushPromises()
}

describe('StudentPicker', () => {
	it('searches users through search_users_to_enroll for this target', () => {
		wrapper = mountPicker()
		expect(link().props('url')).toBe('lms.lms.api.search_users_to_enroll')
		expect(link().props('searchParams')).toEqual({
			enroll_doctype: 'LMS Course',
			enroll_docname: 'course-1',
			include_enrolled: false,
		})
	})

	it('renders one chip per student, labelled by full name', async () => {
		wrapper = mountPicker(['jane@x.com', 'john@x.com', 'raw@x.com'])
		await flushPromises()
		const chips = wrapper.findAll('[data-testid="student-chip"]')
		expect(chips.map((c) => c.text())).toEqual([
			'Jane Doe',
			'John Roe',
			'raw@x.com',
		])
	})

	it('removes a student with the chip button, named for that student', async () => {
		wrapper = mountPicker(['jane@x.com', 'john@x.com'])
		await flushPromises()
		await wrapper.get('[aria-label="Remove Jane Doe"]').trigger('click')
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			['john@x.com'],
		])
	})

	it('adds every address in a pasted comma-separated list and clears the search', async () => {
		wrapper = mountPicker()
		await paste('a@x.com, b@x.com')
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			['a@x.com', 'b@x.com'],
		])
		expect(link().props('query')).toBe('')
	})

	it('stops at fifty students and says so', async () => {
		const existing = Array.from({ length: 49 }, (_, i) => `s${i}@x.com`)
		wrapper = mountPicker(existing)
		await paste('n1@x.com, n2@x.com, n3@x.com')
		const kept = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string[]
		expect(kept).toHaveLength(50)
		expect(link().props('error')).toBe(
			'You can enroll up to 50 students at a time.'
		)
	})

	it('ignores a name search that contains a comma', async () => {
		wrapper = mountPicker()
		await paste('Doe, Jane')
		expect(wrapper.emitted('update:modelValue')).toBeUndefined()
		expect(wrapper.findAll('[data-testid="student-chip"]')).toHaveLength(0)
		expect(link().props('query')).toBe('Doe, Jane')
	})

	it('adds only the valid addresses from a mixed paste', async () => {
		wrapper = mountPicker()
		await paste('a@x.com, junk')
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['a@x.com']])
	})

	it('caps a dropdown pick at fifty and says so', async () => {
		const existing = Array.from({ length: 50 }, (_, i) => `s${i}@x.com`)
		wrapper = mountPicker(existing)
		link().vm.$emit('update:modelValue', [...existing, 'extra@x.com'])
		await flushPromises()
		const kept = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string[]
		expect(kept).toEqual(existing)
		expect(link().props('error')).toBe(
			'You can enroll up to 50 students at a time.'
		)
	})

	it('opens Settings > Members from Create New', () => {
		wrapper = mountPicker()
		link().props('onCreate')()
		expect(openSettings).toHaveBeenCalledWith('members')
	})
})
