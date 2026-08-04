/**
 * "Adopt on edit" in useMappingList.ts: editing an unmanaged WORKSPACE adopts it
 * first (link_workspace) then edits; CHANNELS only adopt via linkRow's Link button.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import { useMappingList } from '@/composables/raven/useMappingList'

const h = vi.hoisted(() => ({
	resources: [] as any[],
	linkResult: null as string | null,
	linkError: null as any,
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
			if (url.includes('.link_')) {
				res.error = h.linkError
				if (h.linkError) {
					config.onError?.(h.linkError)
					return null
				}
				return h.linkResult
			}
			// create_* resolves with a name the composable consumes via onSuccess.
			return undefined
		})
		res._config = config
		h.resources.push(res)
		return res
	},
}))

vi.stubGlobal('__', (s: string) => s)

const res = (fragment: string) =>
	h.resources.find((r) => r.url.includes(fragment))

const unmappedWorkspace = () => ({
	name: null,
	mapped: false,
	raven_workspace: 'WS-RAW',
	workspace_label: 'Design HQ',
	workspace_type: 'Public',
	rule_combinator: null,
	enabled: 1,
	stale: 0,
})
const mappedWorkspace = () => ({
	name: 'RWM-1',
	mapped: true,
	raven_workspace: 'WS-1',
	workspace_label: 'Managed',
	workspace_type: 'Public',
	rule_combinator: 'Any (OR)',
	enabled: 1,
	stale: 0,
})
const unmappedChannel = () => ({
	name: null,
	mapped: false,
	raven_channel: 'CH-RAW',
	channel_label: 'general',
	workspace: 'RWM-parent',
	channel_type: 'Public',
	rule_combinator: null,
	enabled: 1,
	stale: 0,
})

async function workspaceList(records: any[]) {
	const list = useMappingList({ entity: 'workspace' })
	res('list_workspaces').data = records
	await nextTick()
	return list
}

beforeEach(() => {
	h.resources = []
	h.linkResult = null
	h.linkError = null
	h.toast.success.mockReset()
	h.toast.error.mockReset()
})

describe('useMappingList: workspace adopt on edit', () => {
	it('exposes adoptOnEdit true for workspaces', () => {
		const list = useMappingList({ entity: 'workspace' })
		expect(list.adoptOnEdit).toBe(true)
	})

	it('toggling an unmapped workspace links it, then targets the new mapping', async () => {
		const list = await workspaceList([unmappedWorkspace()])
		const row = list.rows.value[0]
		expect(row.mapped).toBe(false)
		expect(row.name).toBeNull()
		expect(row.key).toBe('WS-RAW') // stable key = raven id

		h.linkResult = 'RWM-Design HQ'
		list.toggleEnabled(row, false)
		await flushPromises()

		expect(res('.link_workspace').submit).toHaveBeenCalledWith({
			raven_workspace: 'WS-RAW',
		})
		expect(res('set_workspace_enabled').submit).toHaveBeenCalledWith({
			name: 'RWM-Design HQ',
			enabled: false,
		})
	})

	it('changing an unmapped workspace combinator adopts first, then previews the switch', async () => {
		const list = await workspaceList([unmappedWorkspace()])
		const row = list.rows.value[0]

		h.linkResult = 'RWM-Design HQ'
		const allAnd = list
			.combinatorMenu(row)
			.find((o) => o.label === 'All (AND)')!
		allAnd.onClick()
		await flushPromises()

		expect(res('.link_workspace').submit).toHaveBeenCalledWith({
			raven_workspace: 'WS-RAW',
		})
		// Union → intersection can evict most of the membership, so the switch is
		// previewed against the adopted mapping before anything is written.
		expect(res('compute_rule_diff').submit).toHaveBeenCalledWith({
			target_doctype: 'Raven Workspace Mapping',
			name: 'RWM-Design HQ',
			combinator: 'All (AND)',
		})
		expect(res('set_workspace_combinator').submit).not.toHaveBeenCalled()
	})

	it('applies the combinator once a diff that moves nobody comes back', async () => {
		const list = await workspaceList([unmappedWorkspace()])
		const row = list.rows.value[0]

		h.linkResult = 'RWM-Design HQ'
		list
			.combinatorMenu(row)
			.find((o) => o.label === 'All (AND)')!
			.onClick()
		await flushPromises()

		res('compute_rule_diff')._config.onSuccess({
			added: 0,
			removed: 0,
			removed_users: [],
		})
		await flushPromises()

		expect(res('set_workspace_combinator').submit).toHaveBeenCalledWith({
			name: 'RWM-Design HQ',
			combinator: 'All (AND)',
		})
		expect(list.combinatorConfirmOpen.value).toBe(false)
	})

	it('holds the switch behind a confirmation when it would drop many members', async () => {
		const list = await workspaceList([unmappedWorkspace()])
		const row = list.rows.value[0]

		h.linkResult = 'RWM-Design HQ'
		list
			.combinatorMenu(row)
			.find((o) => o.label === 'All (AND)')!
			.onClick()
		await flushPromises()

		res('compute_rule_diff')._config.onSuccess({
			added: 0,
			removed: 516,
			removed_users: [],
		})
		await flushPromises()

		expect(list.combinatorConfirmOpen.value).toBe(true)
		expect(list.combinatorDiff.value?.removed).toBe(516)
		expect(res('set_workspace_combinator').submit).not.toHaveBeenCalled()

		list.confirmCombinator()
		expect(res('set_workspace_combinator').submit).toHaveBeenCalledWith({
			name: 'RWM-Design HQ',
			combinator: 'All (AND)',
		})
	})

	it('cancelling the confirmation writes nothing', async () => {
		const list = await workspaceList([unmappedWorkspace()])
		const row = list.rows.value[0]

		h.linkResult = 'RWM-Design HQ'
		list
			.combinatorMenu(row)
			.find((o) => o.label === 'All (AND)')!
			.onClick()
		await flushPromises()
		res('compute_rule_diff')._config.onSuccess({
			added: 0,
			removed: 516,
			removed_users: [],
		})
		await flushPromises()

		list.cancelCombinator()
		expect(list.combinatorConfirmOpen.value).toBe(false)
		expect(res('set_workspace_combinator').submit).not.toHaveBeenCalled()
	})

	it('flips the row to mapped in place after adopting', async () => {
		const list = await workspaceList([unmappedWorkspace()])
		const row = list.rows.value[0]
		h.linkResult = 'RWM-Design HQ'

		const name = await list.ensureMapped(row)
		await nextTick()

		expect(name).toBe('RWM-Design HQ')
		const updated = list.rows.value[0]
		expect(updated.mapped).toBe(true)
		expect(updated.name).toBe('RWM-Design HQ')
		expect(updated.key).toBe('WS-RAW') // key unchanged → selection survives
	})

	it('does NOT link a workspace that is already mapped', async () => {
		const list = await workspaceList([mappedWorkspace()])
		const row = list.rows.value[0]

		list.toggleEnabled(row, false)
		await flushPromises()

		expect(res('.link_workspace').submit).not.toHaveBeenCalled()
		expect(res('set_workspace_enabled').submit).toHaveBeenCalledWith({
			name: 'RWM-1',
			enabled: false,
		})
	})

	it('ensureMapped is a no-op returning the name for a mapped row', async () => {
		const list = await workspaceList([mappedWorkspace()])
		const name = await list.ensureMapped(list.rows.value[0])
		expect(name).toBe('RWM-1')
		expect(res('.link_workspace').submit).not.toHaveBeenCalled()
	})
})

describe('useMappingList: channel Link (no adopt on edit)', () => {
	async function channelList(records: any[]) {
		const list = useMappingList({ entity: 'channel', workspace: 'RWM-parent' })
		res('list_channels').data = records
		await nextTick()
		return list
	}

	it('exposes adoptOnEdit false for channels', () => {
		const list = useMappingList({ entity: 'channel', workspace: 'RWM-parent' })
		expect(list.adoptOnEdit).toBe(false)
	})

	it('linkRow adopts an unmapped channel via link_channel and reloads', async () => {
		const list = await channelList([unmappedChannel()])
		const row = list.rows.value[0]
		expect(row.mapped).toBe(false)

		h.linkResult = 'RCM-general'
		await list.linkRow(row)

		expect(res('.link_channel').submit).toHaveBeenCalledWith({
			workspace: 'RWM-parent',
			raven_channel: 'CH-RAW',
		})
		expect(res('list_channels').reload).toHaveBeenCalled()
		expect(list.linkingKey.value).toBeNull() // in-flight flag cleared
	})
})

describe('useMappingList: ensureMapped duplicate race', () => {
	it('recovers from a DuplicateEntryError by resolving the existing mapping', async () => {
		const list = await workspaceList([unmappedWorkspace()])
		const row = list.rows.value[0]

		// The link races and loses: the row was already adopted elsewhere.
		h.linkError = { exc_type: 'DuplicateEntryError' }
		h.linkResult = null
		const listRes = res('list_workspaces')
		listRes.reload = vi.fn(async () => {
			listRes.data = [
				{
					name: 'RWM-existing',
					mapped: true,
					raven_workspace: 'WS-RAW',
					workspace_label: 'Design HQ',
					workspace_type: 'Public',
					rule_combinator: 'Any (OR)',
					enabled: 1,
					stale: 0,
				},
			]
			return listRes.data
		})

		const name = await list.ensureMapped(row)

		expect(name).toBe('RWM-existing')
		expect(listRes.reload).toHaveBeenCalled()
		// A duplicate race is benign: no error toast.
		expect(h.toast.error).not.toHaveBeenCalled()
	})
})
