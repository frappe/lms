/**
 * PendingInvites.vue: Settings > Invites, the people invited who have not accepted yet.
 * The list layout is stubbed to its rows and columns, so the test reads what it would
 * draw and runs a row's menu actions directly.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import type { SettingsListColumn, SettingsListRow } from '@/types'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const createDialog = vi.hoisted(() => vi.fn())
const invites = vi.hoisted(() => ({ store: null as any }))

vi.mock('frappe-ui', () => ({ toast, call: vi.fn() }))
vi.mock('@/utils', () => ({ cleanError: (message: string) => message }))
vi.mock('@/utils/dialogs', () => ({ createDialog }))
vi.mock('@framework/ui/components/InviteUser/index', () => ({
	useInviteUser: () => invites.store,
}))
vi.mock('@/components/Settings/Members/Members.vue', () => ({
	default: defineComponent({ render: () => null }),
}))
vi.mock('@/components/Layouts/EmptyStateLayout.vue', () => ({
	default: defineComponent({ render: () => null }),
}))
vi.mock('@/components/Layouts/settings/desktop/SettingsList.vue', () => ({
	default: defineComponent({
		name: 'SettingsList',
		props: ['columns', 'rows', 'search', 'emptyContent'],
		emits: ['update:search'],
		setup: (props) => () =>
			h(
				'ul',
				props.rows.map((row: SettingsListRow) => h('li', row.email))
			),
	}),
}))

const PENDING = [
	{ name: 'inv-1', email: 'asha@example.com', roles: ['Batch Evaluator'] },
	{ name: 'inv-2', email: 'ravi@example.com', roles: ['LMS Student'] },
]

async function mountPage() {
	const { default: PendingInvites } = await import(
		'@/components/Settings/Members/PendingInvites.vue'
	)
	return mount(PendingInvites, {
		props: { label: 'Invites' },
		global: { mocks: { __: (text: string) => text } },
	})
}

type Page = Awaited<ReturnType<typeof mountPage>>

const list = (wrapper: Page) => wrapper.findComponent({ name: 'SettingsList' })
const shown = (wrapper: Page) => wrapper.findAll('li').map((item) => item.text())

function menu(wrapper: Page, email: string) {
	const columns = list(wrapper).props('columns') as SettingsListColumn[]
	const actions = columns.find((column) => column.type === 'actions')
	const row = PENDING.find((invite) => invite.email === email)!
	return actions?.type === 'actions' ? actions.options(row) : []
}

function confirmDialog() {
	const close = vi.fn()
	createDialog.mock.calls[0][0].actions[0].onClick({ close })
	return close
}

describe('PendingInvites', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		invites.store = reactive({
			pendingInvites: [...PENDING],
			loading: false,
			load: vi.fn(),
			resend: vi.fn(async () => {}),
			cancel: vi.fn(async () => {}),
		})
	})

	it('loads the pending invites and lists them', async () => {
		const wrapper = await mountPage()

		expect(invites.store.load).toHaveBeenCalled()
		expect(shown(wrapper)).toEqual(['asha@example.com', 'ravi@example.com'])
	})

	it('narrows the list by email as the search changes', async () => {
		const wrapper = await mountPage()
		list(wrapper).vm.$emit('update:search', 'ASHA')
		await flushPromises()

		expect(shown(wrapper)).toEqual(['asha@example.com'])
	})

	it('resends an invite from the row menu', async () => {
		const wrapper = await mountPage()
		menu(wrapper, 'asha@example.com')[0].onClick()
		await flushPromises()

		expect(invites.store.resend).toHaveBeenCalledWith('inv-1')
		expect(toast.success).toHaveBeenCalledWith('Invite sent again to asha@example.com')
	})

	it('cancels an invite only once the dialog is confirmed', async () => {
		const wrapper = await mountPage()
		menu(wrapper, 'ravi@example.com')[1].onClick()
		expect(invites.store.cancel).not.toHaveBeenCalled()

		const close = confirmDialog()
		await flushPromises()

		expect(invites.store.cancel).toHaveBeenCalledWith('inv-2')
		expect(close).toHaveBeenCalled()
	})

	it('keeps the dialog open and says why when cancelling fails', async () => {
		invites.store.cancel = vi.fn(async () => {
			throw { messages: ['Invitation not found'] }
		})
		const wrapper = await mountPage()
		menu(wrapper, 'ravi@example.com')[1].onClick()

		const close = confirmDialog()
		await flushPromises()

		expect(close).not.toHaveBeenCalled()
		expect(toast.error).toHaveBeenCalledWith('Invitation not found')
	})
})
