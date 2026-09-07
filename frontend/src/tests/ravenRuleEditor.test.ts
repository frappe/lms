/**
 * RuleEditor.vue renders the provider's declared field schema: labels, controls,
 * defaults and `reqd` all come from `list_providers`, never from a copy kept here.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RuleEditor from '@/components/Settings/Raven/RuleEditor.vue'
import type { ProviderDeclaration, RavenMemberRule } from '@/types'

const h = vi.hoisted(() => ({ providers: [] as unknown[] }))

vi.mock('frappe-ui', () => ({
	// One shared instance in the app; here just a reader of the current fixture.
	createResource: () => ({
		get data() {
			return h.providers
		},
	}),
	Combobox: {
		name: 'Combobox',
		props: ['modelValue', 'options', 'placeholder', 'ariaLabel', 'disabled'],
		emits: ['update:modelValue'],
		template: `<select
			:aria-label="ariaLabel"
			:disabled="disabled"
			@change="$emit('update:modelValue', $event.target.value)"
		><option
			v-for="o in options"
			:key="o.value"
			:value="o.value"
			:selected="o.value === modelValue"
		>{{ o.label }}</option></select>`,
	},
	TextInput: {
		name: 'TextInput',
		props: ['modelValue', 'placeholder', 'ariaLabel', 'disabled'],
		template: `<input
			:placeholder="placeholder"
			:aria-label="ariaLabel"
			:disabled="disabled"
			:value="modelValue"
		/>`,
	},
}))

vi.mock('@/components/Controls/MultiLink.vue', () => ({
	default: {
		name: 'MultiLink',
		props: ['modelValue', 'doctype', 'placeholder', 'ariaLabel', 'disabled'],
		emits: ['update:modelValue'],
		template: `<div class="multi-link" />`,
	},
}))

vi.stubGlobal('__', (s: string) => s)

const LMS: ProviderDeclaration = {
	name: 'LMS',
	label: 'Frappe Learning',
	rule_types: [
		{
			type: 'All Enrolled Students',
			label: 'All Enrolled Students',
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
			type: 'Staff',
			label: 'Staff',
			fields: [
				{
					fieldname: 'staff_role',
					fieldtype: 'Select',
					label: 'Staff role',
					options: ['Instructor', 'Any'],
					reqd: 1,
					default: 'Any',
				},
				{
					fieldname: 'staff_scope_courses',
					fieldtype: 'MultiSelect',
					label: 'Scope: Courses',
					description: 'Leave empty for all',
					options: 'LMS Course',
				},
			],
		},
	],
}

const ACME: ProviderDeclaration = {
	name: 'Acme',
	label: 'Acme',
	rule_types: [
		{
			type: 'Widget Owners',
			label: 'Widget owners',
			fields: [
				{ fieldname: 'shipped_on', fieldtype: 'Date', label: 'Shipped on' },
			],
		},
	],
}

const mountEditor = (rule: RavenMemberRule, disabled = false) =>
	mount(RuleEditor, {
		props: { modelValue: rule, disabled },
		global: { mocks: { __: (s: string) => s } },
	})

const comboAt = (w: ReturnType<typeof mountEditor>, label: string) =>
	w.find(`select[aria-label="${label}"]`)

const comboProps = (w: ReturnType<typeof mountEditor>, label: string) =>
	w
		.findAllComponents({ name: 'Combobox' })
		.find((c) => c.props('ariaLabel') === label)!
		.props()

beforeEach(() => {
	h.providers = [LMS, ACME]
})

describe('RuleEditor: fields come from the declaration', () => {
	it('offers the declared rule types, by their declared labels', () => {
		const w = mountEditor({
			rule_type: 'All Enrolled Students',
			status: 'Active',
		})

		expect(comboAt(w, 'Rule type').text()).toContain('All Enrolled Students')
		expect(comboAt(w, 'Rule type').text()).toContain('Staff')
	})

	it('renders one row per declared field, with its label and description', () => {
		const w = mountEditor({ rule_type: 'Staff', status: 'Active' })

		expect(w.text()).toContain('Staff role')
		expect(w.text()).toContain('Scope: Courses')
		expect(w.text()).toContain('Leave empty for all')
		// Payment belongs to the student rule types only. The declaration says so.
		expect(w.text()).not.toContain('Payment')
	})

	it('renders a Select as a combobox over its literal options', () => {
		const w = mountEditor({
			rule_type: 'All Enrolled Students',
			status: 'Active',
		})

		const options = comboAt(w, 'Payment').findAll('option')
		expect(options.map((o) => o.attributes('value'))).toEqual([
			'Any',
			'Paid',
			'Free',
		])
	})

	it('renders a MultiSelect as a link picker on the declared doctype', () => {
		const w = mountEditor({ rule_type: 'Staff', status: 'Active' })

		const link = w.findComponent({ name: 'MultiLink' })
		expect(link.props('doctype')).toBe('LMS Course')
	})

	it('shows a declared default until the field is set', () => {
		const w = mountEditor({
			rule_type: 'All Enrolled Students',
			status: 'Active',
		})
		expect(
			comboAt(w, 'Payment').find('option[value="Any"]').attributes('selected')
		).toBeDefined()

		const set = mountEditor({
			rule_type: 'All Enrolled Students',
			status: 'Active',
			payment_filter: 'Paid',
		})
		expect(
			comboAt(set, 'Payment')
				.find('option[value="Paid"]')
				.attributes('selected')
		).toBeDefined()
	})

	// A displayed value the rule does not store reads as complete while the panel
	// counts it incomplete, which blocks every later save behind a field that
	// already looks filled.
	it('leaves a required Select empty when the rule does not carry it', () => {
		const w = mountEditor({ rule_type: 'Staff', status: 'Active' })

		expect(comboProps(w, 'Staff role').modelValue).toBe('')
		expect(
			comboAt(w, 'Staff role')
				.find('option[value="Any"]')
				.attributes('selected')
		).toBeUndefined()
	})

	it('does not write a default into a rule it only renders', () => {
		const w = mountEditor({ rule_type: 'Staff', status: 'Active' })

		expect(w.emitted('update:modelValue')).toBeUndefined()
	})

	it('shows a required Select s stored value once it has one', () => {
		const w = mountEditor({
			rule_type: 'Staff',
			status: 'Active',
			staff_role: 'Instructor',
		})

		expect(comboProps(w, 'Staff role').modelValue).toBe('Instructor')
	})

	it('writes the field the declaration names when it is changed', async () => {
		const w = mountEditor({
			rule_type: 'All Enrolled Students',
			status: 'Active',
		})

		await comboAt(w, 'Payment').setValue('Free')

		const emitted = w.emitted('update:modelValue')!
		expect(emitted[0][0]).toMatchObject({ payment_filter: 'Free' })
	})

	it('keeps only what the new rule type declares when the type changes', async () => {
		const w = mountEditor({
			name: 'RMR-1',
			label: 'Cohort',
			rule_type: 'Staff',
			status: 'Active',
			staff_role: 'Instructor',
		})

		await comboAt(w, 'Rule type').setValue('All Enrolled Students')

		const next = w.emitted('update:modelValue')![0][0] as RavenMemberRule
		expect(next).toEqual({
			name: 'RMR-1',
			label: 'Cohort',
			provider: undefined,
			rule_type: 'All Enrolled Students',
			status: 'Active',
			matches: undefined,
			payment_filter: 'Any',
		})
	})

	it('disables every control when the rule is locked', () => {
		const w = mountEditor({ rule_type: 'Staff', status: 'Paused' }, true)

		expect(comboAt(w, 'Rule type').attributes('disabled')).toBeDefined()
		expect(comboAt(w, 'Staff role').attributes('disabled')).toBeDefined()
		expect(w.findComponent({ name: 'MultiLink' }).props('disabled')).toBe(true)
	})
})

describe('RuleEditor: a fieldtype it cannot render', () => {
	it('shows a disabled placeholder naming the fieldtype instead of dropping it', () => {
		const w = mountEditor({
			provider: 'Acme',
			rule_type: 'Widget Owners',
			status: 'Active',
		})

		const placeholder = w.find('[data-testid="unsupported-field"]')
		expect(placeholder.exists()).toBe(true)
		expect(placeholder.attributes('placeholder')).toBe(
			'Unsupported field type: Date'
		)
		expect(placeholder.attributes('disabled')).toBeDefined()
		expect(w.text()).toContain('Shipped on')
	})
})

describe('RuleEditor: a foreign rule reads in its own vocabulary', () => {
	it('renders the owning provider s rule types, not this app s', () => {
		const w = mountEditor(
			{ provider: 'Acme', rule_type: 'Widget Owners', status: 'Active' },
			true
		)

		expect(comboAt(w, 'Rule type').text()).toContain('Widget owners')
		expect(comboAt(w, 'Rule type').text()).not.toContain('Staff')
	})

	it('renders nothing but the type when its provider is not installed', () => {
		h.providers = [LMS]
		const w = mountEditor(
			{ provider: 'Acme', rule_type: 'Widget Owners', status: 'Active' },
			true
		)

		expect(w.findAll('select')).toHaveLength(1)
		expect(w.find('[data-testid="unsupported-field"]').exists()).toBe(false)
	})
})
