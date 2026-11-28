import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive, defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

vi.stubGlobal('__', (text: string) => text)
// translation.js installs String.prototype.format at app boot.
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return args.reduce<string>(
		(out, arg, i) => out.replaceAll(`{${i}}`, String(arg)),
		this
	)
}

const { createResourceMock, sent, callMock } = vi.hoisted(() => ({
	createResourceMock: vi.fn(),
	sent: [] as Array<Record<string, unknown>>,
	callMock: vi.fn(() => Promise.resolve({})),
}))

vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	call: callMock,
	toast: { success: vi.fn(), error: vi.fn() },
	Button: { template: `<button><slot /></button>` },
}))

const { inert } = vi.hoisted(() => ({
	inert: () => ({ default: { render: () => null } }),
}))
vi.mock('@/components/ProgressBar.vue', inert)
vi.mock('@framework/ui/components/Onboarding/index', () => ({
	useOnboarding: () => ({ updateOnboardingStep: vi.fn() }),
}))
const { pickerItems } = vi.hoisted(() => ({
	pickerItems: { exclude: [] as string[], category: '' as unknown },
}))
vi.mock('@/composables/useCoursePickerItems', async () => {
	const { computed } = await import('vue')
	return {
		useCoursePickerItems: (
			exclude: () => string[],
			category: () => unknown
		) => ({
			items: computed(() => {
				pickerItems.exclude = exclude()
				pickerItems.category = category()
				return [{ value: 'C2', title: 'Two' }]
			}),
			categories: computed(() => ['ERPNext', 'Frappe']),
			byName: computed(() => ({
				C2: {
					name: 'C2',
					title: 'Two',
					lessons: 3,
					membership: { progress: 40 },
				},
				C3: { name: 'C3', title: 'Three', lessons: 1 },
			})),
			load: vi.fn(),
		}),
	}
})
vi.mock('@/components/InlineEdit/PickerDialog.vue', () => ({
	default: {
		name: 'PickerDialog',
		props: ['open', 'items', 'categories', 'createLabel', 'title'],
		emits: ['add', 'create', 'update:open'],
		template: '<div />',
	},
}))

import BatchCourseList from '@/pages/Batches/components/overview/BatchCourseList.vue'

type Options = {
	params?: Record<string, unknown>
	makeParams?: () => Record<string, unknown>
	auto?: boolean
}

const pending: Array<{ batch: unknown; resolve: () => void }> = []

// Mirrors frappe-ui: each fetch gets its own controller, abort() cancels the
// latest one, and an aborted fetch never assigns `data`.
const fakeResource = (options: Options) => {
	let controller = new AbortController()
	const resource = {
		data: null as unknown,
		abort: () => controller.abort(),
		reload: () => {},
	}
	resource.reload = () => {
		const params = options.makeParams
			? options.makeParams()
			: options.params ?? {}
		sent.push(params)
		controller = new AbortController()
		const { signal } = controller
		pending.push({
			batch: params.batch,
			resolve: () => {
				if (!signal.aborted) resource.data = [params.batch]
			},
		})
	}
	if (options.auto) resource.reload()
	return resource
}

const router = createRouter({
	history: createMemoryHistory(),
	routes: [
		{ path: '/', component: { render: () => null } },
		{
			path: '/courses/:courseName',
			name: 'CourseDetail',
			component: { render: () => null },
		},
	],
})

// Mounted through a parent so the test can move the page to another batch.
const mountList = (props: { batchName?: string; editable?: boolean }) =>
	mount(
		defineComponent({
			render: () =>
				h(BatchCourseList, {
					batchName: props.batchName,
					editable: props.editable,
				}),
		}),
		{
			global: {
				plugins: [router],
				mocks: { __: (t: string) => t },
				provide: { $user: { data: {} } },
			},
		}
	)

describe('BatchCourseList courses request', () => {
	beforeEach(() => {
		sent.length = 0
		pending.length = 0
		createResourceMock.mockReset()
		createResourceMock.mockImplementation(fakeResource)
	})

	// Regression: get_batch_courses sent with no batch, so no courses showed
	// (#3007, fixed in #3040).
	it('waits for the batch name instead of sending an empty request', async () => {
		const batch = reactive<{ batchName?: string }>({})
		mountList(batch)
		await flushPromises()
		expect(sent.filter((p) => !p.batch)).toEqual([])

		batch.batchName = 'B1'
		await flushPromises()
		expect(sent.at(-1)).toEqual({ batch: 'B1', student_view: null })
	})

	it('fetches the new batch when the page moves to another batch', async () => {
		const batch = reactive<{ batchName?: string }>({ batchName: 'B1' })
		mountList(batch)
		await flushPromises()
		expect(sent.at(-1)).toEqual({ batch: 'B1', student_view: null })

		batch.batchName = 'B2'
		await flushPromises()
		expect(sent.at(-1)).toEqual({ batch: 'B2', student_view: null })
	})

	// Regression: a slow response for the previous batch overwrote the new
	// batch's courses (raised in review of #3040).
	it('ignores a late response for the batch the page has left', async () => {
		const batch = reactive<{ batchName?: string }>({ batchName: 'B1' })
		mountList(batch)
		await flushPromises()
		batch.batchName = 'B2'
		await flushPromises()

		const resource = createResourceMock.mock.results[0].value
		pending.find((p) => p.batch === 'B2')?.resolve()
		pending.find((p) => p.batch === 'B1')?.resolve()
		expect(resource.data).toEqual(['B2'])
	})
})

describe('BatchCourseList add course', () => {
	const respond = (batchCourses: unknown[]) =>
		createResourceMock.mockImplementation(() => ({
			data: batchCourses,
			abort: () => {},
			reload: () => {},
		}))

	beforeEach(() => {
		callMock.mockClear()
		createResourceMock.mockReset()
		respond([{ name: 'C1', title: 'One', batch_course: 'BC1' }])
	})

	const mountEditable = async () => {
		const wrapper = mount(BatchCourseList, {
			props: { batchName: 'B1', editable: true, category: 'ERPNext' },
			global: {
				plugins: [router],
				mocks: { __: (t: string) => t },
				provide: { $user: { data: {} } },
			},
		})
		await flushPromises()
		return wrapper
	}

	const openPicker = async () => {
		const wrapper = await mountEditable()
		const add = wrapper.findAll('button').find((b) => b.text() === 'Add course')
		await add!.trigger('click')
		return wrapper.findComponent({ name: 'PickerDialog' })
	}

	it('opens the picker on courses not in the batch, its category suggested', async () => {
		const picker = await openPicker()
		expect(picker.props('open')).toBe(true)
		expect(picker.props('items')).toEqual([{ value: 'C2', title: 'Two' }])
		expect(picker.props('categories')).toEqual(['ERPNext', 'Frappe'])
		expect(pickerItems).toEqual({ exclude: ['C1'], category: 'ERPNext' })
	})

	it('reports how many courses it shows, for the enrol card', async () => {
		const wrapper = await mountEditable()
		expect(wrapper.emitted('update:count')?.at(-1)).toEqual([1])
	})

	it('offers no create footer', async () => {
		expect((await openPicker()).props('createLabel')).toBeUndefined()
	})

	it('adds every picked course to the batch', async () => {
		;(await openPicker()).vm.$emit('add', ['C2', 'C3'])
		await flushPromises()
		const inserted = callMock.mock.calls.map(
			(call) =>
				(call as unknown as [string, { doc: { course: string } }])[1].doc
		)
		expect(inserted).toEqual([
			{
				doctype: 'Batch Course',
				course: 'C2',
				parent: 'B1',
				parenttype: 'LMS Batch',
				parentfield: 'courses',
			},
			expect.objectContaining({ course: 'C3' }),
		])
	})

	it('shows one call to action while the batch has no courses', async () => {
		respond([])
		const wrapper = await mountEditable()
		expect(wrapper.text()).toContain('No courses yet')
		const buttons = wrapper.findAll('button')
		expect(buttons.map((b) => b.text())).toEqual(['Add course'])
		await buttons[0].trigger('click')
		expect(wrapper.findComponent({ name: 'PickerDialog' }).props('open')).toBe(
			true
		)
	})

	it('removes a course by its batch row', async () => {
		const wrapper = await mountEditable()
		const remove = wrapper.findAll('button').find((b) => b.text() === '')
		await remove!.trigger('click')
		expect(callMock).toHaveBeenCalledWith('frappe.client.delete', {
			doctype: 'Batch Course',
			name: 'BC1',
		})
	})
})

describe('BatchCourseList on a batch not saved yet', () => {
	beforeEach(() => {
		callMock.mockClear()
		createResourceMock.mockReset()
		createResourceMock.mockImplementation(fakeResource)
		sent.length = 0
	})

	const mountDraft = (draft: string[]) => {
		const wrapper = mount(BatchCourseList, {
			props: {
				editable: true,
				draft,
				'onUpdate:draft': (names: string[]) =>
					wrapper.setProps({ draft: names }),
			},
			global: {
				plugins: [router],
				mocks: { __: (t: string) => t },
				provide: { $user: { data: {} } },
			},
		})
		return wrapper
	}

	it('keeps picked courses on the page without asking the server', async () => {
		const wrapper = mountDraft(['C2'])
		expect(wrapper.text()).toContain('Two')
		expect(wrapper.text()).not.toContain('40%')
		wrapper.findComponent({ name: 'PickerDialog' }).vm.$emit('add', ['C3'])
		await flushPromises()
		expect(wrapper.props('draft')).toEqual(['C2', 'C3'])
		expect(wrapper.text()).toContain('Three')

		const remove = wrapper.findAll('button').find((b) => b.text() === '')
		await remove!.trigger('click')
		expect(wrapper.props('draft')).toEqual(['C3'])
		expect(callMock).not.toHaveBeenCalled()
		expect(sent).toEqual([])
	})
})
