/**
 * createDocumentResource caches by doctype and name, so edits a user chose to
 * discard stay in the cached doc and reappear when the record is reopened.
 * Discard must refetch the saved document.
 */
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useSettingsRecord } from '@/composables/useSettingsRecord'

const { guards, reload } = vi.hoisted(() => ({
	guards: [] as { isDirty: () => boolean; discard?: () => void }[],
	reload: vi.fn(() => Promise.resolve()),
}))

vi.mock('frappe-ui', () => ({
	call: vi.fn(),
	toast: { error: vi.fn() },
	createDocumentResource: ({ name }: { name: string }) =>
		reactive({
			name,
			doc: { name, code: 'EDITED' },
			isDirty: true,
			save: { submit: vi.fn() },
			reload,
		}),
}))

vi.mock('@/composables/useDirtyGuard', () => ({
	useDirtyGuard: (isDirty: () => boolean, discard?: () => void) =>
		guards.push({ isDirty, discard }),
}))

describe('useSettingsRecord', () => {
	it('refetches the saved document when the user discards edits', () => {
		const Host = defineComponent({
			setup() {
				useSettingsRecord({ doctype: 'LMS Coupon', record: ref('CPN-1') })
				return () => h('div')
			},
		})
		mount(Host)

		const guard = guards.at(-1)!
		expect(guard.isDirty()).toBe(true)
		guard.discard?.()
		expect(reload).toHaveBeenCalledTimes(1)
	})
})
