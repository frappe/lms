/**
 * The Email Accounts list must keep showing which account holds each site-wide
 * default.
 *
 * defaultsBadgeLabel is unit-tested next door, but the label being correct is
 * worth nothing if no column calls it — which is exactly what happened when the
 * list moved from EmailAccountCard onto SettingsList: the card carried the
 * badge, the replacement columns did not, and nothing failed. This pins the
 * wiring rather than the label.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { SettingsListColumn } from '@/types'

const columnsSeen: SettingsListColumn[][] = []

vi.mock('@/components/Layouts/SettingsList.vue', () => ({
	default: {
		name: 'SettingsList',
		props: ['columns', 'rows', 'loading', 'hasNextPage', 'search'],
		setup(props: { columns: SettingsListColumn[] }) {
			columnsSeen.push(props.columns)
			return () => null
		},
	},
}))

vi.mock('@/composables/useSettingsListResource', () => ({
	useSettingsListResource: () => ({
		rows: [],
		loading: false,
		hasNextPage: false,
		search: '',
		loadMore: vi.fn(),
		remove: vi.fn(),
	}),
}))

vi.mock('frappe-ui', () => ({
	Dialog: { template: '<div />' },
	toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/utils', () => ({
	cleanError: (e: unknown) => e,
	validateEmail: () => true,
}))

vi.mock('@/components/Settings/EmailAccount/EmailProviderIcon.vue', () => ({
	default: { template: '<span />' },
}))

vi.stubGlobal('__', (s: string) => s)

import EmailAccountList from '@/components/Settings/EmailAccount/EmailAccountList.vue'

const badgeColumn = () => {
	mount(EmailAccountList, { global: { mocks: { __: (s: string) => s } } })
	const columns = columnsSeen.at(-1)
	expect(columns, 'SettingsList never received columns').toBeTruthy()
	return columns!.find((c) => c.type === 'badge')
}

describe('Email Accounts list', () => {
	it('renders a badge column for the site-wide defaults', () => {
		expect(badgeColumn()).toBeTruthy()
	})

	it('labels an account that holds both defaults', () => {
		const column = badgeColumn()
		if (!column || column.type !== 'badge') throw new Error('no badge column')
		expect(
			column.badges({ default_incoming: 1, default_outgoing: 1 })[0]?.label
		).toBe('Default Sending & Inbox')
	})

	it('labels an account that holds neither by what it is enabled for', () => {
		const column = badgeColumn()
		if (!column || column.type !== 'badge') throw new Error('no badge column')
		expect(
			column.badges({
				default_incoming: 0,
				default_outgoing: 0,
				enable_incoming: 0,
				enable_outgoing: 1,
			})[0]?.label
		).toBe('Sending')
	})
})
