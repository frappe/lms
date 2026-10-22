/**
 * StudentPicker with the real MultiLink: a chip must keep the student's name
 * after the search results move on, for a dropdown pick and for a paste.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h as render, reactive } from 'vue'

const translate = (text: string, args?: unknown[]) =>
	args ? text.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)])) : text
vi.stubGlobal('__', translate)
enableAutoUnmount(afterEach)

interface Row {
	value: string
	label: string
}
interface ResourceConfig {
	url: string
	transform?: (rows: Record<string, unknown>[]) => Row[]
	onSuccess?: (rows: Row[]) => void
}
interface FakeResource {
	params: Record<string, unknown> | null
	loading: boolean
	data: Row[] | null
	update: (o: { params: Record<string, unknown> }) => void
	reload: () => Promise<void>
}

const USERS: Row[] = [
	{ value: 'lisa@x.com', label: 'Lisa Smith' },
	{ value: 'debra@x.com', label: 'Debra Gardner' },
	{ value: 'jeff@x.com', label: 'Jeffrey Lawrence' },
	{ value: 'zed@x.com', label: 'Zed Example' },
]

const h = vi.hoisted(() => ({
	nameLookups: [] as string[][],
}))

// search_users_to_enroll: `names` returns exactly those users; otherwise a
// `txt` search, two rows per page.
function respond(params: Record<string, unknown>): Row[] {
	if (params.names) {
		const names = JSON.parse(String(params.names)) as string[]
		h.nameLookups.push(names)
		return USERS.filter((u) => names.includes(u.value))
	}
	const txt = String(params.txt ?? '').toLowerCase()
	return USERS.filter((u) => !txt || u.label.toLowerCase().includes(txt)).slice(
		0,
		2
	)
}

vi.mock('@/utils', () => ({ openSettings: vi.fn() }))

vi.mock('frappe-ui', () => ({
	Button: defineComponent({
		inheritAttrs: false,
		setup(_, { attrs, slots }) {
			return () =>
				render('button', { type: 'button', ...attrs }, [
					slots.default?.(),
					slots.suffix?.(),
				])
		},
	}),
	MultiSelect: defineComponent({
		name: 'MultiSelectStub',
		props: ['modelValue', 'open', 'query', 'options'],
		emits: ['update:modelValue', 'update:open', 'update:query'],
		setup() {
			return () => render('div', { 'data-testid': 'multiselect' })
		},
	}),
	createResource: (config: ResourceConfig): FakeResource => {
		const res = reactive({
			params: null,
			loading: false,
			data: null,
		}) as FakeResource
		res.update = ({ params }) => {
			res.params = params
		}
		res.reload = async () => {
			res.loading = true
			await Promise.resolve()
			const rows = respond(res.params ?? {})
			const data = config.transform
				? config.transform(rows as unknown as Record<string, unknown>[])
				: rows
			res.data = data
			res.loading = false
			config.onSuccess?.(data)
		}
		return res
	},
}))

import StudentPicker from '@/components/Enrollment/StudentPicker.vue'

const mountPicker = () => {
	const wrapper = mount(StudentPicker, {
		props: {
			enrollDoctype: 'LMS Course',
			enrollDocname: 'course-1',
			includeEnrolled: false,
			modelValue: [],
			'onUpdate:modelValue': (value: string[]) => {
				wrapper.setProps({ modelValue: value })
			},
		},
		global: { mocks: { __: translate } },
	})
	return wrapper
}

type Wrapper = ReturnType<typeof mountPicker>

const select = (wrapper: Wrapper) =>
	wrapper.findComponent({ name: 'MultiSelectStub' })

const waitForSearch = () => new Promise((r) => setTimeout(r, 350))

const search = async (wrapper: Wrapper, txt: string) => {
	select(wrapper).vm.$emit('update:query', txt)
	await waitForSearch()
	await flushPromises()
}

const chips = (wrapper: Wrapper) =>
	wrapper.findAll('[data-testid="student-chip"]').map((c) => c.text())

describe('StudentPicker chip labels with MultiLink', () => {
	beforeEach(() => {
		h.nameLookups = []
	})

	it('keeps a picked name after the next search', async () => {
		const wrapper = mountPicker()
		select(wrapper).vm.$emit('update:open', true)
		await flushPromises()
		select(wrapper).vm.$emit('update:modelValue', ['lisa@x.com'])
		await flushPromises()
		expect(chips(wrapper)).toEqual(['Lisa Smith'])
		await search(wrapper, 'Jeff')
		expect(chips(wrapper)).toEqual(['Lisa Smith'])
	})

	it('names pasted users, resolving unseen ones through names', async () => {
		const wrapper = mountPicker()
		await search(wrapper, 'Jeff')
		select(wrapper).vm.$emit('update:query', 'jeff@x.com, zed@x.com,')
		await waitForSearch()
		await flushPromises()
		expect(h.nameLookups).toEqual([['zed@x.com']])
		expect(chips(wrapper)).toEqual(['Jeffrey Lawrence', 'Zed Example'])
	})
})
