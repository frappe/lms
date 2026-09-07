/**
 * Settings > Raven, mounted for real.
 *
 * Only `createResource` and `toast` are replaced. Every component in these trees
 * is the one that ships: SettingsList, SettingsTable, the framework's
 * ConditionBuilder, and frappe-ui's own Select, Switch, Combobox and Dropdown. A
 * stubbed table would have to restate the cell markup the panels never write, and
 * a stubbed Switch cannot say whether the control ends up with an accessible
 * name, which is half of what this file is here to hold.
 *
 * Popovers are the one thing that is driven at the component rather than through
 * the DOM: reka opens its listbox on real pointer geometry, which jsdom does not
 * have. The value emitted is still the value the real control emits, and every
 * handler it reaches is the app's own.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { SETTINGS_PAGE_LENGTH } from '@/composables/useSettingsListResource'
import type { RavenMemberRule, WorkspaceMember } from '@/types'

const SETUP = 'lms.raven_provider.get_raven_setup'
const ENABLE = 'raven_integration.api.enable_integration'
const LIST_WORKSPACES = 'raven_integration.api.list_workspaces'
const LIST_CHANNELS = 'raven_integration.api.list_channels'
const GET_WORKSPACE = 'raven_integration.api.get_workspace'
const GET_CHANNEL = 'raven_integration.api.get_channel'
const PROVIDERS = 'raven_integration.api.list_providers'
const CREATE_WORKSPACE = 'raven_integration.api.create_workspace'
const CREATE_CHANNEL = 'raven_integration.api.create_channel'
const LINK_WORKSPACE = 'raven_integration.api.link_workspace'
const SET_CHANNEL_ENABLED = 'raven_integration.api.set_channel_enabled'
const LIST_MEMBERS = 'raven_integration.api.list_workspace_members'

/** The one seam: what each endpoint answers, and what was asked of it. */
const server = vi.hoisted(() => ({
	data: {} as Record<string, unknown>,
	errors: {} as Record<string, unknown>,
	calls: [] as { url: string; params?: unknown }[],
}))

vi.mock('frappe-ui', async () => {
	const actual = (await vi.importActual('frappe-ui')) as Record<string, unknown>
	return new Proxy(actual, {
		get(target, key: string) {
			if (key === 'createResource')
				return (options: {
					url: string
					auto?: boolean
					onSuccess?: (data: unknown) => void
					onError?: (err: unknown) => void
				}) => {
					const resource = {
						url: options.url,
						data: null as unknown,
						loading: false,
						error: null as unknown,
						update(next: Record<string, unknown>) {
							Object.assign(options, next)
						},
						fetch(params?: unknown) {
							server.calls.push({ url: options.url, params })
							if (options.url in server.errors) {
								resource.error = server.errors[options.url]
								options.onError?.(server.errors[options.url])
								return Promise.resolve(undefined)
							}
							// Only a seeded endpoint answers. Left unseeded it is a fetch
							// that never lands, which is a state these pages have to render.
							if (options.url in server.data) {
								resource.data = server.data[options.url]
								options.onSuccess?.(resource.data)
							}
							return Promise.resolve(resource.data)
						},
						submit(params?: unknown) {
							return resource.fetch(params)
						},
						reload: () => resource.fetch(),
						reset() {
							resource.data = null
						},
					}
					if (options.auto) resource.fetch()
					return resource
				}
			if (key === 'toast') return { error: () => {}, success: () => {} }
			return (target as Record<string, unknown>)[key]
		},
	})
})

// Swapped by the one test that translates for real, so every mount reads the
// translator that is current rather than the one captured at import time.
let translate = (text: string, args?: unknown[]): string =>
	args
		? text.replace(/\{(\d+)\}/g, (_m, index) =>
				String(args[Number(index)] ?? '')
		  )
		: text

const __t = (text: string, args?: unknown[]): string => translate(text, args)

vi.stubGlobal('__', __t)

// frappe patches String.prototype.format, which `__('{0}').format(x)` relies on.
;(String.prototype as unknown as { format?: unknown }).format ??= function (
	...args: string[]
) {
	return args.reduce((out, arg, i) => out.replace(`{${i}}`, arg), String(this))
}

const mountOptions = { global: { mocks: { __: __t } } }

import RavenSettings from '@/components/Settings/Raven/RavenSettings.vue'
import RuleCondition from '@/components/Settings/Raven/RuleCondition.vue'
import ChannelView from '@/components/Settings/Raven/ChannelView.vue'
import WorkspaceView from '@/components/Settings/Raven/WorkspaceView.vue'
import WorkspaceList from '@/components/Settings/Raven/WorkspaceList.vue'
import WorkspaceChannels from '@/components/Settings/Raven/WorkspaceChannels.vue'
import WorkspaceMembers from '@/components/Settings/Raven/WorkspaceMembers.vue'
import MassRemovalConfirmDialog from '@/components/Settings/Raven/MassRemovalConfirmDialog.vue'

/**
 * Trimmed from `lms/raven_provider.py`: the two cascading types, each with a
 * `reqd` Select deciding what appears below it. The shape is the point, so a
 * declaration that could not exist would prove nothing about the row.
 */
const DECLARATIONS = [
	{
		name: 'LMS',
		label: 'Frappe Learning',
		rule_types: [
			{
				type: 'Student',
				label: 'Student',
				fields: [
					{
						fieldname: 'student_scope',
						fieldtype: 'Select',
						label: 'Students',
						options: ['All', 'Enrolled'],
						reqd: 1,
						default: 'Enrolled',
					},
					{
						fieldname: 'payment_filter',
						fieldtype: 'Select',
						label: 'Payment',
						options: ['Any', 'Paid', 'Free'],
						default: 'Any',
						depends_on: { field: 'student_scope', value_in: ['Enrolled'] },
					},
					{
						fieldname: 'enrolled_in',
						fieldtype: 'Select',
						label: 'Enrolled in',
						options: ['Any', 'Courses'],
						default: 'Any',
						depends_on: { field: 'student_scope', value_in: ['Enrolled'] },
					},
					{
						fieldname: 'courses',
						fieldtype: 'MultiSelect',
						label: 'Courses',
						options: 'LMS Course',
						reqd: 1,
						depends_on: { field: 'enrolled_in', value_in: ['Courses'] },
					},
				],
			},
			{
				type: 'Staff',
				label: 'Staff',
				fields: [
					{
						fieldname: 'staff_kind',
						fieldtype: 'Select',
						label: 'Staff',
						options: ['All', 'Platform role', 'Assigned on'],
						reqd: 1,
						default: 'All',
					},
					{
						fieldname: 'platform_roles',
						fieldtype: 'MultiSelectStatic',
						label: 'Roles',
						options: ['Course Creator', 'Evaluator', 'Moderator'],
						reqd: 1,
						depends_on: { field: 'staff_kind', value_in: ['Platform role'] },
					},
					{
						fieldname: 'assigned_scope',
						fieldtype: 'Select',
						label: 'On',
						options: ['Any', 'Courses'],
						default: 'Any',
						depends_on: { field: 'staff_kind', value_in: ['Assigned on'] },
					},
					{
						fieldname: 'staff_scope_courses',
						fieldtype: 'MultiSelect',
						label: 'Courses',
						options: 'LMS Course',
						reqd: 1,
						depends_on: { field: 'assigned_scope', value_in: ['Courses'] },
					},
				],
			},
		],
	},
	{
		name: 'OTHER',
		label: 'Another App',
		rule_types: [{ type: 'Their Rule', label: 'Their Rule', fields: [] }],
	},
]

const workspaceRecord = (over: Record<string, unknown> = {}) => ({
	name: 'RWM-1',
	mapped: 1,
	workspace_label: 'Design HQ',
	workspace_type: 'Private',
	raven_workspace: 'WS-1',
	channel_count: 4,
	stale: 0,
	...over,
})

const channelRecord = (over: Record<string, unknown> = {}) => ({
	name: 'RCM-1',
	mapped: 1,
	channel_label: 'vue-basics',
	channel_type: 'Private',
	raven_channel: 'CH-1',
	workspace: 'RWM-1',
	enabled: 1,
	stale: 0,
	...over,
})

const channelDetail = (over: Record<string, unknown> = {}) => ({
	...channelRecord(),
	member_count: 0,
	member_count_unknown: false,
	rules: { conjunctions: [], conditions: [] },
	...over,
})

const apiRule = (
	rule_type: string,
	config: Record<string, unknown>,
	provider = 'LMS'
) => ({ provider, rule_type, status: 'Active', config })

beforeEach(() => {
	server.data = {
		[SETUP]: { raven: true, raven_integration: true, enabled: true },
		[PROVIDERS]: DECLARATIONS,
		[LIST_WORKSPACES]: [workspaceRecord()],
		[LIST_CHANNELS]: [channelRecord()],
		[GET_WORKSPACE]: workspaceRecord(),
		[GET_CHANNEL]: channelDetail(),
	}
	server.errors = {}
	server.calls = []
})

const asked = (url: string) => server.calls.filter((c) => c.url === url)

const rows = (w: VueWrapper) => w.findAll('[data-slot="list-row"]')

const cells = (row: ReturnType<typeof rows>[number]) =>
	row.findAll('[data-slot="list-cell"]').map((cell) => cell.text())

const buttonNamed = (w: VueWrapper, label: string) =>
	w.findAll('button').find((b) => b.text().trim() === label)

const panel = () =>
	mount(RavenSettings, {
		props: { label: 'Raven', description: 'Sync membership' },
		...mountOptions,
	})

describe('the Raven setup gate', () => {
	it('asks LMS for the setup state, never the app that may be missing', () => {
		// Calling a method of an uninstalled app raises AppNotInstalledError, and
		// frappe-ui dumps the traceback and rethrows before onError runs.
		server.data[SETUP] = {
			raven: false,
			raven_integration: false,
			enabled: false,
		}

		panel()

		expect(server.calls.map((c) => c.url)).toEqual([SETUP])
	})

	it.each([
		{
			app: 'raven_integration',
			state: { raven: true, raven_integration: false },
		},
		{ app: 'Raven', state: { raven: false, raven_integration: true } },
	])(
		'says $app is missing beside the title, panel still standing',
		({ app, state }) => {
			server.data[SETUP] = { ...state, enabled: false }

			const w = panel()

			// Helpdesk's ERPNextIntegrationSettings.vue: a badge on the title and a
			// sentence under the row, and nothing about the row moves.
			expect(w.text()).toContain('Not installed')
			expect(w.text()).toContain('Enable Raven Integration')
			expect(w.text()).toContain(`Install the ${app} app`)
			expect(buttonNamed(w, 'Enable')!.attributes('disabled')).toBeDefined()
		}
	)

	it('comes alive only once both apps are there', async () => {
		server.data[SETUP] = {
			raven: true,
			raven_integration: true,
			enabled: false,
		}

		const w = panel()
		expect(w.text()).not.toContain('Not installed')
		expect(w.text()).not.toContain('to enable this integration')

		await buttonNamed(w, 'Enable')!.trigger('click')

		expect(asked(ENABLE)).toHaveLength(1)
	})

	it('links the app that has a page, and only names the one that has none', () => {
		// raven_integration installs at the bench, so there is nowhere to send
		// anyone; naming it is the whole of the instruction.
		server.data[SETUP] = {
			raven: false,
			raven_integration: true,
			enabled: false,
		}
		const raven = panel()
		expect(raven.get('a').attributes('href')).toContain(
			'marketplace/apps/raven'
		)
		expect(raven.get('a').attributes('target')).toBe('_blank')
		expect(raven.get('a').attributes('rel')).toContain('noopener')

		server.data[SETUP] = {
			raven: true,
			raven_integration: false,
			enabled: false,
		}
		expect(panel().findAll('a')).toHaveLength(0)
	})

	it('translates the install sentence as one unit, not in fragments', () => {
		// Three __() calls could not be reordered by a translator and fixed
		// English's word order into the DOM, which is what an RTL locale undoes.
		// Proven by translating: a locale that swaps the halves comes out swapped.
		server.data[SETUP] = {
			raven: false,
			raven_integration: true,
			enabled: false,
		}
		const seen: string[] = []
		const plain = translate
		translate = (text: string, args?: unknown[]) => {
			seen.push(text)
			return text === 'Install the {0} app to enable this integration.'
				? 'To enable this integration, install the {0} app.'
				: plain(text, args)
		}
		try {
			expect(panel().text()).toContain(
				'To enable this integration, install the Raven app.'
			)
		} finally {
			translate = plain
		}
		expect(seen).not.toContain('Install the')
	})

	it('tells a moderator without the role that there is nothing here to fix', () => {
		// The endpoints are System Manager only, but Settings opens for any
		// moderator. The setup row would tell them to fix what they cannot.
		server.errors[SETUP] = { exc_type: 'PermissionError' }

		const w = panel()

		expect(w.text()).toContain('You need the System Manager role')
		expect(w.text()).not.toContain('Enable Raven Integration')
	})
})

describe('moving between the list, a workspace and a channel', () => {
	const openWorkspace = async (w: VueWrapper) => {
		await rows(w)[0].trigger('click')
		await flushPromises()
	}

	it('opens the workspace page in place of the list', async () => {
		const w = panel()
		expect(w.text()).toContain('Design HQ')

		await openWorkspace(w)

		expect(w.findComponent({ name: 'WorkspaceView' }).exists()).toBe(true)
		expect(w.findComponent({ name: 'WorkspaceList' }).exists()).toBe(false)
	})

	it('leaves a row that is not linked yet where it is', async () => {
		server.data[LIST_WORKSPACES] = [
			workspaceRecord({ name: null, mapped: 0, channel_count: null }),
		]
		const w = panel()

		await openWorkspace(w)

		// There is no mapping behind it, so there is no page to open.
		expect(w.findComponent({ name: 'WorkspaceList' }).exists()).toBe(true)
	})

	it('opens a channel from the workspace, and comes back to the workspace', async () => {
		const w = panel()
		await openWorkspace(w)
		expect(w.text()).toContain('vue-basics')

		await rows(w)[0].trigger('click')
		await flushPromises()
		expect(w.findComponent({ name: 'ChannelView' }).exists()).toBe(true)

		await buttonNamed(w, '# vue-basics')!.trigger('click')
		await flushPromises()

		expect(w.findComponent({ name: 'WorkspaceView' }).exists()).toBe(true)
		expect(w.findComponent({ name: 'ChannelView' }).exists()).toBe(false)
	})

	it('builds the list again on the way back, which is what refetches it', async () => {
		// An edit made on the detail page is not in the list resource fetched
		// before it opened. The three screens are branches of one v-if, so leaving
		// creates the list anew and its resource fetches on creation. Closing used
		// to call reload() on a template ref that was already null.
		const w = panel()
		expect(asked(LIST_WORKSPACES)).toHaveLength(1)

		await openWorkspace(w)
		await buttonNamed(w, 'Design HQ')!.trigger('click')
		await flushPromises()

		expect(w.findComponent({ name: 'WorkspaceList' }).exists()).toBe(true)
		expect(asked(LIST_WORKSPACES)).toHaveLength(2)
	})

	it('opens a New Workspace page, and adopts the docname Create produced', async () => {
		// New used to POST create_workspace, so a mis-click left a live Raven
		// workspace behind, auto-named. Nothing is written until Save is pressed.
		server.data[CREATE_WORKSPACE] = 'RWM-Design HQ'
		const w = panel()

		await buttonNamed(w, 'New')!.trigger('click')
		await flushPromises()
		const view = w.findComponent({ name: 'WorkspaceView' })
		expect(view.props('name')).toBe('')
		expect(w.text()).toContain('New Workspace')
		expect(asked(CREATE_WORKSPACE)).toHaveLength(0)

		await w.get('input[maxlength="140"]').setValue('Design HQ')
		await buttonNamed(w, 'Save')!.trigger('click')
		await flushPromises()

		// The mapping autonames from its label, so the docname only exists once the
		// record does. Holding the old one addresses every later request to a doc
		// that is not there.
		expect(view.props('name')).toBe('RWM-Design HQ')
	})

	it('opens a New Channel page under the workspace, and adopts its docname', async () => {
		server.data[CREATE_CHANNEL] = 'RCM-general'
		const w = panel()
		await openWorkspace(w)

		await buttonNamed(w, 'New')!.trigger('click')
		await flushPromises()
		const channel = w.findComponent({ name: 'ChannelView' })
		// create_channel is given the workspace mapping's docname, and a page with
		// no record of its own has nothing else to read it off. Nothing more: the
		// Raven workspace id used to ride along for a URL this page never builds.
		expect(Object.keys(channel.props()).sort()).toEqual([
			'label',
			'name',
			'workspace',
		])
		expect(channel.props()).toMatchObject({ name: '', workspace: 'RWM-1' })

		await w.get('input[maxlength="140"]').setValue('general')
		await buttonNamed(w, 'Save')!.trigger('click')
		await flushPromises()

		expect(channel.props('name')).toBe('RCM-general')
	})
})

describe('the workspace list', () => {
	const list = () =>
		mount(WorkspaceList, {
			props: { label: 'Raven', description: 'Sync members' },
			...mountOptions,
		})

	const table = (w: VueWrapper) => w.findComponent({ name: 'SettingsTable' })

	const stateFilter = (w: VueWrapper) => w.findComponent({ name: 'Select' })

	// The name span alone: a row that is not syncing carries a status badge in
	// the same cell, which is its own test.
	const labelsShown = (w: VueWrapper) =>
		rows(w).map((row) => row.get('.text-ink-gray-8').text())

	it('reads the name as the row and everything beside it as detail', () => {
		server.data[LIST_WORKSPACES] = [
			workspaceRecord(),
			workspaceRecord({
				name: null,
				mapped: 0,
				workspace_label: 'Raw',
				raven_workspace: 'WS-2',
				channel_count: null,
			}),
		]
		const w = list()

		expect(cells(rows(w)[0])).toEqual(['Design HQ', '4', 'Private', ''])
		// Blank, not 0: an unadopted row manages no channels *here*, which is not
		// the same as a workspace that has none.
		expect(cells(rows(w)[1])[1]).toBe('')
		// The name reads at ink-gray-8, the cells beside it at ink-gray-6.
		expect(rows(w)[0].get('.text-ink-gray-8').text()).toBe('Design HQ')
	})

	it.each([
		{ why: 'Not linked', over: { name: null, mapped: 0 } },
		{ why: 'Stale', over: { stale: 1 } },
		{ why: 'Disabled', over: { paused: true } },
	])('badges a row that is not syncing with $why', ({ why, over }) => {
		// A word rather than a grey step: muting left the state readable by colour
		// alone, and the name still has to read as the name.
		const record = workspaceRecord()
		if ('paused' in over) Object.assign(record, { enabled: 0 })
		else Object.assign(record, over)
		server.data[LIST_WORKSPACES] = [record]

		const w = list()

		expect(rows(w)[0].text()).toContain(why)
		expect(rows(w)[0].get('.text-ink-gray-8').text()).toBe('Design HQ')
	})

	it('says nothing beside a row that is syncing', () => {
		const w = list()
		for (const word of ['Not linked', 'Stale', 'Disabled'])
			expect(rows(w)[0].text()).not.toContain(word)
	})

	it.each([
		{ state: 'active', shown: ['Live'] },
		{ state: 'stale', shown: ['Gone', 'Both'] },
		{ state: 'unlinked', shown: ['Raw', 'Both'] },
		{ state: 'all', shown: ['Live', 'Gone', 'Raw', 'Both'] },
	])('filters the list down to $state rows', async ({ state, shown }) => {
		// Not a partition: a stale mapping can also be unadopted, and picking Stale
		// should still find it, so each state is its own question.
		server.data[LIST_WORKSPACES] = [
			workspaceRecord({ workspace_label: 'Live' }),
			workspaceRecord({
				workspace_label: 'Gone',
				raven_workspace: 'WS-2',
				stale: 1,
			}),
			workspaceRecord({
				name: null,
				mapped: 0,
				workspace_label: 'Raw',
				raven_workspace: 'WS-3',
			}),
			workspaceRecord({
				name: null,
				mapped: 0,
				workspace_label: 'Both',
				raven_workspace: 'WS-4',
				stale: 1,
			}),
		]
		const w = list()

		stateFilter(w).vm.$emit('update:modelValue', state)
		await nextTick()

		expect(labelsShown(w)).toEqual(shown)
	})

	it('offers no Disabled state, because a workspace has no on/off', () => {
		const options = stateFilter(list()).props('options') as {
			value: string
		}[]

		expect(options.map((o) => o.value)).toEqual([
			'all',
			'active',
			'stale',
			'unlinked',
		])
	})

	it('narrows by the search box and the state filter at once', async () => {
		server.data[LIST_WORKSPACES] = [
			workspaceRecord({ workspace_label: 'Design HQ', stale: 1 }),
			workspaceRecord({
				workspace_label: 'Design Ops',
				raven_workspace: 'WS-2',
			}),
			workspaceRecord({
				workspace_label: 'Marketing',
				raven_workspace: 'WS-3',
				stale: 1,
			}),
		]
		const w = list()

		stateFilter(w).vm.$emit('update:modelValue', 'stale')
		w.findComponent({ name: 'SettingsList' }).vm.$emit(
			'update:search',
			'design'
		)
		await nextTick()

		expect(labelsShown(w)).toEqual(['Design HQ'])
	})

	it('reveals a page at a time, and says when there is another', async () => {
		server.data[LIST_WORKSPACES] = Array.from({ length: 20 }, (_, i) =>
			workspaceRecord({
				name: `RWM-${i}`,
				workspace_label: `Workspace ${i}`,
				raven_workspace: `WS-${i}`,
			})
		)
		const w = list()
		expect(rows(w)).toHaveLength(SETTINGS_PAGE_LENGTH)

		await buttonNamed(w, 'Load More')!.trigger('click')

		expect(rows(w)).toHaveLength(20)
		expect(buttonNamed(w, 'Load More')).toBeUndefined()
	})

	it.each([
		{
			kind: 'a linked row',
			over: {},
			options: ['Open in Raven', 'Delete mapping'],
		},
		{
			kind: 'an unlinked row',
			over: { name: null, mapped: 0 },
			options: ['Open in Raven', 'Link'],
		},
		{
			// Its Raven side is gone, so the link would land on Raven's own 404.
			kind: 'a stale row',
			over: { stale: 1 },
			options: ['Recreate workspace', 'Delete mapping'],
		},
	])('offers $kind exactly $options', ({ over, options }) => {
		server.data[LIST_WORKSPACES] = [workspaceRecord(over)]
		const w = list()
		const columns = table(w).props('columns') as {
			key: string
			type: string
			options?: (row: unknown) => { label: string }[]
		}[]
		const actions = columns.find((c) => c.key === 'actions')!
		const row = (table(w).props('rows') as unknown[])[0]

		expect(actions.options!(row).map((o) => o.label)).toEqual(options)
	})

	it('adopts an unlinked workspace through Link', async () => {
		server.data[LIST_WORKSPACES] = [workspaceRecord({ name: null, mapped: 0 })]
		server.data[LINK_WORKSPACE] = 'RWM-1'
		const w = list()
		const columns = table(w).props('columns') as {
			key: string
			options?: (row: unknown) => { label: string; onClick: () => void }[]
		}[]
		const actions = columns.find((c) => c.key === 'actions')!
		const row = (table(w).props('rows') as unknown[])[0]

		actions.options!(row)
			.find((o) => o.label === 'Link')!
			.onClick()
		await flushPromises()

		expect(asked(LINK_WORKSPACE)[0].params).toEqual({ raven_workspace: 'WS-1' })
	})
})

describe("a workspace's Channels tab", () => {
	const tab = (props: Record<string, unknown> = {}) =>
		mount(WorkspaceChannels, {
			props: { workspace: 'RWM-1', ravenWorkspace: 'WS-1', ...props },
			...mountOptions,
		})

	const switches = (w: VueWrapper) => w.findAll('button[role="switch"]')

	it.each([
		{ kind: 'syncing', over: {}, checked: 'true', off: false, why: '' },
		{
			kind: 'switched off',
			over: { enabled: 0 },
			checked: 'false',
			off: false,
			why: 'Disabled',
		},
		{
			// list_channels synthesises `enabled: 1` for a raw Raven channel, which
			// the switch used to draw as on. It syncs nobody, and flipping it would
			// adopt the channel, which is what Link alone is for.
			kind: 'not linked',
			over: { name: null, mapped: 0 },
			checked: 'false',
			off: true,
			why: 'Not linked',
		},
		{
			// Adopted, but the Raven channel is gone: writing enabled would post
			// against a mapping with no target.
			kind: 'stale',
			over: { stale: 1 },
			checked: 'false',
			off: true,
			why: 'Stale',
		},
	])(
		'reads a $kind channel as its own state',
		({ over, checked, off, why }) => {
			server.data[LIST_CHANNELS] = [channelRecord(over)]
			const w = tab()
			const control = switches(w)[0]

			expect(control.attributes('aria-checked')).toBe(checked)
			expect(control.attributes('disabled') !== undefined).toBe(off)
			if (why) expect(rows(w)[0].text()).toContain(why)
		}
	)

	it('names each switch after the row it belongs to', () => {
		// `:aria-label` used to land on a wrapper div, so the control had no name
		// at all. Switch's own `#label` slot is what puts it on the label element
		// the control is associated with, and sr-only keeps the column readable.
		const w = tab()
		const control = switches(w)[0]
		const label = w.get(`label[for="${control.attributes('id')}"]`)

		expect(label.text()).toBe('Sync members of vue-basics')
		expect(label.get('span').classes()).toContain('sr-only')
	})

	it('writes the switch through the mapping endpoint', async () => {
		const w = tab()

		await switches(w)[0].trigger('click')
		await flushPromises()

		expect(asked(SET_CHANNEL_ENABLED)[0].params).toEqual({
			name: 'RCM-1',
			enabled: false,
		})
	})

	it('will not open a New Channel page under an unsaved workspace', async () => {
		// create_channel takes the workspace mapping's docname, and a workspace
		// that has never been saved has none to give.
		const w = tab({ workspace: '', unsaved: true })
		const button = w.get('button[aria-label="New"]')

		await button.trigger('click')

		// `aria-disabled`, not the native attribute: a disabled button leaves the
		// tab order and stops firing the focus event its tooltip opens on, so a
		// keyboard user would find neither the control nor the reason.
		expect(button.attributes('aria-disabled')).toBe('true')
		expect(button.attributes('disabled')).toBeUndefined()
		expect(w.emitted('new')).toBeUndefined()
		expect(w.findComponent({ name: 'Button' }).props('tooltip')).toBe(
			'Save this workspace before adding channels to it.'
		)
	})

	it('says what a channel is for when there are none', () => {
		server.data[LIST_CHANNELS] = []

		expect(tab().text()).toContain(
			'Add one to give this workspace its first members.'
		)
	})
})

/**
 * Workspace membership is derived: a person is a member for as long as they are
 * in one of the workspace's channels. So the tab is read-only, and the channels
 * a row came in through are the row's reason for existing rather than a detail.
 */
describe("a workspace's Members tab", () => {
	const member = (over: Partial<WorkspaceMember> = {}): WorkspaceMember => ({
		user: 'ada@example.com',
		full_name: 'Ada Lovelace',
		user_image: null,
		channels: ['announcements'],
		added_by_rule: true,
		...over,
	})

	const tab = (members: WorkspaceMember[], workspace = 'RWM-1') => {
		server.data[LIST_MEMBERS] = members
		return mount(WorkspaceMembers, { props: { workspace }, ...mountOptions })
	}

	it('reads a member as their name, where they came in, and who put them there', () => {
		const w = tab([
			member({
				user_image: '/files/ada.png',
				channels: ['announcements', 'vue-basics'],
			}),
			member({
				user: 'grace@example.com',
				full_name: 'Grace Hopper',
				added_by_rule: false,
			}),
		])

		expect(rows(w)[0].get('.text-ink-gray-8').text()).toBe('Ada Lovelace')
		expect(rows(w)[0].get('img').attributes('src')).toBe('/files/ada.png')
		// One badge per channel, which is why the cell's text runs them together.
		// A row naming none would be a claim the backend cannot make.
		expect(cells(rows(w)[0])[1]).toBe('# announcements# vue-basics')
		// Whether a rule added someone is the one thing about a member with a
		// consequence: that row goes when the mapping does, a hand-added one stays.
		expect(cells(rows(w)[0])[2]).toBe('Yes')
		expect(cells(rows(w)[1])[2]).toBe('No')
	})

	it('says nobody is in a channel yet, rather than showing an empty table', () => {
		expect(tab([]).text()).toContain(
			'Nobody is in a channel of this workspace yet.'
		)
	})

	it('says the fetch failed rather than that nobody is here', () => {
		// A failed fetch settles with no rows and nothing in flight, the same shape
		// as a workspace whose channels are genuinely empty. Answering it with
		// "nobody is in a channel yet" is a claim about data that never arrived.
		server.errors[LIST_MEMBERS] = { messages: ['Workspace not found'] }

		const w = tab([])

		expect(w.text()).not.toContain('Nobody is in a channel')
		expect(w.text()).toContain('Could not load the members')
		expect(buttonNamed(w, 'Retry')).toBeDefined()
	})

	it('asks for nobody while the workspace has no docname to ask about', () => {
		tab([member()], '')

		expect(asked(LIST_MEMBERS)).toHaveLength(0)
	})
})

describe('a condition row', () => {
	const row = (rule: Partial<RavenMemberRule>, props = {}) =>
		mount(RuleCondition, {
			props: {
				rule: {
					provider: 'LMS',
					rule_type: 'Student',
					status: 'Active',
					...rule,
				} as RavenMemberRule,
				nameId: 'row-name',
				...props,
			},
			...mountOptions,
		})

	const inline = (w: VueWrapper) => w.findAll('[data-testid="inline-field"]')
	// Each cell opens with the sr-only span that names its control.
	const labelled = (w: VueWrapper) =>
		inline(w).map((cell) => cell.get('span').text())
	const blocks = (w: VueWrapper) => w.findAll('[data-testid="block-field"]')
	const selects = (w: VueWrapper) => w.findAllComponents({ name: 'Select' })
	// By the word that names the cell, not by position: a cascade grows a level
	// and every index below it moves. Adding `payment_filter` to the fixture
	// silently retargeted an index-1 edit from `enrolled_in` onto it.
	// The type picker is a Select like the cascade answers now, so it can no longer
	// be told from them by component name, and it is the first Select in the row
	// rather than the first cascade one.
	const typePicker = (w: VueWrapper) =>
		w.get('[data-testid="condition-type"]').getComponent({ name: 'Select' })
	const selectNamed = (w: VueWrapper, label: string) => {
		const cell = inline(w).find((c) => c.get('span').text() === label)
		if (!cell) throw new Error(`no condition cell named ${label}`)
		return cell.getComponent({ name: 'Select' })
	}
	const emittedRule = (w: VueWrapper) =>
		w.emitted('update')![0][0] as RavenMemberRule

	// raven_integration's engine skips a rule stored as Paused (engine.py reads
	// `status === 'Paused'`), and this screen has no control that turns one back
	// on. Stamping every edit Active turned an unrelated edit into a membership
	// change: the paused rule's people were added, and an addition never reaches
	// the removal confirmation, so nothing said so.
	it('leaves a paused rule paused when another of its cells is edited', async () => {
		const w = row({
			status: 'Paused',
			student_scope: 'Enrolled',
			enrolled_in: 'Courses',
			courses: ['C1'],
		})

		await selectNamed(w, 'Enrolled in').vm.$emit('update:modelValue', 'Batches')

		expect(emittedRule(w).status).toBe('Paused')
		expect(emittedRule(w).enrolled_in).toBe('Batches')
	})

	it('leaves a paused rule paused when it is retyped', async () => {
		const w = row({ status: 'Paused', student_scope: 'All' })

		typePicker(w).vm.$emit('update:modelValue', 'Staff')
		await nextTick()

		expect(emittedRule(w).status).toBe('Paused')
		expect(emittedRule(w).rule_type).toBe('Staff')
	})

	it('says a paused row is paused, since nothing else on the screen does', () => {
		const active = row({ student_scope: 'All' })
		expect(active.find('[data-testid="row-status"]').exists()).toBe(false)

		const w = row({ status: 'Paused', student_scope: 'All' })
		expect(w.get('[data-testid="row-status"]').text()).toContain('Paused')
	})

	it('bands the declared fields: selects on one line, multiselects below', () => {
		// Our rules are {provider, rule_type, config}, not a field/operator/value
		// triple, so a cascade has as many selects as it has levels. A multiselect
		// reflows as chips are picked, which is unreadable beside fixed cells.
		const w = row({
			student_scope: 'Enrolled',
			enrolled_in: 'Courses',
			courses: ['C1'],
		})

		expect(labelled(w)).toEqual(['Students', 'Payment', 'Enrolled in'])
		expect(blocks(w)).toHaveLength(1)
		expect(w.findComponent({ name: 'MultiLink' }).exists()).toBe(true)
	})

	it('lays the type picker and the cascade answers out on equal tracks', () => {
		// The type picker used to take flex-1 and grow to whatever was left, which
		// pushed the first cascade answer onto a line of its own: the two controls
		// the user reads as a pair were the two that looked least alike. Equal grid
		// tracks, so no cell's width depends on the label inside it.
		const cells = (w: VueWrapper) => w.get('[data-testid="condition-cells"]')

		expect(cells(row({})).classes()).toContain('grid')
		expect(
			cells(row({}))
				.classes()
				.some((c) => c.startsWith('flex'))
		).toBe(false)
	})

	it('pairs the cascade up once it outgrows one line', () => {
		// Two tracks, or three where the whole cascade fits on one. Four cells is
		// the shape that has to read as two rows of two rather than three and an
		// orphan, which is the case a plain flex-wrap gets wrong.
		const columns = (rule: Partial<RavenMemberRule>) =>
			row(rule).get('[data-testid="condition-cells"]').classes()

		// [type][scope]: the cascade stops at the first answer.
		expect(columns({})).toContain('sm:grid-cols-2')

		// [type][kind][roles]: three, so one line.
		expect(
			columns({ rule_type: 'Staff', staff_kind: 'Platform role' })
		).toContain('sm:grid-cols-3')

		// [type][scope] / [payment][enrolled in]: four, so two rows of two.
		expect(columns({ student_scope: 'Enrolled' })).toContain('sm:grid-cols-2')
	})

	it('names every control against the row rather than with a shared word', () => {
		// Eight rows of "Students" cannot be told apart by voice control or in a
		// rotor listing, so each name starts with the row's own name node.
		const w = row({ student_scope: 'Enrolled', enrolled_in: 'Courses' })

		expect(w.get('#row-name').text()).toContain('Student')
		for (const trigger of w.findAll('[data-testid="inline-field"] button'))
			expect(trigger.attributes('aria-labelledby')).toContain('row-name ')
	})

	it('wraps the controls that drop a name in a group that carries one', () => {
		// MultiLink binds only its own aria attributes, so a name put on it lands on
		// nothing. Select does carry one, which is why the type cell is not wrapped.
		const w = row({
			student_scope: 'Enrolled',
			enrolled_in: 'Courses',
			courses: ['C1'],
		})
		const groups = w.findAll('[role="group"]')

		const valueCell = groups.find((g) =>
			g.findComponent({ name: 'MultiLink' }).exists()
		)!
		expect(valueCell.attributes('aria-labelledby')).toContain('row-name ')
	})

	it('names the type picker on the control, not on a wrapper', () => {
		// It was a Combobox, whose button trigger drops caller attrs, so the name had
		// to go on a role="group" around it. A Select takes it directly, and a group
		// left behind would announce the cell twice.
		const w = row({})
		const trigger = w.get(
			'[data-testid="condition-type"] [data-slot="trigger"]'
		)

		expect(trigger.attributes('aria-labelledby')).toContain('row-name ')
		expect(w.findComponent({ name: 'Combobox' }).exists()).toBe(false)
	})

	it('emits a whole new rule when a cell changes, never a nested write', async () => {
		// A nested write into `rule` does not reach the tree the builder holds, so
		// the edit would vanish on the next render.
		const w = row({ student_scope: 'Enrolled' })
		const before = w.props('rule')

		selectNamed(w, 'Students').vm.$emit('update:modelValue', 'All')
		await nextTick()

		expect(emittedRule(w).student_scope).toBe('All')
		expect(emittedRule(w)).not.toBe(before)
		expect(before.student_scope).toBe('Enrolled')
	})

	it('keeps only what the new type declares when the row is retyped', async () => {
		const w = row({ student_scope: 'Enrolled', enrolled_in: 'Courses' })

		typePicker(w).vm.$emit('update:modelValue', 'Staff')
		await nextTick()

		// A leftover key would still be sent as config, describing a rule the new
		// type never asked for. The declared default is seeded instead.
		expect(emittedRule(w)).toMatchObject({
			rule_type: 'Staff',
			staff_kind: 'All',
			status: 'Active',
		})
		expect(emittedRule(w).student_scope).toBeUndefined()
		expect(emittedRule(w).enrolled_in).toBeUndefined()
	})

	it('drops the fields the cascade stops showing, however deep they hang', async () => {
		// Dropping one field can hide the field that depended on it. Judged in a
		// single pass, assigned_scope still read "Courses" while it was itself
		// being deleted, so the courses under it stayed in the config.
		const w = row({
			rule_type: 'Staff',
			staff_kind: 'Assigned on',
			assigned_scope: 'Courses',
			staff_scope_courses: ['C1'],
		})

		selectNamed(w, 'Staff').vm.$emit('update:modelValue', 'All')
		await nextTick()

		expect(emittedRule(w).staff_kind).toBe('All')
		expect(emittedRule(w).assigned_scope).toBeUndefined()
		expect(emittedRule(w).staff_scope_courses).toBeUndefined()
	})

	it('hides the cascade under a required Select the rule does not carry', () => {
		// The control shows a `reqd` field empty rather than defaulted, so anything
		// hanging off it would be dangling from a value nobody can see selected.
		const missing = row({})
		expect(labelled(missing)).toEqual(['Students'])

		const filled = row({ student_scope: 'Enrolled' })
		expect(inline(filled)).toHaveLength(3)
	})

	it('offers exactly the declared options for a static multiselect', async () => {
		// The platform roles are a literal list, not a doctype. Handing them to the
		// doctype-backed control would search a doctype named after the first role.
		const w = row({ rule_type: 'Staff', staff_kind: 'Platform role' })
		const control = w.findComponent({ name: 'MultiSelect' })

		expect(w.findComponent({ name: 'MultiLink' }).exists()).toBe(false)
		expect(
			(control.props('options') as { value: string }[]).map((o) => o.value)
		).toEqual(['Course Creator', 'Evaluator', 'Moderator'])

		control.vm.$emit('update:modelValue', ['Moderator', 'Evaluator'])
		await nextTick()
		expect(emittedRule(w).platform_roles).toEqual(['Moderator', 'Evaluator'])
	})

	it("reads another provider's rule as text, and says whose it is", () => {
		// A frozen row renders as text rather than as disabled controls: a disabled
		// control is skipped in a screen reader's forms mode and is exempt from the
		// contrast minimum, so the state where the rule most needs reading would be
		// the state where it reads worst.
		const w = row({ provider: 'OTHER', rule_type: 'Their Rule' })

		expect(w.text()).toContain('Managed by OTHER')
		expect(w.findComponent({ name: 'Select' }).exists()).toBe(false)
	})
})

describe('the conditions of a channel', () => {
	const channel = (over: Record<string, unknown> = {}) => {
		server.data[GET_CHANNEL] = channelDetail(over)
		return mount(ChannelView, {
			props: { name: 'RCM-1', label: 'vue-basics' },
			...mountOptions,
		})
	}

	const conditionRows = (w: VueWrapper) =>
		w.findAllComponents({ name: 'RuleCondition' })

	const incomplete = {
		conjunctions: [],
		conditions: [
			apiRule('Student', { student_scope: 'Enrolled', enrolled_in: 'Courses' }),
		],
	}

	it('asks the builder for the free width, not for a size', () => {
		// A `#condition` row spans the builder's three leaf tracks, which default to
		// `minmax(0, max-content)`: the cascade sat in about a third of the card and
		// the rest went to the actions track, `minmax(max-content, 1fr)`. jsdom lays
		// nothing out, so the prop is the only thing assertable here; what it has to
		// be is a fraction big enough to leave that track its max-content floor.
		const w = channel({ rules: incomplete })
		const columns = w
			.findComponent({ name: 'ConditionBuilder' })
			.props('columns') as Record<string, string>

		for (const track of ['field', 'operator', 'value'])
			expect(columns[track]).toMatch(/^minmax\(0, \d{2,}fr\)$/)
	})

	it('words an unfinished condition once, under the builder, and marks its row', () => {
		// Three surfaces used to say it: the control's own error, a message beside
		// the row, and this one. The row now carries only the non-visual half, a
		// pointer at the single message.
		const w = channel({ rules: incomplete })
		const row = conditionRows(w)[0]

		expect(w.get('[data-testid="section-errors"]').text()).toBe(
			'Finish every condition before saving.'
		)
		expect(row.attributes('aria-invalid')).toBe('true')
		expect(w.get(`#${row.attributes('aria-describedby')}`).text()).toContain(
			'Finish every condition before saving.'
		)
		expect(buttonNamed(w, 'Save')!.attributes('disabled')).toBeDefined()
	})

	it('says an old-vocabulary condition must be replaced, not finished', () => {
		// A Staff rule keyed on `staff_role` still names the declared type, so on
		// the type name alone it reads as merely unfinished, and the screen invites
		// the user to complete it into a rule naming different people.
		const w = channel({
			rules: {
				conjunctions: [],
				conditions: [apiRule('Staff', { staff_role: 'Instructor' })],
			},
		})

		const message = w.get('[data-testid="section-errors"]').text()
		expect(message).toContain('written for an older version')
		expect(message).not.toContain('Finish every condition')
	})

	it("names each row's actions button after the row, and says the word once", () => {
		// useId() inside slot content still runs in the host's setup, so a word id
		// minted per row would hand every row the same value.
		const w = channel({
			rules: {
				conjunctions: ['and'],
				conditions: [
					apiRule('Student', { student_scope: 'All' }),
					apiRule('Staff', { staff_kind: 'All' }),
				],
			},
		})
		// The add affordance is a menu too, and names itself with `aria-label`.
		const triggers = w.findAll('button[aria-haspopup="menu"][aria-labelledby]')
		const named = triggers.map((t) => t.attributes('aria-labelledby')!)

		expect(triggers).toHaveLength(2)
		expect(
			w.findAll('span.sr-only').filter((s) => s.text() === 'Condition actions')
		).toHaveLength(1)
		// The row's own name first, then the shared word: eight identical
		// "Condition actions" buttons cannot be told apart in a rotor listing.
		expect(named[0].split(' ')[1]).toBe(named[1].split(' ')[1])
		expect(w.get(`#${named[0].split(' ')[0]}`).text()).toContain('Student')
		expect(w.get(`#${named[1].split(' ')[0]}`).text()).toContain('Staff')
	})

	it('hangs the row menu off the end of its trigger', () => {
		// `placement="end"` was not a value the component accepts, so the menu fell
		// back to the default and opened away from the button it belongs to.
		const w = channel({ rules: incomplete })
		// The row menu is the one offering Remove; the other Dropdown on the page
		// is the add affordance, which takes the default placement.
		const menu = w
			.findAllComponents({ name: 'Dropdown' })
			.find((d) =>
				(d.props('options') as { label: string }[]).some(
					(o) => o.label === 'Remove'
				)
			)!

		expect(menu.props('align')).toBe('end')
	})
})

describe('the channel page', () => {
	const channel = (props: Record<string, unknown> = {}) =>
		mount(ChannelView, {
			props: { name: 'RCM-1', label: 'vue-basics', ...props },
			...mountOptions,
		})

	const enabledSwitch = (w: VueWrapper) => w.find('button[role="switch"]')

	it('titles a new channel as the thing being made, and still calls it Save', () => {
		// Save on both pages and in both states: a Create that turns into Save the
		// instant it is pressed changes the word under the reader.
		const w = channel({ name: '', label: '', workspace: 'RWM-1' })

		expect(w.text()).toContain('New Channel')
		expect(buttonNamed(w, 'Save')).toBeDefined()
		// There is no record to switch on yet.
		expect(enabledSwitch(w).exists()).toBe(false)
		// create_channel takes the whole tree, so conditions authored before Create
		// are written with it.
		expect(w.findComponent({ name: 'RuleConditions' }).exists()).toBe(true)
	})

	it('writes Enabled straight through, because it is the record state', async () => {
		const w = channel()

		await enabledSwitch(w).trigger('click')
		await flushPromises()

		expect(asked(SET_CHANNEL_ENABLED)[0].params).toEqual({
			name: 'RCM-1',
			enabled: false,
		})
	})

	it('locks a channel whose Raven side is gone', async () => {
		server.data[GET_CHANNEL] = channelDetail({ stale: 1 })
		const w = channel()
		await flushPromises()

		expect(enabledSwitch(w).attributes('disabled')).toBeDefined()
		expect(buttonNamed(w, 'Save')!.attributes('disabled')).toBeDefined()
		// The conditions are replaced by the reason, not left there to be edited
		// into a channel that syncs nobody.
		expect(w.findComponent({ name: 'RuleConditions' }).exists()).toBe(false)
		expect(w.text()).toContain('missing in Raven')
	})
})

/**
 * Both detail pages commit on an explicit Save, so the back control is the one
 * way to lose a draft silently. The two are asserted together because it is one
 * behaviour, asked from one dialog off whatever state each page already had.
 */
describe('leaving a Raven detail page', () => {
	const pages = [
		{
			page: 'workspace',
			open: () =>
				mount(WorkspaceView, {
					props: { name: 'RWM-1', label: 'Design HQ' },
					...mountOptions,
				}),
			back: 'Design HQ',
		},
		{
			page: 'channel',
			open: () =>
				mount(ChannelView, {
					props: { name: 'RCM-1', label: 'vue-basics' },
					...mountOptions,
				}),
			back: '# vue-basics',
		},
	]

	// The question teleports out of the page, so it is read and answered at the
	// component, the way the popovers above are.
	const dialog = (w: VueWrapper) =>
		w.findComponent({ name: 'UnsavedChangesDialog' })

	const newWorkspace = () =>
		mount(WorkspaceView, { props: { name: '', label: '' }, ...mountOptions })

	it.each(pages)(
		'$page: goes back at once when nothing is unsaved',
		async ({ open, back }) => {
			const w = open()
			await flushPromises()

			await buttonNamed(w, back)!.trigger('click')

			expect(w.emitted('back')).toHaveLength(1)
			expect(dialog(w).props('open')).toBe(false)
		}
	)

	it.each(pages)(
		'$page: asks before dropping an edit, and leaves once answered',
		async ({ open, back }) => {
			const w = open()
			await flushPromises()
			await w.get('input[maxlength="140"]').setValue('Renamed')

			await buttonNamed(w, back)!.trigger('click')

			// Not gone yet: the owner swaps the screen only on `back`, so withholding
			// it is what keeps the edit behind the question.
			expect(w.emitted('back')).toBeUndefined()
			expect(dialog(w).props('open')).toBe(true)

			dialog(w).vm.$emit('confirm')
			await nextTick()

			expect(w.emitted('back')).toHaveLength(1)
			expect(dialog(w).props('open')).toBe(false)
		}
	)

	it('asks about a new workspace that has been half filled in', async () => {
		// There is no stored record to measure against, so everything typed into
		// the page is unsaved work.
		const w = newWorkspace()
		await w.get('input[maxlength="140"]').setValue('Design HQ')

		await buttonNamed(w, 'New Workspace')!.trigger('click')

		expect(w.emitted('back')).toBeUndefined()
		expect(dialog(w).props('open')).toBe(true)
	})

	it('leaves an untouched new workspace without asking', async () => {
		const w = newWorkspace()

		await buttonNamed(w, 'New Workspace')!.trigger('click')

		expect(w.emitted('back')).toHaveLength(1)
	})
})

/**
 * The confirmation between an edit and a membership change. Escape and the
 * overlay close it through the Dialog's v-model without touching an action, so
 * without a close-driven cancel the page keeps an edit it never applied. Dialog
 * is the one component stubbed here: it teleports, and what is under test is the
 * settling, not the overlay.
 */
describe('the mass-removal confirmation', () => {
	const DialogStub = {
		props: ['modelValue', 'actions'],
		emits: ['update:modelValue'],
		template: `<div>
			<button data-testid="dismiss" @click="$emit('update:modelValue', false)" />
			<button
				v-for="a in actions"
				:key="a.label"
				:data-testid="'action-' + (a.variant ?? 'plain')"
				@click="a.onClick()"
			>{{ a.label }}</button>
		</div>`,
	}

	const dialog = () =>
		mount(MassRemovalConfirmDialog, {
			props: { open: true, removedCount: 31, targetLabel: 'Design HQ' },
			global: { ...mountOptions.global, stubs: { Dialog: DialogStub } },
		})

	it.each([
		{ how: 'dismissed', testid: 'dismiss' },
		{ how: 'cancelled', testid: 'action-plain' },
	])('settles the caller when it is $how', async ({ testid }) => {
		const w = dialog()

		await w.get(`[data-testid="${testid}"]`).trigger('click')

		expect(w.emitted('cancel')).toHaveLength(1)
		expect(w.emitted('confirm')).toBeUndefined()
	})

	it('does not turn a confirmation into a cancel when it closes', async () => {
		const w = dialog()

		await w.get('[data-testid="action-solid"]').trigger('click')

		expect(w.emitted('confirm')).toHaveLength(1)
		expect(w.emitted('cancel')).toBeUndefined()
	})

	it('cancels again after the dialog is reopened', async () => {
		const w = dialog()
		await w.get('[data-testid="dismiss"]').trigger('click')

		// The caller's v-model writes the close back before it reopens the dialog.
		await w.setProps({ open: false })
		await w.setProps({ open: true })
		await w.get('[data-testid="dismiss"]').trigger('click')

		expect(w.emitted('cancel')).toHaveLength(2)
	})
})
