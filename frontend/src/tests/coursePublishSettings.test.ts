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
// MemberForm.vue, which imports `@framework/ui`. Its root barrel also
// `export *`s components (GeolocationField among them) that import
// `leaflet`/`leaflet-draw` assets not installed in this frontend — loading the
// real module crashes module resolution, even though nothing here renders
// MemberForm.vue.
vi.mock('@framework/ui', () => ({}))

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
					courseForm: { resource: { doc }, markDirty },
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
