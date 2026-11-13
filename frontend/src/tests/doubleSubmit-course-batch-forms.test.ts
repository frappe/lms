import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type Router,
} from 'vue-router'
import { defineComponent, h, reactive } from 'vue'

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

const { callMock, uploadMock, enroll, batchCourses, userResource } = vi.hoisted(
	() => {
		window.matchMedia ??= (() => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as unknown as typeof window.matchMedia
		return {
			callMock: vi.fn(),
			uploadMock: vi.fn(),
			enroll: { current: null as any },
			batchCourses: { current: null as any },
			userResource: { data: null as Record<string, unknown> | null },
		}
	}
)

const pending = () => {
	let resolve!: (value?: unknown) => void
	const promise = new Promise((done) => (resolve = done))
	return { promise, resolve }
}

const pendingResource = () => {
	const request = pending()
	const resource = reactive({
		loading: false,
		submit: vi.fn(() => {
			resource.loading = true
			return request.promise.then(() => {
				resource.loading = false
			})
		}),
	})
	return { resource, request }
}

vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		inheritAttrs: false,
		props: ['loading'],
		template: `<button v-bind="$attrs" :data-loading="loading ? 'true' : 'false'" />`,
	},
}))

vi.mock('@/components/ResponsiveListView.vue', () => ({
	default: {
		template: `<div><slot name="selection-actions" :selections="new Set(['row-1', 'row-2'])" :unselectAll="() => {}" /></div>`,
	},
}))

vi.mock('@/components/SectionEmptyState.vue', () => ({
	default: { render: () => null },
}))

vi.mock('@/components/VideoPreview.vue', () => ({
	default: { render: () => null },
}))

vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource }) }))

vi.mock('@/utils/timezone', () => ({
	formatTimezone: () => '',
	nextOccurrence: () => null,
}))

vi.mock('frappe-ui', () => ({
	call: callMock,
	createResource: () => enroll.current,
	createListResource: () => batchCourses.current,
	toast: { success: vi.fn(), error: vi.fn() },
	FileUploadHandler: class {
		on() {}
		upload(...args: unknown[]) {
			return uploadMock(...args)
		}
	},
	Alert: { template: `<div />` },
	Badge: { template: `<span><slot /></span>` },
	Dialog: {
		props: ['open'],
		template: `<div v-if="open"><slot /><slot name="actions" /></div>`,
	},
	Button: {
		inheritAttrs: false,
		props: ['loading', 'route'],
		template: `<button v-bind="$attrs" :data-loading="loading ? 'true' : 'false'"><slot /></button>`,
	},
}))

import CourseImportForm from '@/pages/Forms/CourseImportForm.vue'
// @ts-expect-error a JS SFC has no generated types (TS7016)
import BatchOverlay from '@/pages/Batches/components/BatchOverlay.vue'
// @ts-expect-error a JS SFC has no generated types (TS7016)
import BatchCourses from '@/pages/Batches/components/BatchCourses.vue'

const global = {
	mocks: { __: (text: string) => text },
	stubs: { teleport: true },
}

describe('double submit guards: course and batch forms', () => {
	beforeEach(() => {
		callMock.mockReset()
		uploadMock.mockReset()
		userResource.data = { name: 'mod@example.com', is_moderator: true }
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	it('enrolls in a batch once while the first enrollment is pending', async () => {
		const { resource, request } = pendingResource()
		enroll.current = resource
		const wrapper = mount(BatchOverlay, {
			props: {
				batch: {
					data: {
						name: 'B1',
						courses: [],
						start_date: '2099-01-01',
						end_date: '2099-01-10',
						start_time: '09:00:00',
						end_time: '11:00:00',
						accept_enrollments: 1,
						allow_self_enrollment: 1,
						seat_count: 0,
					},
					reload: vi.fn(),
				},
			},
			global: {
				...global,
				provide: { $user: { data: { name: 'stu@example.com' } } },
			},
		})
		const button = () =>
			wrapper.findAll('button').find((b) => b.text().includes('Enroll Now'))!

		await button().trigger('click')
		await button().trigger('click')

		expect(resource.submit).toHaveBeenCalledTimes(1)
		expect(button().attributes('data-loading')).toBe('true')
		request.resolve()
		await flushPromises()
		expect(button().attributes('data-loading')).toBe('false')
	})

	it('imports a course zip once while the first import is pending', async () => {
		const request = pending()
		callMock.mockReturnValue(request.promise)
		uploadMock.mockResolvedValue({
			file_url: '/files/course.zip',
			file_name: 'course.zip',
			file_size: 2048,
		})
		const List = defineComponent({ render: () => h(RouterView) })
		const router: Router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{
					path: '/courses',
					name: 'Courses',
					component: List,
					children: [
						{
							path: 'import',
							name: 'CourseImport',
							component: CourseImportForm,
						},
					],
				},
				{ path: '/courses/:courseName', name: 'CourseDetail', component: List },
			],
		})
		await router.push({ name: 'CourseImport' })
		const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
			global: { ...global, plugins: [router] },
		})
		await flushPromises()

		const input = wrapper.find('input[type="file"]')
		Object.defineProperty(input.element, 'files', {
			value: [new File(['zip'], 'course.zip', { type: 'application/zip' })],
			configurable: true,
		})
		await input.trigger('change')
		await flushPromises()

		const submit = () => wrapper.find('[data-testid="course-import-submit"]')
		await submit().trigger('click')
		await submit().trigger('click')

		expect(callMock).toHaveBeenCalledTimes(1)
		expect(submit().attributes('data-loading')).toBe('true')
		request.resolve('imported-course')
		await flushPromises()
		expect(callMock).toHaveBeenCalledTimes(1)
	})

	it('deletes selected batch courses once while deletion is pending', async () => {
		const request = pending()
		const submit = vi.fn(() => request.promise)
		batchCourses.current = reactive({
			data: [{ name: 'row-1' }, { name: 'row-2' }],
			delete: { submit, loading: false },
		})
		const wrapper = mount(BatchCourses, {
			props: { batch: { data: { name: 'B1', can_manage: 1 } } },
			global: {
				...global,
				provide: { $user: { data: { name: 'mod@example.com' } } },
				plugins: [
					createRouter({
						history: createMemoryHistory(),
						routes: [{ path: '/', component: { render: () => null } }],
					}),
				],
			},
		})
		const button = () =>
			wrapper
				.findAll('button')
				.find((b) => b.attributes('label') === 'Delete selected courses')!

		await button().trigger('click')
		await button().trigger('click')

		expect(submit).toHaveBeenCalledTimes(1)
		expect(button().attributes('data-loading')).toBe('true')
		request.resolve()
		await flushPromises()
		expect(submit).toHaveBeenCalledTimes(2)
		expect(button().attributes('data-loading')).toBe('false')
	})
})
