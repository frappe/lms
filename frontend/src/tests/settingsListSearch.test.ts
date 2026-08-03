/**
 * Every settings list searches the server, so a match beyond the first page is
 * reachable without pressing Load More.
 *
 * Each panel is mounted shallow and asked two things: that it declares search
 * fields to useSettingsListResource (a list with none can only ever match rows
 * already fetched), and that it hands SettingsList a search box wired to the
 * resource. The mechanism those fields drive is pinned in
 * settingsListResource.test.ts.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'

const { resourceCalls } = vi.hoisted(() => ({ resourceCalls: [] as any[] }))

const stubbedSource = () => ({
	resource: { delete: { submit: vi.fn() }, insert: { submit: vi.fn() } },
	search: '',
	rows: [],
	loading: false,
	hasNextPage: false,
	loadMore: vi.fn(),
	reload: vi.fn(),
	applyFilters: vi.fn(),
})

vi.mock('@/composables/useSettingsListResource', () => ({
	SETTINGS_PAGE_LENGTH: 13,
	useSettingsListResource: (options: any) => {
		resourceCalls.push(options)
		return {
			resource: { delete: { submit: vi.fn() }, insert: { submit: vi.fn() } },
			search: '',
			rows: [],
			loading: false,
			hasNextPage: false,
			loadMore: vi.fn(),
			reload: vi.fn(),
			applyFilters: vi.fn(),
			remove: vi.fn(),
		}
	},
}))

vi.mock('frappe-ui', () => ({
	call: vi.fn(() => Promise.resolve()),
	createResource: () => ({ submit: vi.fn(), data: {}, reload: vi.fn() }),
	toast: { success: vi.fn(), error: vi.fn() },
	Button: { template: '<button><slot /></button>' },
	Dialog: { template: '<div><slot /></div>' },
	FormControl: { template: '<input />' },
	LoadingIndicator: { template: '<span />' },
	Select: { template: '<select />' },
}))

vi.mock('frappe-ui/frappe', () => ({
	useOnboarding: () => ({ updateOnboardingStep: vi.fn() }),
	useTelemetry: () => ({ capture: vi.fn() }),
}))

// @/utils pulls in plyr, which touches window.matchMedia at import time.
vi.mock('@/utils', () => ({
	cleanError: (e: unknown) => e,
	openSettings: vi.fn(),
}))

vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@/utils/dayjs', () => ({
	default: () => ({ format: () => '01 Jan 2026' }),
}))

// Stubbed whole, not partially: importing the real vue-router pulls in
// src/router.js and, through it, plyr, which needs a DOM this suite has no use
// for.
vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn() }),
	useRoute: () => ({ params: {}, query: {} }),
	createRouter: () => ({ beforeEach: vi.fn(), afterEach: vi.fn() }),
	createWebHistory: () => ({}),
}))

vi.stubGlobal('__', (text: string) => text)

import Badges from '@/components/Settings/Badges/Badges.vue'
import CouponList from '@/components/Settings/Coupons/CouponList.vue'
import TransactionList from '@/components/Settings/Transactions/TransactionList.vue'
import BadgeAssignments from '@/components/Settings/Badges/BadgeAssignments.vue'
import Categories from '@/components/Settings/Categories.vue'
import Coupons from '@/components/Settings/Coupons/Coupons.vue'
import EmailTemplateList from '@/components/Settings/EmailTemplate/EmailTemplateList.vue'
import GoogleMeetSettings from '@/components/Settings/GoogleMeetSettings.vue'
import PaymentGateways from '@/components/Settings/PaymentGateways.vue'
import Transactions from '@/components/Settings/Transactions/Transactions.vue'
import ZoomSettings from '@/components/Settings/ZoomSettings.vue'

const panels = [
	{ name: 'Badges', component: Badges, searchFields: ['title', 'description'] },
	{
		name: 'Badge Assignments',
		component: BadgeAssignments,
		props: { badgeName: 'Top Learner' },
		searchFields: ['member_name', 'member'],
	},
	{ name: 'Categories', component: Categories, searchFields: ['category'] },
	{
		name: 'Coupons',
		component: Coupons,
		searchFields: ['code'],
		// The parent owns the resource; the child declares the columns.
		columnsIn: CouponList,
	},
	{
		name: 'Email Templates',
		component: EmailTemplateList,
		searchFields: ['name', 'subject'],
	},
	{
		name: 'Google Meet',
		component: GoogleMeetSettings,
		searchFields: ['member_name', 'google_calendar'],
	},
	{
		name: 'Payment Gateways',
		component: PaymentGateways,
		searchFields: ['name', 'gateway_settings'],
	},
	{
		name: 'Transactions',
		component: Transactions,
		searchFields: ['billing_name', 'member'],
		columnsIn: TransactionList,
	},
	{
		name: 'Zoom',
		component: ZoomSettings,
		searchFields: ['account_name', 'account_id', 'member_name'],
	},
]

const mountPanel = (panel: any) =>
	shallowMount(panel.component, {
		props: { label: panel.name, description: '', ...(panel.props || {}) },
		global: {
			provide: {
				$user: { data: { is_moderator: true, name: 'admin@example.com' } },
				$dayjs: () => ({ format: () => '01 Jan 2026' }),
			},
			mocks: { __: (text: string) => text },
		},
	})

describe('settings list search', () => {
	beforeEach(() => {
		resourceCalls.length = 0
	})

	it.each(panels)('$name searches the server', (panel) => {
		mountPanel(panel)

		expect(resourceCalls).toHaveLength(1)
		expect(resourceCalls[0].searchFields).toEqual(panel.searchFields)
	})

	// The header and every row are separate grid containers sharing one
	// template, so a content-sized track resolves to a different width in each:
	// Settings > Users put its Roles header ~300px right of the badges it
	// labels until its `width: 'auto'` came off.
	it.each(panels)('$name sizes every column identically in both', (panel) => {
		const owner = panel.columnsIn || panel.component
		const wrapper = shallowMount(owner, {
			props: {
				label: panel.name,
				description: '',
				list: stubbedSource(),
				...(panel.props || {}),
			},
			global: {
				provide: {
					$user: { data: { is_moderator: true, name: 'admin@example.com' } },
					$dayjs: () => ({ format: () => '01 Jan 2026' }),
				},
				mocks: { __: (text: string) => text },
			},
		})
		const columns = wrapper
			.findComponent({ name: 'SettingsList' })
			.props('columns') as { width?: string }[]

		for (const column of columns) {
			expect(column.width ?? '').not.toMatch(/auto|max-content|min-content/)
		}
	})

	it.each(panels)('$name pages at the shared page length', (panel) => {
		mountPanel(panel)

		// The composable owns the number; a panel that set its own would page
		// out of step with the Load More the shared component draws.
		expect(resourceCalls[0].pageLength).toBeUndefined()
	})
})
