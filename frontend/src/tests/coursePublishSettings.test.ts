import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import CoursePublishSettings from '@/pages/Courses/CoursePublishSettings.vue'

vi.hoisted(() => {
	// @/utils pulls in plyr, which touches matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
})

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({
		settings: { data: { is_payments_app_installed: 1 } },
	}),
}))

const route = reactive({
	query: {} as Record<string, string>,
	hash: '#settings',
})
const router = {
	replace: vi.fn((to: { query: Record<string, string> }) => {
		route.query = to.query
	}),
}
vi.mock('vue-router', async (importOriginal) => ({
	...(await importOriginal<typeof import('vue-router')>()),
	useRoute: () => route,
	useRouter: () => router,
}))

vi.mock('frappe-ui', () => ({
	Dialog: { template: '<div><slot /></div>' },
	// FormControl exposes focus(), forwarded to its input.
	FormControl: {
		props: ['label'],
		methods: {
			focus(this: { $el: HTMLElement }) {
				this.$el.querySelector('input')?.focus()
			},
		},
		template: '<label>{{ label }}<input /></label>',
	},
	createResource: () => ({ data: null, reload: vi.fn(), submit: vi.fn() }),
}))

// NewMemberModal.vue -> RoleSwitches.vue pulls in members.ts -> Members.vue ->
// MemberForm.vue, which imports `@framework/ui/telemetry` and
// `@framework/ui/components/Onboarding`. Both must resolve even though nothing
// here renders MemberForm.vue.
vi.mock('@framework/ui/telemetry/index', () => ({}))
vi.mock('@framework/ui/components/Onboarding/index', () => ({}))

vi.stubGlobal('__', (s: string) => s)

const doc = {
	name: 'COURSE-1',
	upcoming: 0,
	featured: 0,
	disable_self_learning: 0,
	enforce_lesson_completion: 0,
}

describe('CoursePublishSettings', () => {
	it('renders a switch bound to enforce_lesson_completion', () => {
		const markDirty = vi.fn()
		const wrapper = mount(CoursePublishSettings, {
			global: {
				mocks: { __: (s: string) => s },
				provide: {
					courseForm: { resource: { doc }, markDirty, markUnsaved: vi.fn() },
					$dayjs: (v: unknown) => ({ format: () => String(v) }),
				},
				stubs: {
					CollapsibleSection: { template: '<div><slot /></div>' },
					Link: true,
					NewMemberModal: true,
					BooleanSwitch: {
						props: ['modelValue', 'label'],
						emits: ['update:modelValue'],
						template: `<button
							:data-label="label"
							@click="$emit('update:modelValue', !modelValue)"
						/>`,
					},
				},
			},
		})

		const toggle = wrapper.find('[data-label="Enforce Lesson Completion"]')
		expect(toggle.exists()).toBe(true)
	})

	it('marks the form dirty when the switch is flipped', async () => {
		const markDirty = vi.fn()
		const wrapper = mount(CoursePublishSettings, {
			global: {
				mocks: { __: (s: string) => s },
				provide: {
					courseForm: {
						resource: { doc: { ...doc } },
						markDirty,
						markUnsaved: vi.fn(),
					},
					$dayjs: (v: unknown) => ({ format: () => String(v) }),
				},
				stubs: {
					CollapsibleSection: { template: '<div><slot /></div>' },
					Link: true,
					NewMemberModal: true,
					BooleanSwitch: {
						props: ['modelValue', 'label'],
						emits: ['update:modelValue'],
						template: `<button
							:data-label="label"
							@click="$emit('update:modelValue', !modelValue)"
						/>`,
					},
				},
			},
		})

		await wrapper
			.find('[data-label="Enforce Lesson Completion"]')
			.trigger('click')
		expect(markDirty).toHaveBeenCalled()
	})
})

describe('CoursePublishSettings: pricing from onboarding', () => {
	afterEach(() => {
		route.query = {}
		router.replace.mockClear()
		document.body.innerHTML = ''
	})

	const mountSettings = async (
		courseDoc: Record<string, unknown>,
		get = { loading: false }
	) => {
		const markDirty = vi.fn()
		const markUnsaved = vi.fn()
		const resource = reactive({ doc: courseDoc, get })
		const wrapper = mount(CoursePublishSettings, {
			attachTo: document.body,
			global: {
				mocks: { __: (s: string) => s },
				provide: {
					courseForm: { resource, markDirty, markUnsaved },
					$dayjs: (v: unknown) => ({ format: () => String(v) }),
				},
				stubs: {
					CollapsibleSection: { template: '<div><slot /></div>' },
					Link: true,
					NewMemberModal: true,
					BooleanSwitch: true,
				},
			},
		})
		await flushPromises()
		return { wrapper, resource, markDirty, markUnsaved }
	}

	const priceInput = (wrapper: ReturnType<typeof mount>) =>
		wrapper
			.findAll('label')
			.find((l) => l.text() === 'Course price')
			?.find('input').element

	// Guards: onboarding's Set a price step landing on a free course with no
	// focus. Introduced in this branch (feat/onboarding-flows, PR pending); test
	// added there for the ?pricing=paid intent.
	it('turns Paid course on and puts the caret in the price', async () => {
		route.query = { pricing: 'paid' }
		const { wrapper, resource, markDirty, markUnsaved } = await mountSettings({
			...doc,
			paid_course: false,
			paid_certificate: 1,
		})
		expect(resource.doc.paid_course).toBe(1)
		expect(resource.doc.paid_certificate).toBe(0)
		expect(markUnsaved).toHaveBeenCalledTimes(1)
		expect(markDirty).not.toHaveBeenCalled()
		expect(document.activeElement).toBe(priceInput(wrapper))
	})

	// Guards: ?pricing=paid staying in the URL and flipping pricing again on a
	// later visit. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there.
	it('drops the query once read, so a later visit leaves the form alone', async () => {
		route.query = { pricing: 'paid', editLesson: '1-1' }
		await mountSettings({ ...doc, paid_course: false })
		expect(router.replace).toHaveBeenCalledWith({
			query: { editLesson: '1-1' },
			hash: '#settings',
		})
	})

	// Guards: the intent re-marking an already paid course unsaved. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there.
	it('only focuses the price of a course that is already paid', async () => {
		route.query = { pricing: 'paid' }
		const { wrapper, markUnsaved } = await mountSettings({
			...doc,
			paid_course: true,
		})
		expect(markUnsaved).not.toHaveBeenCalled()
		expect(document.activeElement).toBe(priceInput(wrapper))
	})

	// Guards: the intent applied to a stale cached doc that the reload then
	// overwrites. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there.
	it('waits for a cached course to finish reloading', async () => {
		route.query = { pricing: 'paid' }
		const get = reactive({ loading: true })
		const { wrapper, resource } = await mountSettings(
			{ ...doc, paid_course: false },
			get
		)
		expect(resource.doc.paid_course).toBe(false)
		resource.doc = { ...doc, paid_course: false }
		get.loading = false
		await flushPromises()
		expect(resource.doc.paid_course).toBe(1)
		expect(document.activeElement).toBe(priceInput(wrapper))
	})

	// Guards: plain visits to course settings changing pricing or focus.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there.
	it('leaves pricing and focus alone without the intent', async () => {
		const { wrapper, resource, markUnsaved } = await mountSettings({
			...doc,
			paid_course: false,
		})
		expect(resource.doc.paid_course).toBe(false)
		expect(markUnsaved).not.toHaveBeenCalled()
		expect(router.replace).not.toHaveBeenCalled()
		expect(priceInput(wrapper)).toBeUndefined()
		expect(document.activeElement).toBe(document.body)
	})
})
