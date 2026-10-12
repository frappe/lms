import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	enableAutoUnmount,
	flushPromises,
	mount,
	type VueWrapper,
} from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type Router,
} from 'vue-router'
import { defineComponent, h } from 'vue'
import dayjs from '@/utils/dayjs'

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

const {
	batchResource,
	liveClassList,
	createResourceMock,
	createListResourceMock,
	getCachedListResourceMock,
	zoomSubmit,
	meetSubmit,
	access,
	openSettingsMock,
} = vi.hoisted(() => {
	// @/utils reaches plyr, which touches matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		batchResource: {
			data: null as Record<string, unknown> | null,
			loading: false,
			fetched: true,
			reload: () => {},
		},
		liveClassList: { data: [], reload: vi.fn() },
		createResourceMock: vi.fn(),
		createListResourceMock: vi.fn(),
		getCachedListResourceMock: vi.fn(),
		zoomSubmit: vi.fn(),
		meetSubmit: vi.fn(),
		access: { calendar: true, meet: true },
		openSettingsMock: vi.fn(),
	}
})

vi.mock('@/components/Settings/GoogleApi/googleApi', () => ({
	canManageGoogleIntegrations: () => access.calendar,
}))
vi.mock('@/components/Settings/GoogleMeet/googleMeet', () => ({
	canManageGoogleMeet: () => access.meet,
}))
vi.mock('@/utils/', async (importOriginal) => ({
	...(await importOriginal<object>()),
	openSettings: openSettingsMock,
}))

// HeaderButton wraps frappe-ui's Button in a Tooltip below the mobile
// breakpoint, and the hand-written frappe-ui mock here has no Tooltip. Stub it
// down to the bare button so the fallthrough attrs the assertions use
// (data-testid, the click handler) still land where they did before.
vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs" />`,
	},
}))

vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	createListResource: createListResourceMock,
	getCachedListResource: getCachedListResourceMock,
	toast: { success: vi.fn(), error: vi.fn() },
	Dialog: {
		name: 'Dialog',
		props: ['open', 'title', 'size'],
		emits: ['update:open'],
		template: `<div v-if="open" role="dialog"><slot name="title" /><slot /><slot name="actions" /></div>`,
	},
	Button: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs"><slot name="icon" /><slot name="prefix" /><slot /></button>`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'options'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /></label>`,
	},
	// Renders its label, as the real Combobox does: a stub that drops it makes
	// "every field is labelled" pass by omission.
	Combobox: {
		inheritAttrs: false,
		props: ['label'],
		template: `<div><label v-if="label">{{ label }}</label><slot /></div>`,
	},
	Tooltip: { inheritAttrs: false, template: `<div><slot /></div>` },
}))

vi.mock('@/components/Modals/LiveClassAttendance.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))

// @ts-expect-error a JS SFC has no generated types (TS7016) — the same gap
// every test importing a non-`lang="ts"` component in this suite hits.
import LiveClassForm from '@/pages/Forms/LiveClassForm.vue'
// @ts-expect-error same TS7016; LiveClass.vue predates this branch.
import LiveClass from '@/pages/Batches/components/LiveClass.vue'

const BATCH_URL = 'lms.lms.utils.get_batch_details'
const ZOOM_URL = 'lms.lms.doctype.lms_batch.lms_batch.create_live_class'
const MEET_URL =
	'lms.lms.doctype.lms_batch.lms_batch.create_google_meet_live_class'

const Parent = defineComponent({
	render: () => h('div', ['BATCH', h(RouterView)]),
})

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/batches/:batchName',
				name: 'BatchDetail',
				component: Parent,
				props: true,
				children: [
					{
						path: 'live-class/new',
						name: 'NewLiveClass',
						component: LiveClassForm,
						props: true,
					},
				],
			},
			{
				path: '/user/:username/slots',
				name: 'ProfileEvaluator',
				component: Parent,
			},
		],
	})

const provide = (user: Record<string, unknown>) => ({
	$user: { data: user },
	$dayjs: dayjs,
})

const mountForm = async (router: Router, user: Record<string, unknown>) => {
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: provide(user),
			stubs: { teleport: true },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

// A valid class, so the form's own checks let the submit through.
const fillForm = async (wrapper: VueWrapper) => {
	const values: Record<string, string> = {
		Title: 'Intro',
		Date: '2099-01-01',
		Time: '10:30',
		'Duration (in minutes)': '60',
	}
	for (const label of wrapper.findAll('label')) {
		const value = values[norm(label.text())]
		if (value) await label.find('input').setValue(value)
	}
}

const moderator = { name: 'mod@example.com', is_moderator: true }
const student = { name: 'student@example.com' }
const evaluator = {
	name: 'ash@example.com',
	username: 'ashley',
	is_evaluator: true,
}

const norm = (text: string) =>
	text
		.replace(/\s+/g, ' ')
		.replace(/\s*\*$/, '')
		.trim()

const FIELD_LABELS = [
	'Title',
	'Date',
	'Duration (in minutes)',
	'Time',
	'Timezone',
	'Auto Recording',
	'Description',
]

describe('LiveClassForm as a route', () => {
	beforeEach(() => {
		zoomSubmit.mockReset()
		meetSubmit.mockReset()
		liveClassList.reload.mockReset()
		getCachedListResourceMock.mockReset()
		getCachedListResourceMock.mockReturnValue(liveClassList)
		createListResourceMock.mockReset()
		createListResourceMock.mockReturnValue(liveClassList)
		createResourceMock.mockReset()
		createResourceMock.mockImplementation((options: { url: string }) => {
			if (options.url === BATCH_URL) return batchResource
			if (options.url === ZOOM_URL)
				return { submit: zoomSubmit, loading: false, data: null }
			if (options.url === MEET_URL)
				return { submit: meetSubmit, loading: false, data: null }
			return { submit: vi.fn(), loading: false, data: null }
		})
		batchResource.data = {
			name: 'B1',
			conferencing_provider: 'Zoom',
			zoom_account: 'zoom-1',
		}
		batchResource.loading = false
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	it('mounts straight from the URL with no parent page mounted', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/live-class/new')
		const wrapper = await mountForm(router, moderator)
		expect(wrapper.html()).toContain('Create a Live Class')
		expect(wrapper.find('[data-testid="live-class-fields"]').exists()).toBe(
			true
		)
	})

	it('fetches its own batch context for the batch in the URL', async () => {
		// The conferencing provider and its account come from get_batch_details.
		// This is the form's OWN fetch — BatchDetail's resource carries no cache
		// key, so there is no instance to share and none is claimed.
		const router = makeRouter()
		await router.push('/batches/B1/live-class/new')
		await mountForm(router, moderator)
		const batchCall = createResourceMock.mock.calls.find(
			(call) => call[0].url === BATCH_URL
		)
		expect(batchCall).toBeDefined()
		expect(batchCall?.[0].cache).toBeUndefined()
		expect(batchCall?.[0].makeParams()).toEqual({ batch: 'B1' })
	})

	it('refuses for a user who is not a batch admin', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/live-class/new')
		const wrapper = await mountForm(router, student)
		expect(wrapper.find('[data-testid="live-class-fields"]').exists()).toBe(
			false
		)
		expect(wrapper.html()).toContain('not permitted')
	})

	it('refuses when the batch has no conferencing account', async () => {
		batchResource.data = { name: 'B1', conferencing_provider: 'Zoom' }
		const router = makeRouter()
		await router.push('/batches/B1/live-class/new')
		const wrapper = await mountForm(router, moderator)
		expect(wrapper.find('[data-testid="live-class-fields"]').exists()).toBe(
			false
		)
		expect(wrapper.html()).toContain('conferencing provider')
	})

	it('carries every field of the live-class form', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/live-class/new')
		const wrapper = await mountForm(router, moderator)

		const labels = wrapper
			.find('[data-testid="live-class-fields"]')
			.findAll('label')
			.map((label) => norm(label.text()))
			.filter((text) => text !== '')
		for (const label of FIELD_LABELS) expect(labels).toContain(label)
		expect(labels).toHaveLength(FIELD_LABELS.length)
	})

	// Empty fields used to reach the server, and an empty duration came back as
	// an Internal Server Error.
	it('stops an incomplete form before it reaches the server', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/live-class/new')
		const wrapper = await mountForm(router, moderator)
		await wrapper.find('[data-testid="live-class-save"]').trigger('click')
		await flushPromises()

		expect(zoomSubmit).not.toHaveBeenCalled()
		const { toast } = await import('frappe-ui')
		expect(toast.error).toHaveBeenLastCalledWith('Please enter a title.')
	})

	it('submits through the endpoint the batch provider selects', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/live-class/new')
		const wrapper = await mountForm(router, moderator)
		await fillForm(wrapper)
		await wrapper.find('[data-testid="live-class-save"]').trigger('click')
		expect(zoomSubmit).toHaveBeenCalledTimes(1)
		expect(meetSubmit).not.toHaveBeenCalled()

		batchResource.data = {
			name: 'B1',
			conferencing_provider: 'Google Meet',
			google_meet_account: 'meet-1',
		}
		const meetRouter = makeRouter()
		await meetRouter.push('/batches/B1/live-class/new')
		const meetWrapper = await mountForm(meetRouter, moderator)
		await fillForm(meetWrapper)
		await meetWrapper.find('[data-testid="live-class-save"]').trigger('click')
		expect(meetSubmit).toHaveBeenCalledTimes(1)
	})

	// Guards a missing Google Calendar flashing past as a toast, whose action sat
	// outside the Dialog: the first click on it closed the form instead.
	describe('when the Google Calendar is missing', () => {
		const calendarMissing = (submit: ReturnType<typeof vi.fn>) =>
			submit.mockImplementation(
				(_doc: unknown, options: { onError: (e: unknown) => void }) =>
					options.onError({
						exc_type: 'GoogleCalendarMissingError',
						messages: [
							'A Google Calendar connection is needed to send invites for live classes.',
						],
					})
			)

		const shownLine = (wrapper: VueWrapper) => {
			const line = wrapper.find('[data-testid="live-class-calendar-missing"]')
			expect(line.exists()).toBe(true)
			return { text: line.text(), setUp: line.find('button') }
		}

		beforeEach(async () => {
			access.calendar = true
			access.meet = true
			openSettingsMock.mockReset()
			const { toast } = await import('frappe-ui')
			vi.mocked(toast.error).mockClear()
		})

		it('shows in the form and opens the Google Calendar settings', async () => {
			calendarMissing(zoomSubmit)
			const router = makeRouter()
			await router.push('/batches/B1/live-class/new')
			const wrapper = await mountForm(router, moderator)
			await fillForm(wrapper)
			await wrapper.find('[data-testid="live-class-save"]').trigger('click')
			await flushPromises()

			const line = shownLine(wrapper)
			expect(line.text).toBe(
				'A Google Calendar connection is needed to send invites for live classes. Set up'
			)
			const { toast } = await import('frappe-ui')
			expect(toast.error).not.toHaveBeenCalled()
			await line.setUp.trigger('click')
			expect(openSettingsMock).toHaveBeenCalledWith('google-calendar')
			expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
		})

		it('opens the Google Meet settings for a Google Meet batch', async () => {
			batchResource.data = {
				name: 'B1',
				conferencing_provider: 'Google Meet',
				google_meet_account: 'meet-1',
			}
			calendarMissing(meetSubmit)
			const router = makeRouter()
			await router.push('/batches/B1/live-class/new')
			const wrapper = await mountForm(router, moderator)
			await fillForm(wrapper)
			await wrapper.find('[data-testid="live-class-save"]').trigger('click')
			await flushPromises()

			await shownLine(wrapper).setUp.trigger('click')
			expect(openSettingsMock).toHaveBeenCalledWith('google-meet')
		})

		it('points anyone who cannot open the settings to their administrator', async () => {
			access.calendar = false
			calendarMissing(zoomSubmit)
			const router = makeRouter()
			await router.push('/batches/B1/live-class/new')
			const wrapper = await mountForm(router, moderator)
			await fillForm(wrapper)
			await wrapper.find('[data-testid="live-class-save"]').trigger('click')
			await flushPromises()

			const line = shownLine(wrapper)
			expect(line.setUp.exists()).toBe(false)
			expect(line.text).toContain('site administrator')
		})
		// Evaluators have no Settings modal; their own calendar lives on their
		// profile's Slots tab, which is where a Zoom class's invites come from.
		it('sends an evaluator to their own Slots tab for a Zoom class', async () => {
			calendarMissing(zoomSubmit)
			const router = makeRouter()
			await router.push('/batches/B1/live-class/new')
			const wrapper = await mountForm(router, evaluator)
			await fillForm(wrapper)
			await wrapper.find('[data-testid="live-class-save"]').trigger('click')
			await flushPromises()

			const line = shownLine(wrapper)
			expect(line.text).not.toContain('site administrator')
			await line.setUp.trigger('click')
			await flushPromises()
			expect(router.currentRoute.value.fullPath).toBe('/user/ashley/slots')
			expect(openSettingsMock).not.toHaveBeenCalled()
		})

		it("points an evaluator to the administrator for a Meet account's calendar", async () => {
			batchResource.data = {
				name: 'B1',
				conferencing_provider: 'Google Meet',
				google_meet_account: 'meet-1',
			}
			calendarMissing(meetSubmit)
			const router = makeRouter()
			await router.push('/batches/B1/live-class/new')
			const wrapper = await mountForm(router, evaluator)
			await fillForm(wrapper)
			await wrapper.find('[data-testid="live-class-save"]').trigger('click')
			await flushPromises()

			const line = shownLine(wrapper)
			expect(line.setUp.exists()).toBe(false)
			expect(line.text).toContain('site administrator')
		})
	})

	it('refreshes the Classes tab list after a create, by cache key', async () => {
		// The `reloadLiveClasses` defineModel is gone with the modal; the tab's
		// list resource is found by the key LiveClass.vue registers it under.
		const router = makeRouter()
		await router.push('/batches/B1/live-class/new')
		const wrapper = await mountForm(router, moderator)
		zoomSubmit.mockImplementation(
			(_doc: unknown, options: { onSuccess: () => void }) => options.onSuccess()
		)
		await fillForm(wrapper)
		await wrapper.find('[data-testid="live-class-save"]').trigger('click')
		await flushPromises()
		expect(getCachedListResourceMock).toHaveBeenCalledWith([
			'liveClasses',
			'B1',
		])
		expect(liveClassList.reload).toHaveBeenCalledTimes(1)
	})

	it('mobile: the back control pops the router back to the page', async () => {
		const router = makeRouter()
		await router.push('/batches/B1#classes')
		await router.push({
			name: 'NewLiveClass',
			params: { batchName: 'B1' },
			hash: '#classes',
			state: { lmsFormEntry: true },
		})
		Object.defineProperty(window, 'innerWidth', {
			value: 390,
			writable: true,
			configurable: true,
		})
		const wrapper = await mountForm(router, moderator)
		await wrapper.find('[data-testid="form-shell-back"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.fullPath).toBe('/batches/B1#classes')
	})

	it('desktop: dismissing the Dialog pops the router back to the page', async () => {
		const router = makeRouter()
		await router.push('/batches/B1#classes')
		await router.push({
			name: 'NewLiveClass',
			params: { batchName: 'B1' },
			hash: '#classes',
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router, moderator)
		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('BatchDetail')
	})

	it('closing a DEEP-LINKED form keeps the tab hash (C2)', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/live-class/new#classes')
		const wrapper = await mountForm(router, moderator)
		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()
		expect(router.currentRoute.value.fullPath).toBe('/batches/B1#classes')
	})
})

describe('the Classes tab opener', () => {
	beforeEach(() => {
		createListResourceMock.mockReset()
		createListResourceMock.mockReturnValue(liveClassList)
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	const mountTab = async (router: Router) =>
		mount(LiveClass, {
			props: {
				batch: {
					data: {
						name: 'B1',
						conferencing_provider: 'Zoom',
						zoom_account: 'zoom-1',
					},
				},
			},
			global: {
				plugins: [router],
				provide: provide(moderator),
				mocks: { __: (text: string) => text },
			},
		})

	it('registers its list under the key the form refreshes', async () => {
		const router = makeRouter()
		await router.push('/batches/B1#classes')
		await mountTab(router)
		expect(createListResourceMock).toHaveBeenCalledWith(
			expect.objectContaining({ cache: ['liveClasses', 'B1'] })
		)
	})

	it('opens the form route carrying the current tab hash (C2)', async () => {
		const router = makeRouter()
		await router.push('/batches/B1#classes')
		const wrapper = await mountTab(router)
		await wrapper.find('[data-testid="live-class-add"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.fullPath).toBe(
			'/batches/B1/live-class/new#classes'
		)
	})
})
