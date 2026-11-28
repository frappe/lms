import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import CoursePublishSettings from '@/pages/Courses/CoursePublishSettings.vue'

const { settingsData } = vi.hoisted(() => {
	// @/utils pulls in plyr, which touches matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return { settingsData: { is_payments_app_installed: 1 } }
})

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ settings: { data: settingsData } }),
}))

vi.mock('frappe-ui', () => ({
	Button: { template: '<button v-bind="$attrs"><slot /></button>' },
	Dialog: { template: '<div><slot /></div>' },
	FormControl: { template: '<div />' },
	createResource: () => ({
		data: null,
		reload: vi.fn(),
		submit: vi.fn(),
	}),
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
	it('marks the form dirty when the switch is flipped', async () => {
		const markDirty = vi.fn()
		const wrapper = mount(CoursePublishSettings, {
			global: {
				mocks: { __: (s: string) => s },
				provide: {
					courseForm: { resource: { doc: { ...doc } }, markDirty },
					$dayjs: (v: unknown) => ({ format: () => String(v) }),
				},
				stubs: {
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

		await wrapper.find('[data-label="Lessons in sequence"]').trigger('click')
		expect(markDirty).toHaveBeenCalled()
	})
})

describe('CoursePublishSettings evaluator', () => {
	it('asks for an evaluator only on a paid certificate', () => {
		const mountWith = (extra: Record<string, unknown>) =>
			mount(CoursePublishSettings, {
				global: {
					mocks: { __: (s: string) => s },
					provide: {
						courseForm: {
							resource: { doc: { ...doc, ...extra } },
							markDirty: vi.fn(),
						},
					},
					stubs: {
						Link: true,
						NewMemberModal: true,
						BooleanSwitch: true,
					},
				},
			})
		const evaluatorPicker = (wrapper: ReturnType<typeof mountWith>) =>
			wrapper
				.findAllComponents({ name: 'Link' })
				.some((link) => link.props('doctype') === 'Course Evaluator')

		expect(evaluatorPicker(mountWith({ paid_certificate: 1 }))).toBe(true)
		expect(evaluatorPicker(mountWith({ enable_certification: 1 }))).toBe(false)
	})

	const mountPricing = (extra: Record<string, unknown>) => {
		const course: Record<string, unknown> = reactive({ ...doc, ...extra })
		const markDirty = vi.fn()
		const wrapper = mount(CoursePublishSettings, {
			global: {
				mocks: { __: (s: string) => s },
				provide: { courseForm: { resource: { doc: course }, markDirty } },
				stubs: {
					Link: true,
					NewMemberModal: true,
					PriceInput: { name: 'PriceInput', template: '<div />' },
					PaymentsAppDialog: {
						name: 'PaymentsAppDialog',
						props: ['modelValue'],
						template: '<div />',
					},
					BooleanSwitch: {
						props: ['modelValue', 'label'],
						emits: ['update:modelValue'],
						template: `<button
							:data-label="label"
							:data-on="modelValue ? 1 : 0"
							@click="$emit('update:modelValue', !modelValue)"
						/>`,
					},
				},
			},
		})
		return { wrapper, course, markDirty }
	}
	const toggle = (wrapper: ReturnType<typeof mount>, label: string) =>
		wrapper.get(`[data-label="${label}"]`).trigger('click')

	it('sells the course from Settings, with its price', async () => {
		const { wrapper, course, markDirty } = mountPricing({ paid_course: 0 })
		await toggle(wrapper, 'Paid course')
		expect(course.paid_course).toBe(1)
		expect(markDirty).toHaveBeenCalled()
		expect(wrapper.findComponent({ name: 'PriceInput' }).exists()).toBe(true)
		// A paid course charges already, so it offers no paid certificate.
		expect(wrapper.find('[data-label="Paid certificate"]').exists()).toBe(false)
	})

	it('turns on a completion certificate from Settings', async () => {
		const { wrapper, course } = mountPricing({})
		await toggle(wrapper, 'Completion certificate')
		expect(course.enable_certification).toBe(1)
		expect(course.paid_certificate).toBe(0)
	})

	it('sells a certificate on a free course, replacing the free one', async () => {
		const { wrapper, course } = mountPricing({ enable_certification: 1 })
		await toggle(wrapper, 'Paid certificate')
		expect(course.paid_certificate).toBe(1)
		expect(course.enable_certification).toBe(0)
		expect(wrapper.findComponent({ name: 'PriceInput' }).exists()).toBe(true)
	})

	describe('without the Payments app', () => {
		afterEach(() => {
			settingsData.is_payments_app_installed = 1
		})

		it.each(['Paid course', 'Paid certificate'])(
			'asks for the app on "%s" and leaves the course as it was',
			async (label) => {
				settingsData.is_payments_app_installed = 0
				const { wrapper, course, markDirty } = mountPricing({})
				const before = { ...course }
				await toggle(wrapper, label)

				expect(course).toEqual(before)
				expect(markDirty).not.toHaveBeenCalled()
				expect(
					wrapper
						.findComponent({ name: 'PaymentsAppDialog' })
						.props('modelValue')
				).toBe(true)
			}
		)
	})
})
