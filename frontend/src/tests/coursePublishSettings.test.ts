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
	Dialog: { template: '<div><slot /></div>' },
	FormControl: { template: '<div />' },
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

// Regression: currency picker 403 for Moderator and Course Creator, LMS roles
// cannot read Currency (#3023, fixed in #3038).
describe('CoursePublishSettings currency picker', () => {
	it.each([{ paid_course: 1 }, { paid_certificate: 1 }])(
		'searches through the LMS query (%o)',
		(pricing) => {
			const wrapper = mount(CoursePublishSettings, {
				global: {
					mocks: { __: (s: string) => s },
					provide: {
						courseForm: {
							resource: { doc: { ...doc, ...pricing } },
							markDirty: vi.fn(),
						},
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

			const picker = wrapper
				.findAllComponents({ name: 'Link' })
				.find((link) => link.props('doctype') === 'Currency')
			expect(picker?.props('query')).toBe('lms.lms.api.search_currencies')
		}
	)
})
