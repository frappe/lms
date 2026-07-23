/**
 * RulesPanel.vue's rule-validity guard: a rule is savable only once it is named,
 * complete and not a duplicate. A *persisted* invalid rule blocks the whole save,
 * because the backend replaces the rule list wholesale and would delete it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RulesPanel from '@/components/Settings/Raven/RulesPanel.vue'
import type { RavenMemberRule } from '@/types'

// The panel reads the LMS provider declaration for `reqd` (incomplete rules) and for
// the defaults a blank rule starts with.
// `providers`/`loading` are swapped per test to stand in for a declaration that has
// not landed (or never will) — see the "no declaration" describe.
const decl = vi.hoisted(() => ({
	loading: false,
	providers: [
		{
			name: 'LMS',
			label: 'Frappe Learning',
			rule_types: [
				{
					type: 'All Enrolled Students',
					fields: [
						{
							fieldname: 'payment_filter',
							fieldtype: 'Select',
							label: 'Payment',
							options: ['Any', 'Paid', 'Free'],
							default: 'Any',
						},
					],
				},
				{
					type: 'Students of Courses',
					fields: [
						{
							fieldname: 'courses',
							fieldtype: 'MultiSelect',
							label: 'Courses',
							options: 'LMS Course',
							reqd: 1,
						},
					],
				},
				{
					type: 'Staff',
					fields: [
						{
							fieldname: 'staff_role',
							fieldtype: 'Select',
							label: 'Staff role',
							options: ['Instructor', 'Evaluator', 'Mentor', 'Any'],
							reqd: 1,
						},
					],
				},
			],
		},
	],
}))

vi.mock('frappe-ui', () => ({
	createResource: () => ({
		get data() {
			return decl.providers
		},
		get loading() {
			return decl.loading
		},
	}),
	Badge: { props: ['label'], template: `<span>{{ label }}</span>` },
	Button: {
		props: ['variant', 'ariaLabel', 'disabled'],
		// Declaring `emits` matters: without it `@click` also falls through as a native
		// listener, double-firing addRule() per click (real frappe-ui Button declares it).
		emits: ['click'],
		template: `<button :aria-label="ariaLabel" :disabled="disabled" @click="$emit('click')"><slot name="prefix" /><slot name="icon" /><slot /></button>`,
	},
	Dropdown: {
		name: 'Dropdown',
		props: ['options', 'placement'],
		template: `<span class="dropdown"><slot /></span>`,
	},
	TextInput: {
		props: ['modelValue', 'placeholder', 'ariaLabel', 'disabled'],
		template: `<input :placeholder="placeholder" :value="modelValue" :disabled="disabled" @input="$emit('update:modelValue', $event.target.value)" />`,
	},
}))

vi.mock('lucide-vue-next', () => ({
	Plus: { template: `<span class="icon-plus" />` },
	MoreHorizontal: { template: `<span class="icon-more" />` },
	Trash2: { template: `<span class="icon-trash" />` },
	AlertTriangle: { template: `<span data-testid="alert-triangle" />` },
	Ban: { template: `<span class="icon-ban" />` },
	CircleCheck: { template: `<span class="icon-circle-check" />` },
}))

vi.mock('@/components/Settings/Raven/RuleEditor.vue', () => ({
	default: {
		name: 'RuleEditor',
		props: ['modelValue', 'disabled'],
		template: `<div class="rule-editor" />`,
	},
}))

vi.stubGlobal('__', (s: string) => s)

// Warning copy, matched on a stable fragment rather than the whole sentence.
const DECLARED = decl.providers
afterEach(() => {
	decl.providers = DECLARED
	decl.loading = false
})

const UNNAMED = 'Name this rule'
const INCOMPLETE = 'Finish this rule'
const DUPLICATE = 'Matches another rule above'
const BLOCKED = 'not being saved'

const allEnrolled = (over: Partial<RavenMemberRule> = {}): RavenMemberRule => ({
	name: 'RMR-1',
	label: 'All enrolled',
	rule_type: 'All Enrolled Students',
	status: 'Active',
	payment_filter: 'Any',
	...over,
})

const staffRule = (over: Partial<RavenMemberRule> = {}): RavenMemberRule => ({
	name: 'RMR-2',
	label: 'Instructors',
	rule_type: 'Staff',
	status: 'Active',
	staff_role: 'Instructor',
	...over,
})

function mountPanel(rules: RavenMemberRule[]) {
	return mount(RulesPanel, {
		props: {
			title: 'Channel rules',
			rules,
			noActiveRulesMessage: 'No active rules',
		},
		global: { mocks: { __: (s: string) => s } },
	})
}

const addButton = (w: ReturnType<typeof mountPanel>) =>
	w.findAll('button').filter((b) => b.text() === 'Add rule')[0]

const lastPersisted = (w: ReturnType<typeof mountPanel>) => {
	const events = w.emitted('persist')!
	return events[events.length - 1][0] as RavenMemberRule[]
}

interface MenuOption {
	label: string
	onClick: () => void
}

// The Dropdown stub doesn't render its options, so drive them directly.
const menuOf = (w: ReturnType<typeof mountPanel>, index = 0) =>
	w
		.findAllComponents({ name: 'Dropdown' })
		[index].props('options') as MenuOption[]

describe('RulesPanel — a rule must be named to be saved', () => {
	it('withholds a freshly added rule and asks for a name', async () => {
		const w = mountPanel([])
		await w.find('.flex.p-4').trigger('click') // empty-state "Add rule" box

		expect(w.emitted('persist')).toBeUndefined()
		expect(w.text()).toContain(UNNAMED)
	})

	it('persists the rule once it is named', async () => {
		const w = mountPanel([])
		await w.find('.flex.p-4').trigger('click')

		await w.find('input').setValue('Cohort cap')
		await w.find('.rounded-lg').trigger('focusout')

		const last = lastPersisted(w)
		expect(last).toHaveLength(1)
		expect(last[0].label).toBe('Cohort cap')
		expect(w.text()).not.toContain(UNNAMED)
	})

	it('drops the label back to unnamed and stops saving it again', async () => {
		const w = mountPanel([])
		await w.find('.flex.p-4').trigger('click')
		await w.find('input').setValue('Cohort cap')
		await w.find('.rounded-lg').trigger('focusout')
		const emittedBefore = w.emitted('persist')!.length

		await w.find('input').setValue('   ')
		await w.find('.rounded-lg').trigger('focusout')

		// Whitespace is not a name; the row goes back to being withheld, and the
		// payload it left behind is not re-sent.
		expect(w.emitted('persist')!.length).toBe(emittedBefore)
		expect(w.text()).toContain(UNNAMED)
	})
})

describe('RulesPanel — a persisted invalid rule blocks the save', () => {
	it('emits nothing at all rather than dropping the saved rule', async () => {
		const w = mountPanel([allEnrolled(), staffRule()])

		// Blank the saved rule's name. Withholding it from the payload would make the
		// backend's full-list replace hard-delete it, so nothing may be emitted.
		await w.findAll('input')[0].setValue('')
		await w.findAll('.rounded-lg')[0].trigger('focusout')

		expect(w.emitted('persist')).toBeUndefined()
	})

	it('keeps blocking while a sibling rule is edited', async () => {
		const w = mountPanel([allEnrolled(), staffRule()])
		await w.findAll('input')[0].setValue('')
		await w.findAll('.rounded-lg')[0].trigger('focusout')

		const editors = w.findAllComponents({ name: 'RuleEditor' })
		await editors[1].vm.$emit('update:modelValue', {
			...staffRule(),
			staff_role: 'Mentor',
		})
		await w.findAll('.rounded-lg')[1].trigger('focusout')

		expect(w.emitted('persist')).toBeUndefined()
	})

	it('says on the section that changes are not being saved', async () => {
		const w = mountPanel([allEnrolled(), staffRule()])
		expect(w.text()).not.toContain(BLOCKED)

		await w.findAll('input')[0].setValue('')
		await w.findAll('.rounded-lg')[0].trigger('focusout')

		expect(w.text()).toContain(BLOCKED)
	})

	it('resumes saving once the saved rule is named again', async () => {
		const w = mountPanel([allEnrolled(), staffRule()])
		await w.findAll('input')[0].setValue('')
		await w.findAll('.rounded-lg')[0].trigger('focusout')

		await w.findAll('input')[0].setValue('Everyone enrolled')
		await w.findAll('.rounded-lg')[0].trigger('focusout')

		const last = lastPersisted(w)
		expect(last).toHaveLength(2)
		expect(last[0].label).toBe('Everyone enrolled')
		expect(w.text()).not.toContain(BLOCKED)
	})

	it('does not block on an unnamed rule that was never saved', async () => {
		const w = mountPanel([allEnrolled()])
		await addButton(w).trigger('click')

		// The new card is withheld, not blocking: the saved rule still round-trips.
		expect(w.text()).not.toContain(BLOCKED)
		const editors = w.findAllComponents({ name: 'RuleEditor' })
		await editors[1].vm.$emit('update:modelValue', {
			rule_type: 'Staff',
			status: 'Active',
			staff_role: 'Instructor',
			label: 'Instructors',
		})
		await w.findAll('.rounded-lg')[1].trigger('focusout')

		expect(lastPersisted(w)).toHaveLength(2)
	})
})

describe('RulesPanel — each invalid reason has its own warning', () => {
	it('asks for a name on an unnamed rule', async () => {
		const w = mountPanel([])
		await w.find('.flex.p-4').trigger('click')

		expect(w.text()).toContain(UNNAMED)
		expect(w.text()).not.toContain(INCOMPLETE)
		expect(w.text()).not.toContain(DUPLICATE)
	})

	it('asks for criteria on a named but incomplete rule', () => {
		const w = mountPanel([
			allEnrolled({ rule_type: 'Students of Courses', label: 'Cohort' }),
		])

		expect(w.text()).toContain(INCOMPLETE)
		expect(w.text()).not.toContain(UNNAMED)
	})

	it('flags the second of two rules with identical criteria', async () => {
		const w = mountPanel([allEnrolled()])
		await addButton(w).trigger('click')

		// Same criteria as the saved rule, different label — labels are cosmetic, so
		// the backend's duplicate check still rejects it.
		const editors = w.findAllComponents({ name: 'RuleEditor' })
		await editors[1].vm.$emit('update:modelValue', {
			rule_type: 'All Enrolled Students',
			status: 'Active',
			payment_filter: 'Any',
			label: 'Everyone again',
		})
		await w.findAll('.rounded-lg')[1].trigger('focusout')

		expect(w.text()).toContain(DUPLICATE)
		expect(w.emitted('persist')).toBeUndefined()
	})

	it('clears the duplicate warning once the card is made distinct', async () => {
		const w = mountPanel([allEnrolled()])
		await addButton(w).trigger('click')

		const editors = w.findAllComponents({ name: 'RuleEditor' })
		await editors[1].vm.$emit('update:modelValue', {
			rule_type: 'Staff',
			status: 'Active',
			staff_role: 'Instructor',
			label: 'Instructors',
		})
		await w.findAll('.rounded-lg')[1].trigger('focusout')

		expect(lastPersisted(w)).toHaveLength(2)
		expect(w.find('[data-testid="alert-triangle"]').exists()).toBe(false)
	})
})

describe('RulesPanel — Add rule waits for the open card', () => {
	it('disables Add rule while a card is invalid and re-enables it once named', async () => {
		// A Staff rule, so the blank card added below is not also a duplicate of it.
		const w = mountPanel([staffRule()])
		expect(addButton(w).attributes('disabled')).toBeUndefined()

		await addButton(w).trigger('click')
		expect(addButton(w).attributes('disabled')).toBeDefined()

		await w.findAll('input')[1].setValue('Cohort cap')
		await w.findAll('.rounded-lg')[1].trigger('focusout')

		expect(addButton(w).attributes('disabled')).toBeUndefined()
	})

	it('does not add a second card while the first is unnamed', async () => {
		const w = mountPanel([allEnrolled()])
		await addButton(w).trigger('click')
		await addButton(w).trigger('click')

		expect(w.findAllComponents({ name: 'RuleEditor' })).toHaveLength(2)
	})
})

describe('RulesPanel — enable / disable a rule', () => {
	// Adapted for D6: a saved rule's status no longer rides the full-list replace,
	// so these assert `set-status` where they used to assert `persist`.
	it('disabling a saved rule asks for a status change, not a rule save', async () => {
		const w = mountPanel([allEnrolled()])
		const disable = menuOf(w).find((o) => o.label === 'Disable')
		expect(disable).toBeTruthy()

		disable!.onClick()
		await w.vm.$nextTick()

		expect(w.emitted('set-status')![0]).toEqual(['RMR-1', 'Paused'])
		expect(w.emitted('persist')).toBeUndefined()
	})

	it('offers Enable once disabled, and asks for Active', async () => {
		const w = mountPanel([allEnrolled({ status: 'Paused' })])
		const enable = menuOf(w).find((o) => o.label === 'Enable')
		expect(enable).toBeTruthy()
		expect(menuOf(w).some((o) => o.label === 'Disable')).toBe(false)

		enable!.onClick()
		await w.vm.$nextTick()

		expect(w.emitted('set-status')![0]).toEqual(['RMR-1', 'Active'])
		expect(w.emitted('persist')).toBeUndefined()
	})

	it('enables a rule that is both Paused and unnamed, which no save could reach', async () => {
		// The deadlock: unnamed blocks every emit (D1) and Paused locks the name field,
		// so routing Enable through the save path would strand the card for good.
		const w = mountPanel([allEnrolled({ status: 'Paused', label: '' })])

		menuOf(w)
			.find((o) => o.label === 'Enable')!
			.onClick()
		await w.vm.$nextTick()

		expect(w.emitted('set-status')![0]).toEqual(['RMR-1', 'Active'])
		expect(w.emitted('persist')).toBeUndefined()
		// Unlocked locally too, so the name can now be typed.
		expect(w.findAll('input')[0].attributes('disabled')).toBeUndefined()
	})

	it('keeps a never-saved rule status local, with nothing to tell the server', async () => {
		const w = mountPanel([staffRule()])
		await addButton(w).trigger('click')
		await w.findAll('input')[1].setValue('Cohort cap')
		await w.findAll('.rounded-lg')[1].trigger('focusout')

		menuOf(w, 1)
			.find((o) => o.label === 'Disable')!
			.onClick()
		await w.vm.$nextTick()

		expect(w.emitted('set-status')).toBeUndefined()
		expect(lastPersisted(w)[1].status).toBe('Paused')
	})

	it('warns that nothing syncs once the only rule is disabled', async () => {
		const w = mountPanel([allEnrolled()])
		expect(w.text()).not.toContain('No active rules')

		menuOf(w)
			.find((o) => o.label === 'Disable')!
			.onClick()
		await w.vm.$nextTick()

		expect(w.text()).toContain('No active rules')
	})
})

describe('RulesPanel — a disabled rule is frozen', () => {
	const card = (w: ReturnType<typeof mountPanel>, index = 0) =>
		w.findAll('.rounded-lg')[index]
	const editorOf = (w: ReturnType<typeof mountPanel>, index = 0) =>
		w.findAllComponents({ name: 'RuleEditor' })[index]
	const HINT = 'Enable it to edit'

	it('locks every input on the card instead of badging it', () => {
		const w = mountPanel([allEnrolled({ status: 'Paused' })])

		expect(w.text()).not.toContain('Disabled')
		expect(w.findAll('input')[0].attributes('disabled')).toBeDefined()
		expect(editorOf(w).props('disabled')).toBe(true)
		expect(card(w).classes()).toContain('opacity-60')
	})

	it('leaves an active card editable', () => {
		const w = mountPanel([allEnrolled()])

		expect(w.findAll('input')[0].attributes('disabled')).toBeUndefined()
		expect(editorOf(w).props('disabled')).toBe(false)
		expect(card(w).classes()).not.toContain('opacity-60')
	})

	it('says how to unlock when the card is double-clicked', async () => {
		const w = mountPanel([allEnrolled({ status: 'Paused' })])
		expect(w.text()).not.toContain(HINT)

		await card(w).trigger('dblclick')

		expect(w.text()).toContain(HINT)
	})

	it('stays quiet when an active card is double-clicked', async () => {
		const w = mountPanel([allEnrolled()])

		await card(w).trigger('dblclick')

		expect(w.text()).not.toContain(HINT)
	})

	it('drops the hint again once the rule is enabled', async () => {
		const w = mountPanel([allEnrolled({ status: 'Paused' })])
		await card(w).trigger('dblclick')

		menuOf(w)
			.find((o) => o.label === 'Enable')!
			.onClick()
		await w.vm.$nextTick()

		expect(w.text()).not.toContain(HINT)
	})

	it('removing a saved invalid rule unblocks the save', async () => {
		const w = mountPanel([allEnrolled({ label: '' }), staffRule()])
		expect(w.text()).toContain(BLOCKED)

		menuOf(w)
			.find((o) => o.label === 'Remove')!
			.onClick()
		await w.vm.$nextTick()

		const last = lastPersisted(w)
		expect(last).toHaveLength(1)
		expect(last[0].name).toBe('RMR-2')
		expect(w.text()).not.toContain(BLOCKED)
	})
})

describe('RulesPanel — a rule from another provider is not ours to touch', () => {
	// `update_*` replaces the whole rule list, so a foreign rule missing from — or
	// rewritten in — the payload is silently corrupted or deleted.
	const foreignRule = (): RavenMemberRule => ({
		name: 'RMR-9',
		provider: 'Acme',
		rule_type: 'Widget Owners',
		status: 'Active',
		widget_tier: 'gold',
	})

	it('sends it back byte-for-byte when a sibling rule is saved', async () => {
		const w = mountPanel([allEnrolled(), foreignRule()])

		await w.findAll('input')[0].setValue('Everyone enrolled')
		await w.findAll('.rounded-lg')[0].trigger('focusout')

		const last = lastPersisted(w)
		expect(last).toHaveLength(2)
		expect(last[0].label).toBe('Everyone enrolled')
		expect(last[1]).toEqual(foreignRule())
	})

	it('badges it with its owner and freezes the card', () => {
		const w = mountPanel([allEnrolled(), foreignRule()])

		expect(w.text()).toContain('Managed by Acme')
		expect(w.findAll('input')[1].attributes('disabled')).toBeDefined()
		expect(
			w.findAllComponents({ name: 'RuleEditor' })[1].props('disabled')
		).toBe(true)
		expect(w.findAll('.rounded-lg')[1].classes()).toContain('opacity-60')
	})

	it('offers no actions on it — its own app is where it is edited', () => {
		const w = mountPanel([allEnrolled(), foreignRule()])

		expect(w.findAllComponents({ name: 'Dropdown' })).toHaveLength(1)
	})

	it('says nothing about how to unlock it when double-clicked', async () => {
		const w = mountPanel([allEnrolled(), foreignRule()])

		await w.findAll('.rounded-lg')[1].trigger('dblclick')

		expect(w.text()).not.toContain('Enable it to edit')
	})

	it('never judges it: an unlabelled foreign rule blocks nothing', async () => {
		const w = mountPanel([allEnrolled(), foreignRule()])

		expect(w.text()).not.toContain(UNNAMED)
		expect(w.text()).not.toContain(INCOMPLETE)
		expect(w.text()).not.toContain(BLOCKED)
		expect(addButton(w).attributes('disabled')).toBeUndefined()
	})
})

describe('RulesPanel — Disable is Any (OR) only', () => {
	const menuLabels = (w: ReturnType<typeof mount>) =>
		(
			w.findAllComponents({ name: 'Dropdown' })[0].props('options') as {
				label: string
			}[]
		).map((o) => o.label)

	it('hides Disable under All (AND), where dropping a rule would widen the population', () => {
		const w = mount(RulesPanel, {
			props: {
				title: 'Workspace rules',
				rules: [allEnrolled()],
				combinator: 'All (AND)',
				noActiveRulesMessage: 'No active rules',
			},
			global: { mocks: { __: (s: string) => s } },
		})
		expect(menuLabels(w)).not.toContain('Disable')
		expect(menuLabels(w)).toContain('Remove')
	})

	it('still offers Enable under All (AND), so a rule disabled under OR is never stranded', () => {
		const w = mount(RulesPanel, {
			props: {
				title: 'Workspace rules',
				rules: [allEnrolled({ status: 'Paused' })],
				combinator: 'All (AND)',
				noActiveRulesMessage: 'No active rules',
			},
			global: { mocks: { __: (s: string) => s } },
		})
		expect(menuLabels(w)).toContain('Enable')
	})
})

describe('RulesPanel — disabled rules under All (AND)', () => {
	const mountWith = (rules: RavenMemberRule[], combinator: string) =>
		mount(RulesPanel, {
			props: {
				title: 'Workspace rules',
				rules,
				combinator,
				noActiveRulesMessage: 'No active rules',
			},
			global: { mocks: { __: (s: string) => s } },
		})

	const NOTE = 'left out of All (AND)'

	it('warns that a disabled rule widens an AND mapping', () => {
		const w = mountWith(
			[allEnrolled(), staffRule({ status: 'Paused' })],
			'All (AND)'
		)
		expect(w.text()).toContain(NOTE)
	})

	it('stays quiet under Any (OR), where a disabled rule only narrows', () => {
		const w = mountWith(
			[allEnrolled(), staffRule({ status: 'Paused' })],
			'Any (OR)'
		)
		expect(w.text()).not.toContain(NOTE)
	})

	it('stays quiet under AND when every rule is active', () => {
		const w = mountWith([allEnrolled()], 'All (AND)')
		expect(w.text()).not.toContain(NOTE)
	})
})

describe('RulesPanel — a refetch must not destroy unsaved work', () => {
	// Every save round-trips: the parent reloads the mapping and hands down a fresh
	// `rules` array. Rebuilding the draft from it wholesale threw away work in progress.
	const editors = (w: ReturnType<typeof mountPanel>) =>
		w.findAllComponents({ name: 'RuleEditor' })
	const labelOf = (w: ReturnType<typeof mountPanel>, index = 0) =>
		(w.findAll('input')[index].element as HTMLInputElement).value

	it('keeps a card the server has never heard of', async () => {
		const w = mountPanel([staffRule()])
		await addButton(w).trigger('click')
		expect(editors(w)).toHaveLength(2)

		await w.setProps({ rules: [staffRule()] })

		expect(editors(w)).toHaveLength(2)
	})

	it('keeps a named new card while its own save is still in flight', async () => {
		const w = mountPanel([staffRule()])
		await addButton(w).trigger('click')
		await w.findAll('input')[1].setValue('Cohort cap')
		await w.findAll('.rounded-lg')[1].trigger('focusout')
		expect(lastPersisted(w)).toHaveLength(2)

		// The reload that races the save still reports the old list.
		await w.setProps({ rules: [staffRule()] })

		expect(editors(w)).toHaveLength(2)
		expect(labelOf(w, 1)).toBe('Cohort cap')
	})

	it('does not overwrite a row whose edit has not been committed yet', async () => {
		const w = mountPanel([allEnrolled()])
		await w.findAll('input')[0].setValue('Half typed na')

		await w.setProps({ rules: [allEnrolled()] })

		expect(labelOf(w)).toBe('Half typed na')
	})

	it('takes the server copy once the edit has been committed', async () => {
		const w = mountPanel([allEnrolled()])
		await w.findAll('input')[0].setValue('Renamed')
		await w.findAll('.rounded-lg')[0].trigger('focusout')

		await w.setProps({ rules: [allEnrolled({ label: 'Renamed on server' })] })

		expect(labelOf(w)).toBe('Renamed on server')
	})

	it('drops a saved rule the server no longer has', async () => {
		const w = mountPanel([allEnrolled(), staffRule()])

		await w.setProps({ rules: [staffRule()] })

		expect(editors(w)).toHaveLength(1)
	})
})

describe('RulesPanel — nothing is committed without the rule declaration', () => {
	// `fieldsOf` returns [] for an undeclared type and `[].every()` is true, so a
	// missing declaration used to mark every rule complete and save it unchecked.
	const UNAVAILABLE = 'could not be loaded'

	it('withholds an incomplete rule it has no declaration to check', async () => {
		decl.providers = []
		const w = mountPanel([
			allEnrolled({ rule_type: 'Students of Courses', label: 'Cohort' }),
		])

		await w.findAll('input')[0].setValue('Cohort A')
		await w.findAll('.rounded-lg')[0].trigger('focusout')

		expect(w.emitted('persist')).toBeUndefined()
	})

	it('says why saving has stopped', () => {
		decl.providers = []
		expect(mountPanel([allEnrolled()]).text()).toContain(UNAVAILABLE)
	})

	it('stays quiet while the declaration is still on its way', () => {
		decl.providers = []
		decl.loading = true

		expect(mountPanel([allEnrolled()]).text()).not.toContain(UNAVAILABLE)
	})

	it('offers no Add rule with no vocabulary to add from', () => {
		decl.providers = []
		expect(
			addButton(mountPanel([allEnrolled()])).attributes('disabled')
		).toBeDefined()
	})

	it('flags a saved rule whose type the declaration dropped', async () => {
		const w = mountPanel([allEnrolled({ rule_type: 'Retired Type' })])

		expect(w.text()).toContain('no longer offered')
		expect(w.text()).toContain(BLOCKED)

		await w.findAll('input')[0].setValue('Renamed')
		await w.findAll('.rounded-lg')[0].trigger('focusout')

		expect(w.emitted('persist')).toBeUndefined()
	})
})

describe('RulesPanel — a saved new rule is not re-added as a duplicate', () => {
	it('claims the just-saved row when it reloads with a docname', async () => {
		const w = mountPanel([])
		await w.find('.flex.p-4').trigger('click')
		await w.find('input').setValue('Cohort cap')
		await w.find('.rounded-lg').trigger('focusout')

		// The row was emitted with no name (a brand-new rule); the backend persists it
		// and the refetch brings the same rule back WITH a docname. Before the fix the
		// panel kept the original `new-N` row too, producing a phantom duplicate.
		const saved = lastPersisted(w)[0]
		await w.setProps({ rules: [{ ...saved, name: 'RMR-NEW' }] })

		expect(w.findAll('input')).toHaveLength(1)
		expect(w.text()).not.toContain('Matches another rule above')
	})

	it('still keeps a genuine second unsaved duplicate visible', async () => {
		const w = mountPanel([allEnrolled()])
		// Add a second card and make it identical to the saved one.
		addButton(w).trigger('click')
		await w.vm.$nextTick()
		await w.findAll('input')[1].setValue('All enrolled')
		await w.findAll('.rounded-lg')[1].trigger('focusout')

		// A refetch of the one saved rule must not swallow the in-progress duplicate.
		await w.setProps({ rules: [allEnrolled()] })

		expect(w.findAll('input')).toHaveLength(2)
		expect(w.text()).toContain('Matches another rule above')
	})
})

describe('RulesPanel — removing a rule flags the drop for confirmation', () => {
	it('emits the removal with fromRemoval so the parent can confirm', async () => {
		const w = mountPanel([allEnrolled(), staffRule()])

		menuOf(w, 0).find((o) => o.label === 'Remove')!.onClick()
		await w.vm.$nextTick()

		const events = w.emitted('persist')!
		const last = events[events.length - 1]
		expect(last[0]).toHaveLength(1) // only the Staff rule remains
		expect(last[1]).toEqual({ fromRemoval: true })
	})
})
