/**
 * A combinator switch confirms whenever the diff moves anyone: AND→OR adds members,
 * OR→AND removes them, so the gate is `added > 0 || removed > 0`, not the ≥25 threshold.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import { useMappingList } from '@/composables/raven/useMappingList'
import MassRemovalConfirmDialog from '@/components/Settings/Raven/MassRemovalConfirmDialog.vue'

const h = vi.hoisted(() => ({
	resources: [] as any[],
	toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('frappe-ui', () => ({
	toast: h.toast,
	createResource: (config: any) => {
		const url = String(config.url)
		const res: any = reactive({
			url,
			params: config.params,
			loading: false,
			data: null,
			error: null,
		})
		res.reset = vi.fn(() => {
			res.data = null
		})
		res.reload = vi.fn(async () => res.data)
		res.submit = vi.fn(async (payload: any) => {
			res.lastPayload = payload
			res.submitCount = (res.submitCount ?? 0) + 1
			return undefined
		})
		res._config = config
		h.resources.push(res)
		return res
	},
	Dialog: {
		props: ['modelValue', 'title', 'message', 'size', 'actions'],
		emits: ['update:modelValue'],
		template: `
			<div>
				<div data-testid="title">{{ title }}</div>
				<div data-testid="message">{{ message }}</div>
				<button
					v-for="a in actions"
					:key="a.label"
					:data-testid="'action-' + a.theme"
					@click="a.onClick()"
				>{{ a.label }}</button>
			</div>
		`,
	},
}))

vi.stubGlobal('__', (s: string) => s)
// `String.prototype.format` is a frappe global the dialog copy relies on.
String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_m: string, i: number) => String(args[i]))
}

const res = (fragment: string) =>
	h.resources.find((r) => r.url.includes(fragment))

const mappedWorkspace = () => ({
	name: 'RWM-1',
	mapped: true,
	raven_workspace: 'WS-1',
	workspace_label: 'Design HQ',
	workspace_type: 'Public',
	rule_combinator: 'Any (OR)',
	enabled: 1,
	stale: 0,
})

async function switchTo(combinator: string) {
	const list = useMappingList({ entity: 'workspace' })
	res('list_workspaces').data = [mappedWorkspace()]
	await nextTick()
	const row = list.rows.value[0]
	list
		.combinatorMenu(row)
		.find((o) => o.label === combinator)!
		.onClick()
	await flushPromises()
	return list
}

beforeEach(() => {
	h.resources = []
	h.toast.success.mockReset()
	h.toast.error.mockReset()
})

describe('useMappingList: combinator confirm gate', () => {
	it('confirms an All (AND) → Any (OR) switch that only adds members', async () => {
		const list = await switchTo('All (AND)')

		res('compute_rule_diff')._config.onSuccess({
			added: 3,
			removed: 0,
			removed_users: [],
		})
		await flushPromises()

		expect(list.combinatorConfirmOpen.value).toBe(true)
		expect(list.combinatorDiff.value?.added).toBe(3)
		expect(res('set_workspace_combinator').submit).not.toHaveBeenCalled()
	})

	it('confirms a switch that only removes members, below the old ≥25 threshold', async () => {
		const list = await switchTo('All (AND)')

		res('compute_rule_diff')._config.onSuccess({
			added: 0,
			removed: 2,
			removed_users: [],
		})
		await flushPromises()

		expect(list.combinatorConfirmOpen.value).toBe(true)
		expect(list.combinatorDiff.value?.removed).toBe(2)
		expect(res('set_workspace_combinator').submit).not.toHaveBeenCalled()
	})

	it('applies a switch that moves nobody without asking', async () => {
		const list = await switchTo('All (AND)')

		res('compute_rule_diff')._config.onSuccess({
			added: 0,
			removed: 0,
			removed_users: [],
		})
		await flushPromises()

		expect(list.combinatorConfirmOpen.value).toBe(false)
		expect(res('set_workspace_combinator').submit).toHaveBeenCalledWith({
			name: 'RWM-1',
			combinator: 'All (AND)',
		})
	})

	it('confirming performs the switch', async () => {
		const list = await switchTo('All (AND)')
		res('compute_rule_diff')._config.onSuccess({
			added: 1,
			removed: 1,
			removed_users: [],
		})
		await flushPromises()

		list.confirmCombinator()

		expect(res('set_workspace_combinator').submit).toHaveBeenCalledWith({
			name: 'RWM-1',
			combinator: 'All (AND)',
		})
		expect(list.combinatorConfirmOpen.value).toBe(false)
	})

	it('cancelling writes nothing and reloads the list', async () => {
		const list = await switchTo('All (AND)')
		res('compute_rule_diff')._config.onSuccess({
			added: 4,
			removed: 0,
			removed_users: [],
		})
		await flushPromises()

		list.cancelCombinator()

		expect(list.combinatorConfirmOpen.value).toBe(false)
		expect(res('set_workspace_combinator').submit).not.toHaveBeenCalled()
		expect(res('list_workspaces').reload).toHaveBeenCalled()
	})
})

describe('MassRemovalConfirmDialog: direction-aware copy', () => {
	const dialog = (props: Record<string, unknown>) =>
		mount(MassRemovalConfirmDialog, {
			props: { open: true, targetLabel: 'Design HQ', ...props },
			global: { config: { globalProperties: { __: (s: string) => s } } },
		})

	it('names both directions when the switch adds and removes', () => {
		const wrapper = dialog({ addedCount: 4, removedCount: 7 })
		const message = wrapper.get('[data-testid="message"]').text()

		expect(message).toContain('4')
		expect(message).toContain('7')
		expect(message).toMatch(/add/i)
		expect(message).toMatch(/remove/i)
		expect(wrapper.get('[data-testid="title"]').text()).toMatch(/member/i)
	})

	it('talks only about adding when nobody is removed', () => {
		const message = dialog({ addedCount: 4, removedCount: 0 })
			.get('[data-testid="message"]')
			.text()

		expect(message).toMatch(/add/i)
		expect(message).not.toMatch(/remove/i)
	})

	it('keeps the removal-only copy for the rule-edit caller, which passes no addedCount', () => {
		const wrapper = dialog({ removedCount: 31 })

		expect(wrapper.get('[data-testid="message"]').text()).toBe(
			'This will remove 31 members from Design HQ. This cannot be undone.'
		)
		expect(wrapper.get('[data-testid="title"]').text()).toBe('Remove members?')
	})

	it('emits confirm and closes when the confirming action is clicked', async () => {
		const wrapper = dialog({ addedCount: 4, removedCount: 7 })

		await wrapper.get('[data-testid="action-red"]').trigger('click')

		expect(wrapper.emitted('confirm')).toHaveLength(1)
		expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
	})
})
