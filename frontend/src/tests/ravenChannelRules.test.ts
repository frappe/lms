/**
 * The three composables behind Settings > Raven, with no component mounted: the
 * channel draft and the gate between it and a membership change, the mapping
 * list's adopt and delete paths, and the workspace form's save sequencing.
 *
 * They share one frappe-ui mock, in which an endpoint answers only when a test
 * says so. A write that should not have happened is then visible as a submit
 * that was never called, and a reply that has not landed yet is a real state the
 * assertions can sit in.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { computed, nextTick, reactive, ref } from 'vue'
import { useChannelRules } from '@/composables/raven/useChannelRules'
import { useMappingList } from '@/composables/raven/useMappingList'
import { useWorkspaceGeneral } from '@/composables/raven/useWorkspaceGeneral'
import { leafAt, pathKey, ruleLeaves } from '@/utils/raven/ruleAdapter'
import type { RuleDiff, WorkspaceDetail } from '@/types'

const h = vi.hoisted(() => ({
	resources: [] as any[],
	/** Every submit, in the order they were made: what pins a write sequence. */
	calls: [] as { url: string; payload: any }[],
	replies: [] as {
		match: string
		answer?: (payload: any) => unknown
		fail?: unknown
	}[],
	errors: [] as string[],
	providers: [] as any[],
	/**
	 * Trimmed from lms/raven_provider.py, keeping the shape that matters here: a
	 * required Select, a defaulted Select hanging off it, and the multiselect the
	 * row has to fill in before the condition means anything.
	 */
	lms: {
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
						options: ['Any', 'Paid'],
						default: 'Any',
						depends_on: { field: 'student_scope', value_in: ['Enrolled'] },
					},
					{
						fieldname: 'courses',
						fieldtype: 'MultiSelect',
						label: 'Courses',
						options: 'LMS Course',
						reqd: 1,
						depends_on: { field: 'student_scope', value_in: ['Enrolled'] },
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
						options: ['All', 'Platform role'],
						reqd: 1,
						default: 'All',
					},
				],
			},
		],
	},
}))

vi.mock('frappe-ui', () => ({
	toast: {
		success: vi.fn(),
		error: (message: string) => h.errors.push(message),
	},
	createResource: (config: any) => {
		const url = String(config.url)
		// The provider declaration is the one resource with real data behind it.
		if (url.includes('list_providers'))
			return { url, data: h.providers, loading: false }
		const r: any = reactive({
			url,
			data: null,
			loading: false,
			error: null,
			_config: config,
		})
		r.reset = vi.fn(() => {
			r.data = null
		})
		r.reload = vi.fn(async () => r.data)
		r.submit = vi.fn((payload: any) => {
			h.calls.push({ url, payload })
			// Mirrors frappe-ui: loading flips before any await and only flips back
			// when the fetch settles, which is what a re-entrancy guard reads.
			r.loading = true
			r.error = null
			const scripted = h.replies.find((s) => url.includes(s.match))
			if (!scripted)
				return new Promise((resolve) => {
					r._resolve = (value?: unknown) => {
						r.loading = false
						config.onSuccess?.(value ?? payload)
						resolve(value ?? payload)
					}
				})
			r.loading = false
			const answered = scripted.answer?.(payload) ?? null
			if (scripted.fail) {
				r.error = scripted.fail
				config.onError?.(scripted.fail)
				// submit() never rejects, and on a failure it resolves with the last
				// SUCCESSFUL call's data rather than this one's.
				return Promise.resolve(answered)
			}
			config.onSuccess?.(answered)
			return Promise.resolve(answered)
		})
		h.resources.push(r)
		return r
	},
}))

vi.stubGlobal('__', (s: string) => s)

/** The most recently built resource whose endpoint contains `fragment`. */
const res = (fragment: string): any =>
	h.resources.filter((r) => r.url.includes(fragment)).pop()

const answers = (...replies: typeof h.replies) => {
	h.replies = replies
}

beforeEach(() => {
	h.resources = []
	h.calls = []
	h.replies = []
	h.errors = []
	h.providers = [h.lms]
})

const CHANNEL = 'RCM-Vue Basics'

const studentRule = (over: Record<string, unknown> = {}) => ({
	name: 'rule-1',
	label: 'Student · Enrolled',
	provider: 'LMS',
	rule_type: 'Student',
	status: 'Active',
	config: { student_scope: 'Enrolled', payment_filter: 'Any', courses: ['C1'] },
	...over,
})

function setup(options: Parameters<typeof useChannelRules>[1] = {}) {
	const rules = useChannelRules(() => CHANNEL, options)
	rules.reload()
	return rules
}

/** Serve the channel: `conjunctions` defaults to one `or` per gap. */
function load(
	conditions: unknown[] = [],
	over: Record<string, unknown> = {},
	conjunctions?: string[]
) {
	const detail = res('get_channel')
	detail.data = {
		name: CHANNEL,
		channel_label: 'Vue Basics',
		channel_type: 'Private',
		enabled: 1,
		stale: 0,
		rules: {
			conjunctions: conjunctions ?? conditions.slice(1).map(() => 'or'),
			conditions,
		},
		...over,
	}
	detail._config.onSuccess?.(detail.data)
}

/** What the builder does on "Add Condition": append through the v-model. */
function addCondition(rules: ReturnType<typeof useChannelRules>) {
	rules.tree.value = {
		conjunction: 'or',
		conditions: [...rules.tree.value.conditions, rules.newCondition()],
	}
}

/** What the row does on an edit: hand the builder a replaced leaf. */
function writeLeaf(
	rules: ReturnType<typeof useChannelRules>,
	index: number,
	rule: Record<string, unknown>
) {
	const conditions = [...rules.tree.value.conditions]
	conditions[index] = rule as never
	rules.tree.value = { ...rules.tree.value, conditions }
}

/** Resolve the preview so apply() runs, for a change that moves nobody. */
async function passDiff() {
	res('compute_rule_diff')._config.onSuccess?.({
		added: 0,
		removed: 0,
		removed_users: [],
		unknown: false,
	} as RuleDiff)
	await flushPromises()
}

// The name and the visibility used to write the moment they changed, while Save
// committed only the conditions: the page both broke the no-autosave rule and
// behaved unlike the workspace's General tab.
describe('useChannelRules: one draft, one Save', () => {
	it.each([
		{
			edit: 'the name',
			soil: (r: any) => (r.labelDraft.value = 'Vue Advanced'),
		},
		{ edit: 'the visibility', soil: (r: any) => (r.typeDraft.value = 'Open') },
		{ edit: 'a condition', soil: addCondition },
	])('$edit is unsaved work, with nothing written yet', ({ soil }) => {
		const rules = setup()
		load([studentRule()])
		expect(rules.dirty.value).toBe(false)

		soil(rules)

		expect(rules.dirty.value).toBe(true)
		expect(res('update_channel').submit).not.toHaveBeenCalled()
	})

	it('ignores whitespace either side of the name', () => {
		const rules = setup()
		load([studentRule()])
		rules.labelDraft.value = '  Vue Basics  '
		expect(rules.dirty.value).toBe(false)
	})

	it('commits the name, the visibility and the conditions in one call', async () => {
		const rules = setup()
		load([studentRule()])
		rules.labelDraft.value = 'Vue Advanced'
		rules.typeDraft.value = 'Open'

		rules.save()
		await passDiff()

		const payload = res('update_channel').submit.mock.calls[0][0]
		expect(payload).toMatchObject({
			name: CHANNEL,
			label: 'Vue Advanced',
			type: 'Open',
		})
		expect(payload.rules.conditions).toHaveLength(1)
	})

	it('refuses an empty name instead of quietly restoring the stored one', async () => {
		const rules = setup()
		load([studentRule()])
		rules.labelDraft.value = '   '

		rules.save()
		await flushPromises()

		// Nothing is sent at all, not the preview and not the write. Substituting
		// the stored name reported "Channel saved" over a discarded edit.
		expect(res('compute_rule_diff').submit).not.toHaveBeenCalled()
		expect(res('update_channel').submit).not.toHaveBeenCalled()
		expect(rules.dirty.value).toBe(true)
	})

	it('sends the tree as the rows left it, naming only what has no name', async () => {
		const rules = setup()
		load([studentRule({ status: 'Paused' })])
		addCondition(rules)
		writeLeaf(rules, 1, {
			...leafAt(rules.tree.value, [1])!,
			courses: ['C2'],
		})

		rules.save()
		await passDiff()

		const payload = res('update_channel').submit.mock.calls[0][0]
		// Normalising status on the way out would mean opening a channel to rename
		// it switched on every paused condition in the tree.
		expect(payload.rules.conditions[0].status).toBe('Paused')
		// The row has no name box, so an added condition is named from what it says.
		expect(payload.rules.conditions[1].label).toBe('Student · Enrolled')
	})

	it('opens clean on joiners it cannot draw, and writes them back unchanged', async () => {
		// `A or B and C` is a shape this editor has one control for, so reading that
		// control as an edit would both open the page in Not Saved and, on an
		// unrelated rename, flatten the `and` to `or`, which only adds members, so
		// the confirmation gated on removals never asks.
		const rules = setup()
		load(
			[
				studentRule({ name: 'r1' }),
				studentRule({ name: 'r2' }),
				studentRule({ name: 'r3' }),
			],
			{},
			['or', 'and']
		)
		expect(rules.dirty.value).toBe(false)

		rules.labelDraft.value = 'Vue Basics II'
		rules.save()
		await passDiff()

		expect(
			res('update_channel').submit.mock.calls[0][0].rules.conjunctions
		).toEqual(['or', 'and'])
	})
})

describe('useChannelRules: a reload landing under the page', () => {
	// A reload can come from something that is not a save: the Enabled switch
	// reloads on both success and failure. Keyed on the docname rather than on
	// `dirty` alone, because a load for a different record is a navigation.
	it.each([
		{
			reload: 'the same record under an unsaved draft',
			over: { channel_label: 'Renamed Elsewhere' },
			edited: true,
			label: 'Vue Advanced',
			dirty: true,
		},
		{
			reload: 'the same record with nothing unsaved',
			over: { channel_label: 'Renamed Elsewhere' },
			edited: false,
			label: 'Renamed Elsewhere',
			dirty: false,
		},
		{
			reload: 'a different record',
			over: { name: 'RCM-Other', channel_label: 'Renamed Elsewhere' },
			edited: true,
			label: 'Renamed Elsewhere',
			dirty: false,
		},
	])(
		'a load of $reload leaves the name at $label',
		({ over, edited, label, dirty }) => {
			const rules = setup()
			load([studentRule()])
			if (edited) rules.labelDraft.value = 'Vue Advanced'

			load([studentRule()], over)

			expect(rules.labelDraft.value).toBe(label)
			expect(rules.dirty.value).toBe(dirty)
		}
	)
})

describe('useChannelRules: why a condition cannot be saved', () => {
	it.each([
		{
			condition: 'a required field left empty',
			rule: studentRule({
				config: { student_scope: 'Enrolled', payment_filter: 'Any' },
			}),
			kind: 'incomplete',
		},
		{
			condition: 'a rule type nothing declares any more',
			rule: studentRule({ rule_type: 'Students of Courses' }),
			kind: 'undeclared',
		},
		{
			// The screen words one message per kind: "remove it" against
			// "finish it". A staff_role rule still names the declared type Staff, so
			// on the type name alone it reads as merely unfinished and the user is
			// invited to complete it into a rule naming different people.
			condition: 'a key the declared type does not name',
			rule: studentRule({
				rule_type: 'Staff',
				config: { staff_role: 'Course Creator' },
			}),
			kind: 'undeclared',
		},
	])('flags $condition as $kind', ({ rule, kind }) => {
		const rules = setup()
		load([rule])
		expect(rules.invalid.value.get(pathKey([0]))).toEqual({ kind })
	})

	it('says nothing about two conditions that restate each other', () => {
		// A restatement adds people who are added already. The check that refused it
		// compared leaves for literal equality, so it caught the one repeat a reader
		// can see and missed two groups evaluating to the same population.
		const rules = setup()
		load([studentRule(), studentRule({ name: 'rule-2' })])
		expect(rules.invalid.value.size).toBe(0)
	})

	it('refuses to save while anything is flagged', () => {
		const rules = setup()
		load([])
		addCondition(rules)

		rules.save()

		expect(res('compute_rule_diff').submit).not.toHaveBeenCalled()
		expect(h.errors).toContain(
			'Fix the problems listed under the conditions first'
		)
	})

	it('will not save conditions it could not load the types for, and says so', async () => {
		h.providers = []
		const rules = setup()
		load([studentRule()])
		rules.labelDraft.value = 'Vue Advanced'

		rules.save()
		await flushPromises()

		// Previously this returned in silence: an enabled Save that did nothing.
		expect(res('compute_rule_diff').submit).not.toHaveBeenCalled()
		expect(h.errors.join(' ')).toMatch(/Condition types could not be loaded/)
	})

	it('still renames a channel that has no conditions to check', async () => {
		h.providers = []
		const rules = setup()
		load([])
		rules.labelDraft.value = 'Vue Advanced'

		rules.save()
		await flushPromises()

		// Only the conditions need the declarations; a rename must not be held
		// hostage to them.
		expect(res('compute_rule_diff').submit).toHaveBeenCalled()
	})
})

describe('useChannelRules: the confirmation gate', () => {
	it('previews against the channel mapping and writes straight through when nobody is dropped', async () => {
		const rules = setup()
		load([studentRule()])
		rules.labelDraft.value = 'Renamed'

		rules.save()
		expect(res('compute_rule_diff').submit).toHaveBeenCalledWith(
			expect.objectContaining({
				target_doctype: 'Raven Channel Mapping',
				name: CHANNEL,
			})
		)
		expect(res('update_channel').submit).not.toHaveBeenCalled()

		res('compute_rule_diff')._config.onSuccess?.({
			added: 3,
			removed: 0,
			removed_users: [],
			unknown: false,
		} as RuleDiff)
		await flushPromises()

		expect(rules.confirmOpen.value).toBe(false)
		expect(res('update_channel').submit).toHaveBeenCalledTimes(1)
	})

	it.each([
		{
			preview: 'anyone at all would be dropped',
			diff: { added: 0, removed: 12, removed_users: [], unknown: false },
		},
		{
			// `unknown` reports zeros because nothing could be evaluated, not because
			// nobody moves, so reading them as "removes nobody" applies the write
			// silently. Asked rather than blocked: an unevaluable tree is usually the
			// one the user came to fix.
			preview: 'the effect could not be worked out',
			diff: { added: 0, removed: 0, removed_users: [], unknown: true },
		},
	])('asks first when $preview', async ({ diff }) => {
		const rules = setup()
		load([studentRule()])
		rules.labelDraft.value = 'Renamed'

		rules.save()
		res('compute_rule_diff')._config.onSuccess?.(diff as RuleDiff)
		await flushPromises()

		expect(rules.confirmOpen.value).toBe(true)
		expect(rules.diff.value).toEqual(diff)
		expect(res('update_channel').submit).not.toHaveBeenCalled()

		rules.confirm()
		expect(res('update_channel').submit).toHaveBeenCalledTimes(1)
	})

	it('cancelling writes nothing', async () => {
		const rules = setup()
		load([studentRule()])
		rules.labelDraft.value = 'Renamed'

		rules.save()
		res('compute_rule_diff')._config.onSuccess?.({
			added: 0,
			removed: 12,
			removed_users: [],
			unknown: false,
		} as RuleDiff)
		await flushPromises()

		rules.cancel()

		expect(rules.confirmOpen.value).toBe(false)
		expect(res('update_channel').submit).not.toHaveBeenCalled()
	})

	it('never writes on a preview it could not compute', async () => {
		const rules = setup()
		load([studentRule()])
		rules.labelDraft.value = 'Renamed'

		rules.save()
		res('compute_rule_diff')._config.onError?.({ messages: [] })
		await flushPromises()

		expect(res('update_channel').submit).not.toHaveBeenCalled()
		expect(h.errors).toContain('Could not check who this change affects')
	})
})

describe('useChannelRules: once the write is out', () => {
	it('stays dirty when the write is rejected', async () => {
		const rules = setup()
		load([studentRule()])
		rules.labelDraft.value = 'Vue Advanced'
		rules.save()
		await passDiff()

		res('update_channel')._config.onError?.({ messages: ['nope'] })
		await flushPromises()

		// markSaved() used to run at submit time, so a rejected write cleared the
		// Not Saved badge and greyed out Save with nothing stored.
		expect(rules.dirty.value).toBe(true)
		expect(rules.labelDraft.value).toBe('Vue Advanced')
	})

	it('is clean only once the server answers, and adopts the docname a rename produced', async () => {
		const renamed: string[] = []
		let current = CHANNEL
		const rules = useChannelRules(() => current, {
			onRenamed: (n) => {
				renamed.push(n)
				current = n
			},
		})
		rules.reload()
		load([studentRule()])
		rules.labelDraft.value = 'Vue Advanced'
		rules.save()
		await passDiff()

		expect(rules.dirty.value).toBe(true)

		res('update_channel')._config.onSuccess?.('RCM-Vue Advanced')
		await flushPromises()

		expect(rules.dirty.value).toBe(false)
		// The docname is derived from the label, so the save moved it. Holding the
		// old one addressed every later request to a doc that no longer exists.
		expect(renamed).toEqual(['RCM-Vue Advanced'])
		expect(current).toBe('RCM-Vue Advanced')
		expect(res('get_channel').submit).toHaveBeenLastCalledWith({
			name: 'RCM-Vue Advanced',
		})
	})
})

/**
 * New is a page, not a write. Create used to POST create_channel on click, so a
 * mis-click left a real Raven channel behind. Nothing is written now until Create
 * is pressed, and because create_channel takes the whole rule tree, the
 * conditions authored on the way are written with it, in one call.
 */
describe('useChannelRules: before the channel exists', () => {
	const WORKSPACE = 'RWM-Design HQ'

	function setupNew(workspace: string = WORKSPACE) {
		const created: string[] = []
		// A ref, not a plain variable: `isNew` is a computed over this accessor, and
		// in the page it reads a prop, so the adoption has to be reactive here too.
		const current = ref('')
		const rules = useChannelRules(() => current.value, {
			workspace: () => workspace,
			onCreated: (n) => {
				created.push(n)
				current.value = n
			},
		})
		rules.reload()
		return { rules, created, nameNow: () => current.value }
	}

	it('opens empty, clean, and asks the server for nothing', () => {
		const { rules } = setupNew()

		expect(rules.isNew.value).toBe(true)
		expect(rules.labelDraft.value).toBe('')
		expect(rules.typeDraft.value).toBe('Private')
		expect(ruleLeaves(rules.tree.value)).toHaveLength(0)
		expect(rules.dirty.value).toBe(false)
		expect(res('get_channel').submit).not.toHaveBeenCalled()

		// A typed name is the unsaved work the leave guard asks about, and the
		// visibility alone is never enough to commit.
		rules.typeDraft.value = 'Open'
		expect(rules.canSubmit.value).toBe(false)
		rules.labelDraft.value = 'vue-basics'
		expect(rules.dirty.value).toBe(true)
		expect(rules.canSubmit.value).toBe(true)
	})

	it('writes the channel and its conditions in one call, past the diff gate', async () => {
		const { rules } = setupNew()
		rules.labelDraft.value = '  vue-basics  '
		rules.typeDraft.value = 'Open'
		addCondition(rules)
		writeLeaf(rules, 0, { ...leafAt(rules.tree.value, [0])!, courses: ['C1'] })

		rules.save()
		await flushPromises()

		// No preview: a channel that does not exist has no members, so the
		// mass-removal confirmation has nothing to compare against.
		expect(res('compute_rule_diff').submit).not.toHaveBeenCalled()
		expect(res('update_channel').submit).not.toHaveBeenCalled()
		const payload = res('create_channel').submit.mock.calls[0][0]
		expect(payload).toMatchObject({
			workspace: WORKSPACE,
			label: 'vue-basics',
			type: 'Open',
		})
		expect(payload.rules.conditions).toHaveLength(1)
		expect(payload.rules.conditions[0].rule_type).toBe('Student')
	})

	it('becomes the ordinary detail page for what it just made', async () => {
		const t = setupNew()
		t.rules.labelDraft.value = 'vue-basics'
		t.rules.save()
		await flushPromises()

		res('create_channel')._config.onSuccess?.('RCM-vue-basics')
		await flushPromises()

		expect(t.created).toEqual(['RCM-vue-basics'])
		expect(t.nameNow()).toBe('RCM-vue-basics')
		expect(t.rules.isNew.value).toBe(false)
		expect(t.rules.dirty.value).toBe(false)
		expect(res('get_channel').submit).toHaveBeenLastCalledWith({
			name: 'RCM-vue-basics',
		})
	})

	// Each refusal names its reason. Returning in silence read as a Create button
	// that did nothing at all.
	it.each([
		{
			refusal: 'a name that is only whitespace',
			label: '   ',
			workspace: WORKSPACE,
			message: 'Give this channel a name before saving',
		},
		{
			refusal: 'no workspace for it to live in',
			label: 'vue-basics',
			workspace: '',
			message:
				"No workspace to create this channel in. Go back and start again from a workspace's Channels tab.",
		},
	])('creates nothing and says why on $refusal', async (row) => {
		const { rules } = setupNew(row.workspace)
		rules.labelDraft.value = row.label

		rules.save()
		await flushPromises()

		expect(res('create_channel').submit).not.toHaveBeenCalled()
		expect(h.errors).toContain(row.message)
	})
})

describe('useChannelRules: the row Add Condition produces', () => {
	it('is one of ours, seeded with the defaults the row already shows', () => {
		// list_providers guarantees no ordering, so another app's provider can come
		// back ahead of ours on any site that has one installed. A foreign leaf is
		// frozen, read-only text with no control to type into, and `invalid` skips
		// foreign rules, so a foreign row born empty saved as it was.
		h.providers = [
			{
				name: 'OTHER',
				label: 'Another App',
				rule_types: [
					{
						type: 'Their Rule',
						label: 'Their Rule',
						fields: [
							{
								fieldname: 'their_field',
								fieldtype: 'Data',
								label: 'Their Field',
								reqd: 1,
							},
						],
					},
				],
			},
			h.lms,
		]
		const rules = setup()
		load([])

		addCondition(rules)

		const leaf = leafAt(rules.tree.value, [0])!
		expect(leaf.provider).toBe('LMS')
		expect(leaf.rule_type).toBe('Student')
		// The declared defaults, as RuleCondition seeds a retyped row. Without them
		// the row reads "Enrolled" while saving no such key, so a fresh row and a
		// retyped one would be stored differently while reading alike on screen.
		expect(leaf.student_scope).toBe('Enrolled')
		expect(leaf.payment_filter).toBe('Any')
		// And it is judged, not skipped as somebody else's business.
		expect(rules.invalid.value.get(pathKey([0]))).toEqual({
			kind: 'incomplete',
		})
	})
})

describe('useMappingList: adopting and deleting a row', () => {
	const unmappedChannel = () => ({
		name: null,
		mapped: false,
		raven_channel: 'CH-RAW',
		channel_label: 'general',
		workspace: 'RWM-parent',
		channel_type: 'Public',
		enabled: 1,
		stale: 0,
	})

	async function channelList(records: unknown[]) {
		const list = useMappingList({ entity: 'channel', workspace: 'RWM-parent' })
		res('list_channels').data = records
		await nextTick()
		return list
	}

	it('links an unmapped channel, then re-reads it as a managed row', async () => {
		answers({ match: 'link_channel', answer: () => 'RCM-general' })
		const list = await channelList([unmappedChannel()])
		const row = list.rows.value[0]
		expect(row.mapped).toBe(false)
		// The Raven id, not the docname: a key that survives adoption keeps the
		// row's place in the list.
		expect(row.key).toBe('CH-RAW')

		await list.linkRow(row)

		expect(res('link_channel').submit).toHaveBeenCalledWith({
			workspace: 'RWM-parent',
			raven_channel: 'CH-RAW',
		})
		expect(res('list_channels').reload).toHaveBeenCalled()
		expect(list.rows.value[0].mapped).toBe(true)
		expect(list.rows.value[0].name).toBe('RCM-general')
	})

	it('recovers from a duplicate race by using the mapping that won it', async () => {
		answers({
			match: 'link_channel',
			fail: { exc_type: 'DuplicateEntryError' },
		})
		const list = await channelList([unmappedChannel()])
		const listRes = res('list_channels')
		listRes.reload = vi.fn(async () => {
			listRes.data = [
				{ ...unmappedChannel(), name: 'RCM-existing', mapped: true },
			]
			return listRes.data
		})

		await list.linkRow(list.rows.value[0])

		expect(list.rows.value[0].name).toBe('RCM-existing')
		// Losing an adopt race is benign: the row ends up adopted either way.
		expect(h.errors).toEqual([])
	})

	it('deletes once when the confirmation is pressed twice', async () => {
		const list = await channelList([
			{ ...unmappedChannel(), name: 'RCM-1', mapped: true },
		])
		list.askDelete(list.rows.value[0])
		expect(list.deleteOpen.value).toBe(true)

		// Two synchronous confirms before the first submit's promise resolves. Both
		// requests raced the same row's delete lock, which delete_doc takes NOWAIT.
		list.confirmDelete()
		list.confirmDelete()

		const del = res('delete_channel')
		expect(del.submit).toHaveBeenCalledTimes(1)
		expect(del.submit).toHaveBeenCalledWith({ name: 'RCM-1' })

		del._resolve()
		await flushPromises()

		expect(del.submit).toHaveBeenCalledTimes(1)
		expect(list.deleteOpen.value).toBe(false)
	})
})

describe('useWorkspaceGeneral: what Save sends, and in what order', () => {
	// The rename endpoint answers with the mapping's docname, which the rename has
	// just moved: the mapping autonames from its label.
	const RENAME = {
		match: 'set_workspace_label',
		answer: (p: any) => ({ name: `RWM-${p.label}` }),
	}
	const RETYPE = { match: 'set_workspace_type' }

	const detail = (over: Partial<WorkspaceDetail> = {}) =>
		({
			name: 'RWM-1',
			mapped: true,
			workspace_label: 'Design HQ',
			workspace_type: 'Private',
			raven_workspace: 'WS-1',
			stale: 0,
			member_count: 3,
			channels_active: 2,
			channels_paused: 0,
			creation: '2026-08-01',
			...over,
		} as WorkspaceDetail)

	function setup() {
		const source = ref<WorkspaceDetail | null>(detail())
		const changed = vi.fn()
		const renamed = vi.fn()
		const form = useWorkspaceGeneral(
			computed(() => source.value),
			changed,
			{ onRenamed: renamed }
		)
		return { form, source, changed, renamed }
	}

	const urls = () => h.calls.map((c) => c.url)

	it('sends only the field that changed', async () => {
		answers(RENAME)
		const { form } = setup()
		form.draft.label = 'Design HQ 2'

		await form.save()

		expect(h.calls).toEqual([
			{
				url: 'raven_integration.api.set_workspace_label',
				payload: { name: 'RWM-1', label: 'Design HQ 2' },
			},
		])
	})

	it('sends both when both changed, renaming last', async () => {
		answers(RETYPE, RENAME)
		const { form, changed, renamed } = setup()
		form.draft.label = 'Renamed'
		form.draft.type = 'Public'

		await form.save()

		// Order is the point, not just the pair: a rename moves the docname, so a
		// visibility write issued against the old name could land after it and
		// address a doc that is gone.
		expect(urls()).toEqual([
			'raven_integration.api.set_workspace_type',
			'raven_integration.api.set_workspace_label',
		])
		// Adopting the new docname moves the owner's prop, which reloads the page on
		// its own. Reloading here as well asks for the name the rename took away.
		expect(renamed).toHaveBeenCalledWith('RWM-Renamed')
		expect(changed).not.toHaveBeenCalled()
	})

	it('does not write the name when the visibility write failed', async () => {
		answers(
			{ match: 'set_workspace_type', fail: { messages: ['nope'] } },
			RENAME
		)
		const { form, changed, renamed } = setup()
		form.draft.label = 'Renamed'
		form.draft.type = 'Public'

		await form.save()

		// submit() does not reject, so without the gate the rename runs anyway and
		// the page comes back showing the new name with the old visibility.
		expect(urls()).toEqual(['raven_integration.api.set_workspace_type'])
		expect(renamed).not.toHaveBeenCalled()
		expect(changed).toHaveBeenCalledTimes(1)
	})

	it('does not adopt a docname a failed rename never produced', async () => {
		answers({
			match: 'set_workspace_label',
			fail: { messages: ['nope'] },
			// What a failed submit resolves with: the last SUCCESSFUL call's data,
			// which here belongs to a different record entirely.
			answer: () => ({ name: 'RWM-Someone Else' }),
		})
		const { form, changed, renamed } = setup()
		form.draft.label = 'Renamed'

		await form.save()

		expect(renamed).not.toHaveBeenCalled()
		// Once, by the error handler. Falling through reloaded a second time.
		expect(changed).toHaveBeenCalledTimes(1)
	})
})
