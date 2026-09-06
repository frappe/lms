/**
 * The Raven rule model with nothing mounted: the wire adapter, the URLs out to
 * Raven, and the provider declaration read as the condition row reads it.
 *
 * The declaration fixture is extracted from lms/raven_provider.py rather than
 * retyped, because every cascade rule here is a claim about what that file
 * declares. A retyped copy stops being one the day the provider changes.
 */
import { describe, expect, it, test, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
	forgetMovedJoiners,
	fromApiRule,
	fromApiTree,
	hasMixedConjunctions,
	isWireKey,
	leafAt,
	pathKey,
	ruleLeaves,
	toApiRule,
	toApiTree,
} from '@/utils/raven/ruleAdapter'
import {
	autoRuleLabel,
	conditionSlots,
	hasRequiredFields,
	hasUndeclaredFields,
	visibleFieldsOf,
	withoutHiddenFields,
} from '@/composables/raven/providerSchema'
import { openInRavenOptions, ravenHref } from '@/utils/raven/openInRaven'
import type {
	ApiRule,
	ApiRuleGroup,
	Conjunction,
	ProviderRuleType,
	RavenMemberRule,
	RuleGroup,
} from '@/types'

vi.mock('frappe-ui', () => ({ createResource: () => ({ data: [] }) }))

vi.stubGlobal('__', (s: string) => s)

const open = vi.fn()
vi.stubGlobal('open', open)

const SRC = resolve(process.cwd(), 'src')
const PROVIDER = resolve(process.cwd(), '..', 'lms', 'raven_provider.py')

// Only the two assignments are executed, so `import frappe` and the rest of the
// module never run: this needs a python that can parse the file, not a bench.
const EXTRACT_RULE_TYPES = `
import ast, json, sys
tree = ast.parse(open(sys.argv[1]).read())
wanted = ('PLATFORM_ROLES', 'RULE_TYPES')
body = [n for n in tree.body
        if isinstance(n, ast.Assign)
        and any(getattr(t, 'id', '') in wanted for t in n.targets)]
ns = {}
exec(compile(ast.Module(body=body, type_ignores=[]), '<provider>', 'exec'), ns)
print(json.dumps(ns['RULE_TYPES']))
`

// Named, so a missing interpreter says so instead of failing as an ENOENT at import.
const readRuleTypes = (): ProviderRuleType[] => {
	try {
		return JSON.parse(
			execFileSync('python3', ['-c', EXTRACT_RULE_TYPES, PROVIDER], {
				encoding: 'utf8',
			})
		)
	} catch (error) {
		throw new Error(
			`Could not read RULE_TYPES from ${PROVIDER} with python3, which this ` +
				`suite needs on PATH because it parses the provider rather than ` +
				`retyping it.\n${(error as Error).message}`
		)
	}
}

const ruleTypes: ProviderRuleType[] = readRuleTypes()

const names = (fields: { fieldname: string }[]) =>
	fields.map((f) => f.fieldname).join(' ')

/** A rule from a `key=value, key=value` line, so a case's name is its own data. */
const ruleWith = (rule_type: string, given: string): RavenMemberRule => {
	const rule: RavenMemberRule = { rule_type, status: 'Active' }
	for (const pair of given.split(', ')) {
		const [key, value] = pair.split('=')
		if (value !== undefined) rule[key] = value
	}
	return rule
}

describe('the declaration this suite is written against', () => {
	it('is the two cascading rule types lms/raven_provider.py declares', () => {
		expect(ruleTypes.map((rt) => rt.type)).toEqual(['Student', 'Staff'])
		for (const rt of ruleTypes) expect(rt.fields?.length).toBeGreaterThan(0)
	})
})

describe('the flat rule and the rule on the wire', () => {
	const foreign: ApiRule = {
		name: 'RMR-9',
		label: 'Widget owners',
		provider: 'Acme',
		rule_type: 'Widget Owners',
		status: 'Active',
		config: { widget_tier: 'gold', regions: ['EU', 'US'] },
	}

	it('lifts config onto the rule and nests it back, wire keys left outside', () => {
		const api: ApiRule = {
			name: 'RMR-1',
			label: 'Cohort',
			provider: 'LMS',
			rule_type: 'Student',
			status: 'Paused',
			config: { student_scope: 'Enrolled', courses: ['C1', 'C2'] },
			matches: '12 people',
		}
		const flat = fromApiRule(api)
		expect(flat.student_scope).toBe('Enrolled')
		expect(flat.courses).toEqual(['C1', 'C2'])
		expect(flat.matches).toBe('12 people')

		const back = toApiRule(flat)
		expect(back.config).toEqual(api.config)
		expect(back).toMatchObject({ label: 'Cohort', status: 'Paused' })
	})

	it('carries a rule this UI does not own through untouched', () => {
		// Config keys are copied, not filtered against an LMS list. Another
		// provider's vocabulary has to survive a save made from this screen.
		expect(toApiRule(fromApiRule(foreign))).toEqual(foreign)
	})

	it('invents nothing the wire did not carry, and stamps LMS only when unowned', () => {
		const flat = fromApiRule({
			provider: 'LMS',
			rule_type: 'Staff',
			status: 'Active',
			config: {},
		})
		expect(flat.label).toBeUndefined()
		expect(flat.staff_kind).toBeUndefined()
		expect(toApiRule(flat).config).toEqual({})
		expect(toApiRule({ rule_type: 'Staff', status: 'Active' }).provider).toBe(
			'LMS'
		)
		expect(toApiRule(fromApiRule(foreign)).provider).toBe('Acme')
	})

	test.each([
		['name', true],
		['label', true],
		['provider', true],
		['rule_type', true],
		['status', true],
		['matches', true],
		['staff_kind', false],
		['courses', false],
	])('isWireKey(%s) is %s', (key, expected) => {
		expect(isWireKey(key)).toBe(expected)
	})
})

describe('the condition tree', () => {
	const rule: RavenMemberRule = {
		provider: 'LMS',
		rule_type: 'Student',
		status: 'Active',
		courses: ['C1'],
	}

	it('reads a missing tree as an empty one rather than throwing', () => {
		expect(fromApiTree(null)).toEqual({ conjunction: 'and', conditions: [] })
		expect(fromApiTree(undefined)).toEqual({
			conjunction: 'and',
			conditions: [],
		})
		// `and` is the joiner a group with nothing to join still shows.
		expect(fromApiTree({ conjunctions: [], conditions: [] }).conjunction).toBe(
			'and'
		)
	})

	it('round-trips a nested tree, nesting a leaf inside a group like any other', () => {
		const nested: RuleGroup = {
			conjunction: 'and',
			conditions: [rule, { conjunction: 'or', conditions: [rule, rule] }],
		}
		const wire = toApiTree(nested)
		expect(toApiTree(fromApiTree(wire))).toEqual(wire)

		const group = wire.conditions[1] as { conditions: ApiRule[] }
		expect(group.conditions[0].config).toEqual({ courses: ['C1'] })
	})

	// The engine reads one joiner per gap; the editor holds one for the group. So
	// `or` to `and` moves people without touching a rule, and a payload that lost
	// the token would save a union as an intersection.
	const gapCases: { rows: number; conjunction: Conjunction; gaps: string }[] = [
		{ rows: 0, conjunction: 'or', gaps: '' },
		{ rows: 1, conjunction: 'or', gaps: '' },
		{ rows: 2, conjunction: 'and', gaps: 'and' },
		{ rows: 3, conjunction: 'or', gaps: 'or or' },
	]

	test.each(gapCases)(
		'$rows rows joined by $conjunction reach the wire as [$gaps]',
		({ rows, conjunction, gaps }) => {
			const tree: RuleGroup = {
				conjunction,
				conditions: Array.from({ length: rows }, () => rule),
			}
			expect(toApiTree(tree).conjunctions.join(' ')).toBe(gaps)
		}
	)

	it('addresses every leaf by its path, depth first', () => {
		const nested: RuleGroup = {
			conjunction: 'or',
			conditions: [rule, { conjunction: 'and', conditions: [rule] }],
		}
		expect(ruleLeaves(nested).map((l) => l.path)).toEqual([[0], [1, 0]])
		expect(leafAt(nested, [1, 0])).toBe(rule)
		// A group is not a leaf, and neither is an index nothing sits at.
		expect(leafAt(nested, [1])).toBeNull()
		expect(leafAt(nested, [9])).toBeNull()
		expect(pathKey([1, 0])).toBe('1.0')
	})
})

describe('a group whose joiners this editor cannot draw', () => {
	const leaf = {
		provider: 'LMS',
		rule_type: 'Student',
		status: 'Active' as const,
	}
	const wire = (conjunctions: Conjunction[]): ApiRuleGroup => ({
		conjunctions,
		conditions: [
			{ ...leaf, config: { courses: ['C1'] } },
			{ ...leaf, config: { courses: ['C2'] } },
			{ ...leaf, config: { courses: ['C3'] } },
		],
	})
	// raven_integration's own editor can mix `and` with `or` at one level. This
	// screen shows one joiner per group, so a mixed level cannot be drawn.
	const mixed = () => fromApiTree(wire(['or', 'and']))
	const nestedMixed = (): ApiRuleGroup => ({
		conjunctions: ['and'],
		conditions: [{ ...leaf, config: {} }, wire(['or', 'and'])],
	})

	it('shows the first stored joiner and writes the group back as it was stored', () => {
		// Re-expanding the shown token across every gap turned `A or B and C` into
		// `A or B or C`, a wider membership, on any save at all including a rename.
		const tree = mixed()
		expect(tree.conjunction).toBe('or')
		expect(tree.conditions).toHaveLength(3)
		expect(toApiTree(tree).conjunctions).toEqual(['or', 'and'])
	})

	it('flattens the group once the user moves its joiner', () => {
		expect(toApiTree({ ...mixed(), conjunction: 'and' }).conjunctions).toEqual([
			'and',
			'and',
		])
	})

	it('does not restore the stored joiners when the control is moved back', () => {
		// toApiTree reads "the user acted" off `stored[0] !== conjunction`, which a
		// round trip undoes: away to `and`, back to `or`, and the comparison is
		// equal again. forgetMovedJoiners runs on the move, so the first one counts.
		const moved: RuleGroup = { ...mixed(), conjunction: 'and' }
		forgetMovedJoiners(moved)
		expect(toApiTree({ ...moved, conjunction: 'or' }).conjunctions).toEqual([
			'or',
			'or',
		])
	})

	it('leaves a group alone while its joiner has not moved', () => {
		const tree = mixed()
		forgetMovedJoiners(tree)
		expect(toApiTree(tree).conjunctions).toEqual(['or', 'and'])
	})

	it('reaches a nested group the move was made in', () => {
		const outer = fromApiTree(nestedMixed())
		const inner: RuleGroup = {
			...(outer.conditions[1] as RuleGroup),
			conjunction: 'and',
		}
		forgetMovedJoiners({ ...outer, conditions: [outer.conditions[0], inner] })
		expect(inner.storedConjunctions).toBeUndefined()
	})

	it('flattens the group once a row is added or removed', () => {
		// Each stored joiner sat between one pair of rows. Change the rows and the
		// array describes nothing, so the shown token is all that is left.
		const tree = mixed()
		expect(
			toApiTree({ ...tree, conditions: tree.conditions.slice(0, 2) })
				.conjunctions
		).toEqual(['or'])
		expect(
			toApiTree({ ...tree, conditions: [...tree.conditions, leaf] })
				.conjunctions
		).toEqual(['or', 'or', 'or'])
	})

	it('reports a mixed level, at the root or nested, so the screen can say so', () => {
		expect(hasMixedConjunctions(mixed())).toBe(true)
		expect(hasMixedConjunctions(fromApiTree(nestedMixed()))).toBe(true)
	})

	it('reports nothing mixed for a group that repeats one joiner', () => {
		expect(hasMixedConjunctions(fromApiTree(wire(['or', 'or'])))).toBe(false)
		expect(hasMixedConjunctions({ conjunction: 'and', conditions: [] })).toBe(
			false
		)
	})
})

/**
 * A `reqd` field with nothing stored reads as unset, not as its declared
 * default, which is exactly what RuleConditionField draws. A cascade hanging off
 * a value nobody can see selected is worse than one extra click, so Student with
 * nothing stored shows one select rather than three.
 */
describe('the fields a rule shows', () => {
	test.each([
		{ type: 'Student', given: 'nothing stored', shows: 'student_scope' },
		{ type: 'Student', given: 'student_scope=All', shows: 'student_scope' },
		{
			type: 'Student',
			given: 'student_scope=Enrolled',
			shows: 'student_scope payment_filter enrolled_in',
		},
		{
			type: 'Student',
			given: 'student_scope=Enrolled, enrolled_in=Batches',
			shows: 'student_scope payment_filter enrolled_in batches',
		},
		{
			type: 'Student',
			given: 'student_scope=Enrolled, enrolled_in=Both',
			shows: 'student_scope payment_filter enrolled_in batches courses',
		},
		{
			type: 'Staff',
			given: 'staff_kind=Platform role',
			shows: 'staff_kind platform_roles',
		},
		{
			type: 'Staff',
			given: 'staff_kind=Assigned on',
			shows: 'staff_kind assigned_as assigned_scope',
		},
		{
			type: 'Staff',
			given: 'staff_kind=Assigned on, assigned_scope=Both',
			shows:
				'staff_kind assigned_as assigned_scope staff_scope_batches staff_scope_courses',
		},
	])('$type with $given shows $shows', ({ type, given, shows }) => {
		expect(names(visibleFieldsOf(ruleTypes, ruleWith(type, given)))).toBe(shows)
	})

	it('shows nothing for a rule type the declaration does not cover', () => {
		expect(visibleFieldsOf(ruleTypes, ruleWith('Retired', ''))).toEqual([])
		expect(visibleFieldsOf([], ruleWith('Staff', 'staff_kind=All'))).toEqual([])
	})
})

/**
 * The single-value form of depends_on, which no LMS rule type uses today: a
 * provider reaches for it when one choice of a Select is the only one a field
 * applies to. `value_in` is the set form the cascades above are declared with.
 */
describe('depends_on naming one value', () => {
	const LEGACY: ProviderRuleType[] = [
		{
			type: 'Legacy staff',
			fields: [
				{
					fieldname: 'staff_role',
					fieldtype: 'Select',
					label: 'Staff role',
					options: ['Instructor', 'Moderator'],
					default: 'Instructor',
				},
				{
					fieldname: 'scope_courses',
					fieldtype: 'MultiSelect',
					label: 'Courses',
					options: 'LMS Course',
					reqd: 1,
					depends_on: { field: 'staff_role', value: 'Instructor' },
				},
			],
		},
	]
	const shownFor = (given: string) =>
		names(visibleFieldsOf(LEGACY, ruleWith('Legacy staff', given)))

	it('shows the field while the one it names holds the one value it names', () => {
		expect(shownFor('staff_role=Instructor')).toBe('staff_role scope_courses')
		expect(shownFor('staff_role=Moderator')).toBe('staff_role')
	})

	it('reads an unstored value off the declared default, since this one is not reqd', () => {
		// The counterpart to the reqd rule above: a control the row draws filled in
		// is judged by what it draws.
		expect(shownFor('nothing stored')).toBe('staff_role scope_courses')
	})

	it('does not judge a hidden reqd field, on screen or on save', () => {
		const rule = ruleWith('Legacy staff', 'staff_role=Moderator')
		expect(hasRequiredFields(LEGACY, rule)).toBe(true)
		expect(hasRequiredFields(LEGACY, ruleWith('Legacy staff', ''))).toBe(false)
	})
})

describe('the rule that is written back', () => {
	const assigned = (over: Partial<RavenMemberRule> = {}): RavenMemberRule => ({
		rule_type: 'Staff',
		status: 'Active',
		staff_kind: 'Assigned on',
		assigned_as: 'Instructor',
		assigned_scope: 'Courses',
		staff_scope_courses: ['C1'],
		...over,
	})

	it('drops a hidden field, and the field that hung off it', () => {
		// To a fixed point: one pass judged every field against the pre-edit rule,
		// so assigned_scope still read "Courses" while it was itself being deleted,
		// and staff_scope_courses survived a switch to a rule naming all staff.
		const written = withoutHiddenFields(
			ruleTypes,
			assigned({ staff_kind: 'All' })
		)
		expect(written).toEqual({
			rule_type: 'Staff',
			status: 'Active',
			staff_kind: 'All',
		})
	})

	it('keeps every field the row still shows', () => {
		expect(withoutHiddenFields(ruleTypes, assigned())).toEqual(assigned())
	})

	it('leaves alone a key the declaration says nothing about', () => {
		// Another provider's, or one this UI has not been taught. Not ours to drop.
		const foreign = assigned({ something_else: 'kept' })
		expect(withoutHiddenFields(ruleTypes, foreign).something_else).toBe('kept')
	})

	it('does not mutate the rule it was given', () => {
		const before = assigned({ staff_kind: 'All' })
		withoutHiddenFields(ruleTypes, before)
		expect(before.staff_scope_courses).toEqual(['C1'])
	})
})

describe('whether a rule can be saved', () => {
	it('is incomplete while a shown reqd field is empty', () => {
		expect(hasRequiredFields(ruleTypes, ruleWith('Staff', ''))).toBe(false)
		expect(
			hasRequiredFields(ruleTypes, {
				rule_type: 'Staff',
				status: 'Active',
				staff_kind: 'Platform role',
				platform_roles: [],
			})
		).toBe(false)
	})

	it('is complete once every shown reqd field is filled', () => {
		expect(
			hasRequiredFields(ruleTypes, {
				rule_type: 'Staff',
				status: 'Active',
				staff_kind: 'Platform role',
				platform_roles: ['Moderator'],
			})
		).toBe(true)
	})

	it('is never complete for a type nothing has declared', () => {
		// `fieldsOf` is [] for an unknown type, and `[].every()` is true, so a rule
		// nothing validated would otherwise read as ready to save.
		expect(hasRequiredFields(ruleTypes, ruleWith('Retired', ''))).toBe(false)
		expect(hasRequiredFields([], ruleWith('Staff', 'staff_kind=All'))).toBe(
			false
		)
	})
})

/**
 * A rule carrying a key its type does not declare is old-vocabulary data, which
 * the screen must tell the user to remove rather than to finish. Checked as well
 * as the type name, because a `staff_role` rule still names the declared type
 * "Staff": on the name alone it reads as merely unfinished, and completing one
 * produces a rule naming different people.
 */
describe('a rule written against an older vocabulary', () => {
	it('is undeclared when it carries a config key its type does not declare', () => {
		expect(
			hasUndeclaredFields(ruleTypes, {
				rule_type: 'Staff',
				status: 'Active',
				staff_kind: 'All',
				staff_role: 'Instructor',
			})
		).toBe(true)
	})

	it('is undeclared when the type itself is gone', () => {
		expect(
			hasUndeclaredFields(ruleTypes, {
				rule_type: 'Students of Courses',
				status: 'Active',
				courses: ['C1'],
			})
		).toBe(true)
	})

	it('is not undeclared for the wire keys every rule carries', () => {
		expect(
			hasUndeclaredFields(ruleTypes, {
				name: 'RMR-1',
				label: 'Staff',
				provider: 'LMS',
				rule_type: 'Staff',
				status: 'Active',
				matches: '3 people',
				staff_kind: 'All',
			})
		).toBe(false)
	})

	it('ignores a key that is present but unset', () => {
		expect(
			hasUndeclaredFields(ruleTypes, {
				rule_type: 'Staff',
				status: 'Active',
				staff_kind: 'All',
				staff_role: undefined,
			})
		).toBe(false)
	})
})

/**
 * The two bands a condition row draws, which replaced a fixed
 * `Field · Operator · Value` triple: a cascade declares as many selects as it has
 * levels, and the third onwards read as leftovers under the row.
 */
describe('the bands a condition row draws', () => {
	const bands = (ruleType: string, rule?: RavenMemberRule) => {
		const slots = conditionSlots(ruleTypes, ruleType, rule)
		return { inline: names(slots.inline), blocks: names(slots.blocks) }
	}

	it('puts every select on one line and every multiselect on a row below', () => {
		expect(
			bands(
				'Student',
				ruleWith('Student', 'student_scope=Enrolled, enrolled_in=Both')
			)
		).toEqual({
			inline: 'student_scope payment_filter enrolled_in',
			blocks: 'batches courses',
		})
	})

	it('keeps a static multiselect out of the inline band too', () => {
		// platform_roles is a multiselect by value even though its options are
		// declared like a Select's. Banding on "is it a Select" would put its chips,
		// which reflow as you pick, back beside the fixed-width controls.
		expect(
			bands('Staff', ruleWith('Staff', 'staff_kind=Platform role'))
		).toEqual({ inline: 'staff_kind', blocks: 'platform_roles' })
	})

	it('bands every visible field, dropping none', () => {
		// The old triple could hold two fields and put the rest in a third place. A
		// field outside both bands is one the reader cannot correct.
		const rule = ruleWith(
			'Staff',
			'staff_kind=Assigned on, assigned_scope=Both'
		)
		const slots = conditionSlots(ruleTypes, 'Staff', rule)
		expect(names([...slots.inline, ...slots.blocks])).toBe(
			names(visibleFieldsOf(ruleTypes, rule))
		)
	})

	it('falls back to every declared field when there is no rule yet', () => {
		// The type picker asks what a rule type looks like before one exists to
		// read a cascade off.
		expect(bands('Student')).toEqual({
			inline: 'student_scope payment_filter enrolled_in',
			blocks: 'batches courses',
		})
	})

	it('is empty for an undeclared type and while the declaration is unloaded', () => {
		expect(conditionSlots(ruleTypes, 'Retired')).toEqual({
			inline: [],
			blocks: [],
		})
		expect(conditionSlots([], 'Staff')).toEqual({ inline: [], blocks: [] })
	})
})

describe('the name a row gets, having no name box', () => {
	it('names the rule after its type and its first answer', () => {
		// The first inline field, which in a cascade decides everything below it.
		expect(
			autoRuleLabel(ruleTypes, ruleWith('Student', 'student_scope=Enrolled'))
		).toBe('Student · Enrolled')
	})

	it('never returns empty, so the backend name check always passes', () => {
		expect(autoRuleLabel(ruleTypes, ruleWith('Staff', ''))).toBe('Staff')
		// A stored rule of a type the declaration no longer covers still has to save.
		expect(autoRuleLabel(ruleTypes, ruleWith('Retired', ''))).toBe('Retired')
		expect(autoRuleLabel([], ruleWith('Staff', 'staff_kind=All'))).toBe('Staff')
	})
})

describe('the way out of settings and into Raven', () => {
	const entry = (target: Parameters<typeof openInRavenOptions>[0]) =>
		openInRavenOptions(target)[0]

	test.each([
		{ workspace: 'ws-general', channel: undefined, href: '/raven/ws-general' },
		{
			workspace: 'ws-general',
			channel: 'ch-announce',
			href: '/raven/ws-general/ch-announce',
		},
		// Raven's SPA is mounted at /raven and nests its channel route under the
		// workspace, so a channel link needs both ids, escaped rather than pasted.
		{ workspace: 'a b', channel: 'c/d', href: '/raven/a%20b/c%2Fd' },
	])('workspace $workspace channel $channel links to $href', (row) => {
		const target =
			row.channel === undefined
				? { ravenWorkspace: row.workspace }
				: { ravenWorkspace: row.workspace, ravenChannel: row.channel }
		expect(ravenHref(target)).toBe(row.href)
	})

	test.each([
		{ why: 'a workspace never adopted', target: { ravenWorkspace: null } },
		{ why: 'a mapping with no Raven record', target: {} },
		{
			why: 'a record that is gone',
			target: { ravenWorkspace: 'ws-general', stale: true },
		},
		{
			// Distinct from the workspace case: the channel key is present but null,
			// which means a channel was intended and is not there.
			why: 'a channel whose Raven id is missing',
			target: { ravenWorkspace: 'ws-general', ravenChannel: null },
		},
	])("offers nothing for $why, rather than Raven's own 404", ({ target }) => {
		expect(openInRavenOptions(target)).toEqual([])
	})

	it('opens a new tab through openExternal, with the opener handle closed off', () => {
		open.mockClear()
		expect(entry({ ravenWorkspace: 'ws-general' })).toMatchObject({
			label: 'Open in Raven',
			icon: 'lucide-external-link',
		})

		entry({ ravenWorkspace: 'ws-general' }).onClick()
		// A tab rather than a navigation, so the unsaved draft either detail page
		// may be holding survives. `noopener` severs window.opener.
		expect(open).toHaveBeenCalledWith('/raven/ws-general', '_blank', 'noopener')
	})
})

/**
 * A constant here that no component reads is not a limit, it is a comment that
 * looks like one: the user reads a guard while the only thing enforcing it is
 * the backend, after Save. Tests are excluded from the scan on purpose, since a
 * constant asserted only by a test of itself is the case this is here to catch.
 */
describe('the Raven UI constants', () => {
	const CONSTANTS = join(SRC, 'utils', 'raven', 'constants.ts')
	const EXTENSIONS = ['.vue', '.ts', '.js']

	const sourceFiles = (dir: string): string[] => {
		const found: string[] = []
		for (const entry of readdirSync(dir)) {
			if (entry === 'node_modules' || entry === 'tests') continue
			const path = join(dir, entry)
			if (statSync(path).isDirectory()) found.push(...sourceFiles(path))
			else if (EXTENSIONS.some((extension) => entry.endsWith(extension)))
				found.push(path)
		}
		return found
	}

	it('are every one of them read by something outside the module', () => {
		const declared = [
			...readFileSync(CONSTANTS, 'utf8').matchAll(/export const ([A-Z0-9_]+)/g),
		].map((match) => match[1] ?? '')
		const consumers = sourceFiles(SRC).filter((file) => file !== CONSTANTS)
		// The walk found the tree, so an empty `unused` below means something.
		expect(declared.length).toBeGreaterThan(0)
		expect(consumers.length).toBeGreaterThan(100)

		const sources = consumers.map((file) => readFileSync(file, 'utf8'))
		expect(
			declared.filter(
				(name) =>
					!sources.some((source) => new RegExp(`\\b${name}\\b`).test(source))
			)
		).toEqual([])
	})
})
