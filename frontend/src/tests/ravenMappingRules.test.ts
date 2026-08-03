/**
 * MappingRules.vue v2: persisting the first rule on an UNMAPPED workspace adopts it
 * via the injected ensureMapped, then writes the rule, skipping the mass-removal diff.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import MappingRules from '@/components/Settings/Raven/MappingRules.vue'

const h = vi.hoisted(() => ({
	resources: [] as any[],
	detailData: null as any,
	toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('frappe-ui', () => ({
	toast: h.toast,
	createResource: (config: any) => {
		const url = String(config.url)
		const res: any = reactive({
			url,
			config,
			data: null,
			loading: false,
			error: null,
		})
		res.reset = vi.fn(() => {
			res.data = null
		})
		res.reload = vi.fn()
		res.submit = vi.fn(async (payload: any) => {
			res.lastPayload = payload
			res.submitCount = (res.submitCount ?? 0) + 1
			if (url.includes('.get_')) {
				res.data = h.detailData
				config.onSuccess?.(h.detailData)
				return h.detailData
			}
			return undefined
		})
		h.resources.push(res)
		return res
	},
}))

vi.mock('@/components/Settings/Raven/RulesPanel.vue', () => ({
	default: {
		name: 'RulesPanel',
		props: [
			'title',
			'description',
			'subtitle',
			'rules',
			'noActiveRulesMessage',
		],
		emits: ['persist', 'set-status'],
		template: `<div data-testid="rules-panel" />`,
	},
}))
vi.mock('@/components/Settings/Raven/MassRemovalConfirmDialog.vue', () => ({
	default: {
		name: 'MassRemovalConfirmDialog',
		props: ['open', 'removedCount', 'targetLabel'],
		emits: ['confirm', 'cancel'],
		template: `<div />`,
	},
}))

vi.stubGlobal('__', (s: string) => s)
// `String.prototype.format` is a frappe global used in the panel's title copy.
String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_m: string, i: number) => String(args[i]))
}

const res = (fragment: string) =>
	h.resources.find((r) => r.url.includes(fragment))

const A_RULE = [
	{
		rule_type: 'All Enrolled Students',
		status: 'Active',
		payment_filter: 'Any',
	},
]

const unmappedWorkspaceRow = () => ({
	name: null,
	key: 'WS-RAW',
	mapped: false,
	ravenId: 'WS-RAW',
	label: 'Design HQ',
	type: 'Public',
	rule_combinator: null,
	paused: false,
	stale: false,
	record: {},
})
const mappedWorkspaceRow = () => ({
	name: 'RWM-1',
	key: 'WS-1',
	mapped: true,
	ravenId: 'WS-1',
	label: 'Managed',
	type: 'Public',
	rule_combinator: 'Any (OR)',
	paused: false,
	stale: false,
	record: {},
})

const emitPersist = async (w: any, rules: unknown[]) => {
	w.findComponent({ name: 'RulesPanel' }).vm.$emit('persist', rules)
	await flushPromises()
}

const mountRules = (props: Record<string, unknown>) =>
	mount(MappingRules, {
		props,
		global: { mocks: { __: (s: string) => s } },
	})

beforeEach(() => {
	h.resources = []
	h.detailData = null
	h.toast.success.mockReset()
	h.toast.error.mockReset()
})

describe('MappingRules: unmapped workspace adopts on first rule', () => {
	const adoptAndPersist = async (mappingName = 'RWM-new') => {
		const ensureMapped = vi.fn(async () => mappingName)
		const row = unmappedWorkspaceRow()
		const w = mountRules({ entity: 'workspace', row, ensureMapped })
		await flushPromises()
		await emitPersist(w, A_RULE)
		return { w, row, ensureMapped }
	}

	it('links the workspace, then writes the rule against the new mapping', async () => {
		const ensureMapped = vi.fn(async () => 'RWM-new')
		const row = unmappedWorkspaceRow()
		const w = mountRules({ entity: 'workspace', row, ensureMapped })
		await flushPromises()

		// Unmapped → no detail fetch on mount.
		expect(res('.get_workspace').submit).not.toHaveBeenCalled()

		await emitPersist(w, A_RULE)

		expect(ensureMapped).toHaveBeenCalledWith(row)
		// Nothing is written until the diff says who this would drop.
		expect(res('.update_workspace').submit).not.toHaveBeenCalled()

		res('.compute_rule_diff').config.onSuccess({
			added: 1,
			removed: 0,
			removed_users: [],
		})
		await flushPromises()

		const update = res('.update_workspace')
		expect(update.submit).toHaveBeenCalledTimes(1)
		expect(update.lastPayload).toMatchObject({
			name: 'RWM-new',
			combinator: 'Any (OR)',
			label: 'Design HQ',
			type: 'Public',
		})
		expect(update.lastPayload.rules).toHaveLength(1)
		expect(update.lastPayload.rules[0]).toMatchObject({
			provider: 'LMS',
			rule_type: 'All Enrolled Students',
			status: 'Active',
		})
	})

	// ensureMapped can RECOVER a mapping another admin already created (link_*
	// hits a DuplicateEntryError and resolves the existing docname). That mapping
	// has rules and members, and update_* replaces the whole list. The adopt
	// path has to be previewed like any other membership change.
	it('previews the adopted mapping before replacing its rules', async () => {
		await adoptAndPersist('RWM-existing')

		const diff = res('.compute_rule_diff')
		expect(diff.submit).toHaveBeenCalledTimes(1)
		expect(diff.lastPayload).toMatchObject({
			target_doctype: 'Raven Workspace Mapping',
			name: 'RWM-existing',
		})
		expect(diff.lastPayload.rules).toBeUndefined()
		expect(diff.lastPayload.new_rules).toHaveLength(1)
	})

	it('holds a mass removal on the adopted mapping behind the confirmation', async () => {
		const { w } = await adoptAndPersist('RWM-existing')

		res('.compute_rule_diff').config.onSuccess({
			added: 0,
			removed: 118,
			removed_users: [],
		})
		await flushPromises()

		const dialog = w.findComponent({ name: 'MassRemovalConfirmDialog' })
		expect(dialog.props('open')).toBe(true)
		expect(dialog.props('removedCount')).toBe(118)
		expect(res('.update_workspace').submit).not.toHaveBeenCalled()

		dialog.vm.$emit('confirm')
		await flushPromises()
		expect(res('.update_workspace').lastPayload).toMatchObject({
			name: 'RWM-existing',
			label: 'Design HQ',
		})
	})

	it('writes nothing when the mass removal on an adopted mapping is cancelled', async () => {
		const { w } = await adoptAndPersist('RWM-existing')

		res('.compute_rule_diff').config.onSuccess({
			added: 0,
			removed: 118,
			removed_users: [],
		})
		await flushPromises()

		w.findComponent({ name: 'MassRemovalConfirmDialog' }).vm.$emit('cancel')
		await flushPromises()

		expect(res('.update_workspace').submit).not.toHaveBeenCalled()
	})

	it('drops the pending rules when the adopted mapping cannot be previewed', async () => {
		const { w } = await adoptAndPersist('RWM-existing')

		res('.compute_rule_diff').config.onError({ messages: ['nope'] })
		await flushPromises()

		expect(h.toast.error).toHaveBeenCalledWith('nope')
		w.findComponent({ name: 'MassRemovalConfirmDialog' }).vm.$emit('confirm')
		await flushPromises()
		expect(res('.update_workspace').submit).not.toHaveBeenCalled()
	})
})

describe('MappingRules: a status change bypasses the rule save', () => {
	const mountMapped = async () => {
		h.detailData = {
			name: 'RWM-1',
			member_rules: [],
			member_count: 3,
			workspace_label: 'Managed',
			workspace_type: 'Public',
			rule_combinator: 'Any (OR)',
		}
		const w = mountRules({
			entity: 'workspace',
			row: mappedWorkspaceRow(),
			ensureMapped: vi.fn(async () => 'RWM-1'),
		})
		await flushPromises()
		return w
	}

	it('writes the one field and reloads, never replacing the rule list', async () => {
		const w = await mountMapped()
		const detailCalls = res('.get_workspace').submit.mock.calls.length

		w.findComponent({ name: 'RulesPanel' }).vm.$emit(
			'set-status',
			'RMR-1',
			'Active'
		)
		await flushPromises()

		const setStatus = res('.set_workspace_rule_status')
		expect(setStatus.lastPayload).toEqual({
			name: 'RWM-1',
			rule: 'RMR-1',
			status: 'Active',
		})
		expect(res('.update_workspace').submit).not.toHaveBeenCalled()
		expect(res('.compute_rule_diff').submit).not.toHaveBeenCalled()

		setStatus.config.onSuccess()
		await flushPromises()
		expect(res('.get_workspace').submit.mock.calls.length).toBe(detailCalls + 1)
	})

	it('surfaces a rejected status change', async () => {
		await mountMapped()

		res('.set_workspace_rule_status').config.onError({
			messages: ['Rule does not belong to this mapping'],
		})

		expect(h.toast.error).toHaveBeenCalledWith(
			'Rule does not belong to this mapping'
		)
	})
})

describe('MappingRules: combinator switch refreshes the member count', () => {
	const detailFor = (combinator: string, count: number) => ({
		name: 'RWM-1',
		member_rules: [],
		member_count: count,
		workspace_label: 'Managed',
		workspace_type: 'Public',
		rule_combinator: combinator,
	})

	// The combinator dropdown lives in the sibling list composable; switching it
	// reloads the list, which re-derives this row's `rule_combinator`, but the
	// member_count badge comes from the detail resource, which must refetch too.
	it('refetches the detail when the row combinator changes under a loaded detail', async () => {
		h.detailData = detailFor('Any (OR)', 3)
		const w = mountRules({
			entity: 'workspace',
			row: mappedWorkspaceRow(),
			ensureMapped: vi.fn(async () => 'RWM-1'),
		})
		await flushPromises()

		const before = res('.get_workspace').submit.mock.calls.length

		// The list reload flips the row's combinator; the docname (name) is unchanged.
		h.detailData = detailFor('All (AND)', 1)
		await w.setProps({
			row: { ...mappedWorkspaceRow(), rule_combinator: 'All (AND)' },
		})
		await flushPromises()

		const panel = w.findComponent({ name: 'RulesPanel' })
		expect(res('.get_workspace').submit.mock.calls.length).toBe(before + 1)
		expect(panel.props('subtitle')).toBe('1 members')
	})

	// A row switch already reloads through the `name` watcher. The combinator
	// watcher must not fire a second, redundant fetch for the newly-selected row.
	it('does not double-fetch when selecting a different row', async () => {
		h.detailData = detailFor('Any (OR)', 3)
		const w = mountRules({
			entity: 'workspace',
			row: mappedWorkspaceRow(),
			ensureMapped: vi.fn(async () => 'RWM-1'),
		})
		await flushPromises()
		const before = res('.get_workspace').submit.mock.calls.length

		// Different docname AND a different combinator arrive together.
		h.detailData = { ...detailFor('All (AND)', 5), name: 'RWM-2' }
		await w.setProps({
			row: {
				...mappedWorkspaceRow(),
				name: 'RWM-2',
				key: 'WS-2',
				rule_combinator: 'All (AND)',
			},
		})
		await flushPromises()

		expect(res('.get_workspace').submit.mock.calls.length).toBe(before + 1)
	})
})

describe('MappingRules: mapped row keeps the diff flow', () => {
	it('fetches detail on mount and routes rule changes through compute_rule_diff', async () => {
		h.detailData = {
			name: 'RWM-1',
			member_rules: [],
			member_count: 3,
			workspace_label: 'Managed',
			workspace_type: 'Public',
			rule_combinator: 'Any (OR)',
		}
		const ensureMapped = vi.fn(async () => 'RWM-1')
		const w = mountRules({
			entity: 'workspace',
			row: mappedWorkspaceRow(),
			ensureMapped,
		})
		await flushPromises()

		// Mapped → detail is fetched immediately.
		expect(res('.get_workspace').submit).toHaveBeenCalledWith({ name: 'RWM-1' })

		await emitPersist(w, A_RULE)

		// A membership change on a mapped row previews the diff and never adopts.
		expect(ensureMapped).not.toHaveBeenCalled()
		expect(res('.compute_rule_diff').submit).toHaveBeenCalledTimes(1)
		expect(res('.compute_rule_diff').lastPayload).toMatchObject({
			target_doctype: 'Raven Workspace Mapping',
			name: 'RWM-1',
		})
	})

	// `update_workspace` replaces the whole rule list, so a rule this app does not own
	// has to come back out of the UI exactly as it went in, provider included.
	it('sends another provider rule back untouched when an LMS rule is saved', async () => {
		const foreign = {
			name: 'RMR-9',
			label: 'Widget owners',
			provider: 'Acme',
			rule_type: 'Widget Owners',
			status: 'Active',
			config: { widget_tier: 'gold' },
		}
		h.detailData = {
			name: 'RWM-1',
			member_rules: [
				{
					name: 'RMR-1',
					label: 'Old name',
					provider: 'LMS',
					rule_type: 'All Enrolled Students',
					status: 'Active',
					config: { payment_filter: 'Any' },
				},
				foreign,
			],
			member_count: 3,
			workspace_label: 'Managed',
			workspace_type: 'Public',
			rule_combinator: 'Any (OR)',
		}
		const w = mountRules({
			entity: 'workspace',
			row: mappedWorkspaceRow(),
			ensureMapped: vi.fn(async () => 'RWM-1'),
		})
		await flushPromises()

		// The panel hands back what it was given, with one LMS rule renamed.
		const panel = w.findComponent({ name: 'RulesPanel' })
		const current = panel.props('rules') as Record<string, unknown>[]
		await emitPersist(w, [{ ...current[0], label: 'New name' }, current[1]])

		const sent = res('.update_workspace').lastPayload.rules
		expect(sent[0]).toMatchObject({ provider: 'LMS', label: 'New name' })
		expect(sent[1]).toEqual(foreign)
	})

	it('saves a renamed rule straight through, skipping the diff round-trip', async () => {
		h.detailData = {
			name: 'RWM-1',
			member_rules: [
				{
					name: 'RMR-1',
					label: 'Old name',
					provider: 'LMS',
					rule_type: 'All Enrolled Students',
					status: 'Active',
					config: { payment_filter: 'Any' },
				},
			],
			member_count: 3,
			workspace_label: 'Managed',
			workspace_type: 'Public',
			rule_combinator: 'Any (OR)',
		}
		const w = mountRules({
			entity: 'workspace',
			row: mappedWorkspaceRow(),
			ensureMapped: vi.fn(async () => 'RWM-1'),
		})
		await flushPromises()

		await emitPersist(w, [
			{
				name: 'RMR-1',
				label: 'New name',
				rule_type: 'All Enrolled Students',
				status: 'Active',
				payment_filter: 'Any',
			},
		])

		// A rename moves nobody, so re-evaluating every rule against the user base
		// would be pure cost.
		expect(res('.compute_rule_diff').submit).not.toHaveBeenCalled()
		const update = res('.update_workspace')
		expect(update.submit).toHaveBeenCalledTimes(1)
		expect(update.lastPayload.rules[0]).toMatchObject({ label: 'New name' })
	})
})

describe('MappingRules: removing a rule confirms any member drop', () => {
	const withOneActiveRule = () => ({
		name: 'RWM-1',
		member_rules: [
			{
				name: 'RMR-1',
				label: 'All enrolled',
				provider: 'LMS',
				rule_type: 'All Enrolled Students',
				status: 'Active',
				config: { payment_filter: 'Any' },
			},
		],
		member_count: 8,
		workspace_label: 'Managed',
		workspace_type: 'Public',
		rule_combinator: 'Any (OR)',
	})

	const emitRemoval = async (w: any, rules: unknown[]) => {
		w.findComponent({ name: 'RulesPanel' }).vm.$emit('persist', rules, {
			fromRemoval: true,
		})
		await flushPromises()
	}

	it('confirms a below-threshold removal (fromRemoval lowers the bar to one)', async () => {
		h.detailData = withOneActiveRule()
		const w = mountRules({
			entity: 'workspace',
			row: mappedWorkspaceRow(),
			ensureMapped: vi.fn(async () => 'RWM-1'),
		})
		await flushPromises()

		await emitRemoval(w, []) // deleted the only rule
		res('.compute_rule_diff').config.onSuccess({
			added: 0,
			removed: 5, // well under MASS_REMOVAL_THRESHOLD (25)
			removed_users: [],
		})
		await flushPromises()

		const dialog = w.findComponent({ name: 'MassRemovalConfirmDialog' })
		expect(dialog.props('open')).toBe(true)
		expect(dialog.props('removedCount')).toBe(5)
		// Nothing is written until the removal is confirmed.
		expect(res('.update_workspace').submit).not.toHaveBeenCalled()
	})

	it('applies the same small drop silently when it is an edit, not a removal', async () => {
		h.detailData = withOneActiveRule()
		const w = mountRules({
			entity: 'workspace',
			row: mappedWorkspaceRow(),
			ensureMapped: vi.fn(async () => 'RWM-1'),
		})
		await flushPromises()

		// Same 5-member drop, but a plain edit (no fromRemoval) stays under the 25 gate.
		await emitPersist(w, [
			{
				name: 'RMR-1',
				label: 'All enrolled',
				rule_type: 'Students of Courses',
				status: 'Active',
				config: { courses: ['COURSE-1'] },
			},
		])
		res('.compute_rule_diff').config.onSuccess({
			added: 0,
			removed: 5,
			removed_users: [],
		})
		await flushPromises()

		expect(
			w.findComponent({ name: 'MassRemovalConfirmDialog' }).props('open')
		).toBe(false)
		expect(res('.update_workspace').submit).toHaveBeenCalledTimes(1)
	})
})
