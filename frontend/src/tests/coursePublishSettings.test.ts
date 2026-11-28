import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
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

	it('points to the Overview when the course has no certificate', () => {
		const wrapper = mount(CoursePublishSettings, {
			global: {
				mocks: { __: (s: string) => s },
				provide: {
					courseForm: { resource: { doc: { ...doc } }, markDirty: vi.fn() },
				},
				stubs: { Link: true, NewMemberModal: true, BooleanSwitch: true },
			},
		})
		expect(wrapper.text()).toContain(
			'Turn on a certificate on the Overview page first.'
		)
	})
})
