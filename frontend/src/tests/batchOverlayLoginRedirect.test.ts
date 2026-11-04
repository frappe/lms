import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.stubGlobal('__', (text: string) => text)

vi.mock('frappe-ui', () => ({
	createResource: () => ({ submit: vi.fn() }),
	toast: { success: vi.fn(), error: vi.fn() },
	Badge: { template: `<span />` },
	Button: { template: `<button><slot /></button>` },
}))
vi.mock('@/components/VideoPreview.vue', () => ({
	default: { render: () => null },
}))
vi.mock('@/utils', () => ({
	formatNumberIntoCurrency: () => '',
	formatTime: () => '',
	getFormattedDateRange: () => '',
}))
vi.mock('@/utils/timezone', () => ({
	formatTimezone: () => '',
	nextOccurrence: () => null,
}))

// @ts-expect-error a JS SFC has no generated types (TS7016)
import BatchOverlay from '@/pages/Batches/components/BatchOverlay.vue'

const original = window.location

afterEach(() => {
	Object.defineProperty(window, 'location', {
		value: original,
		configurable: true,
	})
})

describe('BatchOverlay for a guest', () => {
	// hooks.py redirects /batches/<name> to the batch list, so a login that
	// returns there loses the batch. The page's own path survives the login.
	it('returns to the batch page after login', async () => {
		const location = { pathname: '/lms/batches/details/B1', href: '' }
		Object.defineProperty(window, 'location', {
			value: location,
			configurable: true,
		})
		const wrapper = mount(BatchOverlay, {
			props: {
				batch: {
					data: {
						name: 'B1',
						courses: [],
						allow_self_enrollment: 1,
						accept_enrollments: true,
						seat_count: 10,
						seats_left: 5,
					},
				},
			},
			global: {
				provide: { $user: { data: null } },
				mocks: { __: (text: string) => text },
			},
		})

		await wrapper.find('button').trigger('click')
		expect(location.href).toBe('/login?redirect-to=/lms/batches/details/B1')
	})
})
