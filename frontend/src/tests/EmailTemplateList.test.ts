/**
 * Tests for EmailTemplateList.vue — the settings list of templates.
 *
 * Focus: Delete goes through a confirm Dialog before calling delete.submit,
 * and it deletes the row that was clicked (not the first row).
 *
 * The frappe-ui/list family is stubbed (it is frappe-ui's own, tested there);
 * ListRows renders its row slot per item so the per-row Dropdown is reachable.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import EmailTemplateList from '@/components/Settings/EmailTemplate/EmailTemplateList.vue'

const { deleteSubmit, toastMock } = vi.hoisted(() => ({
	deleteSubmit: vi.fn(),
	toastMock: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('frappe-ui', () => ({
	createListResource: () => ({
		data: [
			{ name: 'Welcome', subject: 'Hello', use_html: 0, response: 'r' },
			{
				name: 'Dispatch',
				subject: 'Out for delivery',
				use_html: 0,
				response: 'r',
			},
		],
		delete: { submit: deleteSubmit },
	}),
	toast: toastMock,
	Button: {
		props: ['label'],
		emits: ['click'],
		template: `<button :data-testid="'btn-' + label" @click="$emit('click')"><slot name="prefix" />{{ label }}</button>`,
	},
	Dialog: {
		props: ['open', 'title', 'message', 'actions'],
		template: `<div v-if="open" data-testid="dialog">
			<div data-testid="dialog-title">{{ title }}</div>
			<button v-for="a in actions" :key="a.label" :data-testid="'dlg-' + a.label" @click="a.onClick()">{{ a.label }}</button>
		</div>`,
	},
	Dropdown: {
		props: ['options'],
		template: `<div><button v-for="o in options" :key="o.label" :data-testid="'opt-' + o.label" @click="o.onClick()">{{ o.label }}</button><slot /></div>`,
	},
}))

vi.mock('frappe-ui/list', () => ({
	List: { template: `<div><slot /></div>` },
	// Render the row slot once per item, mirroring the real ListRows contract.
	ListRows: {
		props: ['items', 'rowKey'],
		template: `<div><template v-for="item in items" :key="item.name">
			<slot :item="item" :value="item.name" />
		</template></div>`,
	},
	ListRow: { template: `<div><slot /></div>` },
	ListCell: { template: `<div><slot /></div>` },
	ListHeader: { template: `<div><slot /></div>` },
	ListHeaderCell: { template: `<div><slot /></div>` },
}))

vi.mock('@/components/Layouts/SettingsLayout.vue', () => ({
	default: { template: `<div><slot name="header-actions" /><slot /></div>` },
}))
vi.mock('@/components/Layouts/EmptyStateLayout.vue', () => ({
	default: { props: ['name', 'description', 'icon'], template: `<div />` },
}))
vi.mock('@/utils', () => ({ cleanError: (e: unknown) => e }))

vi.stubGlobal('__', (s: string) => s)
// `String.prototype.format` is a frappe global used by the dialog title.
// @ts-expect-error augmenting String for the test runtime
String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_m: string, i: number) => String(args[i]))
}

const mountList = () =>
	mount(EmailTemplateList, {
		props: { label: 'Templates' },
		global: {
			mocks: { __: (s: string) => s },
			stubs: { LucidePlus: true },
		},
	})

beforeEach(() => {
	deleteSubmit.mockReset()
	toastMock.success.mockReset()
})

describe('EmailTemplateList', () => {
	it('Delete opens a confirm dialog and only deletes after confirming', async () => {
		const w = mountList()
		// no dialog yet, no delete
		expect(w.find('[data-testid="dialog"]').exists()).toBe(false)

		await w.findAll('[data-testid="opt-Delete"]')[1].trigger('click')
		await flushPromises()
		// dialog now open, still no delete call
		expect(w.get('[data-testid="dialog-title"]').text()).toBe(
			'Delete Dispatch?'
		)
		expect(deleteSubmit).not.toHaveBeenCalled()

		await w.get('[data-testid="dlg-Delete"]').trigger('click')
		await flushPromises()
		expect(deleteSubmit).toHaveBeenCalledTimes(1)
		expect(deleteSubmit.mock.calls[0][0]).toBe('Dispatch')
	})

	it('cancelling the delete dialog does not delete', async () => {
		const w = mountList()
		await w.findAll('[data-testid="opt-Delete"]')[0].trigger('click')
		await w.get('[data-testid="dlg-Cancel"]').trigger('click')
		await flushPromises()
		expect(deleteSubmit).not.toHaveBeenCalled()
	})
})
