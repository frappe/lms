/**
 * Services is a manual-save page, so leaving it with unsaved edits must go
 * through the dirty guard. The typed Google client secret lives outside both
 * documents, so the guard has to count it and Discard has to clear it.
 */
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { mount } from '@vue/test-utils'

const { guards, sources } = vi.hoisted(() => ({
	guards: [] as { isDirty: () => boolean; discard?: () => void }[],
	sources: [] as { isDirty: boolean; reload: () => Promise<unknown> }[],
}))

vi.mock('frappe-ui', () => ({
	call: vi.fn(),
	toast: { error: vi.fn(), success: vi.fn() },
	FormControl: { template: '<input />' },
	Password: {
		props: ['modelValue', 'ariaLabel'],
		emits: ['update:modelValue'],
		template:
			'<input :aria-label="ariaLabel" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
	},
}))

vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: { template: '<div />' },
}))

vi.mock('@/components/Layouts/settings/desktop/SettingsLayout.vue', () => ({
	default: { template: '<div><slot /></div>' },
}))

vi.mock('@/components/Settings/GoogleApi/googleApi', () => ({
	canManageGoogleIntegrations: () => true,
}))

vi.mock('@/composables/useSettingsSource', () => ({
	reportSaveFailure: vi.fn(),
	useSettingsSource: () => {
		const source = reactive({
			doc: {} as Record<string, unknown>,
			isDirty: false,
			reload: vi.fn(() => Promise.resolve()),
			save: vi.fn(() => Promise.resolve()),
		})
		sources.push(source)
		return source
	},
}))

vi.mock('@/composables/useDirtyGuard', () => ({
	useDirtyGuard: (isDirty: () => boolean, discard?: () => void) =>
		guards.push({ isDirty, discard }),
}))

import Services from '@/components/Settings/Services/Services.vue'

const build = () =>
	mount(Services, { global: { mocks: { __: (s: string) => s } } })

describe('Services dirty guard', () => {
	it('guards a typed client secret and clears it on discard', async () => {
		const wrapper = build()
		const guard = guards.at(-1)!
		expect(guard.isDirty()).toBe(false)

		const secret = wrapper.findAll('input').at(-1)!
		await secret.setValue('s3cret')
		expect(guard.isDirty()).toBe(true)

		guard.discard?.()
		await wrapper.vm.$nextTick()
		expect(guard.isDirty()).toBe(false)
		expect((secret.element as HTMLInputElement).value).toBe('')
	})

	it('refetches only the documents that hold edits on discard', () => {
		sources.length = 0
		build()
		const [google, lms] = sources
		lms.isDirty = true

		guards.at(-1)!.discard?.()
		expect(lms.reload).toHaveBeenCalledTimes(1)
		expect(google.reload).not.toHaveBeenCalled()
	})
})
