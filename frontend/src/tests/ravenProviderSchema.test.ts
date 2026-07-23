/**
 * providerSchema's completeness check. `fieldsOf` returns [] for a rule type the
 * declaration does not cover — including every type while it is unloaded — and
 * `[].every()` is true, so completeness must be gated on the type being declared.
 */
import { describe, expect, it, vi } from 'vitest'
import {
	fieldsOf,
	hasRequiredFields,
	isDeclaredRuleType,
} from '@/composables/raven/providerSchema'
import type { ProviderRuleType, RavenMemberRule } from '@/types'

vi.mock('frappe-ui', () => ({ createResource: () => ({ data: [] }) }))

const ruleTypes: ProviderRuleType[] = [
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
		type: 'All Enrolled Students',
		fields: [
			{
				fieldname: 'payment_filter',
				fieldtype: 'Select',
				label: 'Payment',
				options: ['Any', 'Paid'],
				default: 'Any',
			},
		],
	},
]

const rule = (over: Partial<RavenMemberRule> = {}): RavenMemberRule => ({
	rule_type: 'Students of Courses',
	status: 'Active',
	...over,
})

describe('hasRequiredFields', () => {
	it('is false for a rule type the declaration does not cover', () => {
		expect(hasRequiredFields(ruleTypes, rule({ rule_type: 'Retired' }))).toBe(
			false,
		)
	})

	it('is false for every rule while the declaration is unloaded', () => {
		expect(hasRequiredFields([], rule({ courses: ['C1'] }))).toBe(false)
	})

	it('is false while a declared reqd field is empty', () => {
		expect(hasRequiredFields(ruleTypes, rule({ courses: [] }))).toBe(false)
	})

	it('is true once every declared reqd field is filled', () => {
		expect(hasRequiredFields(ruleTypes, rule({ courses: ['C1'] }))).toBe(true)
	})

	it('is true for a declared type with no reqd fields', () => {
		expect(
			hasRequiredFields(
				ruleTypes,
				rule({ rule_type: 'All Enrolled Students' }),
			),
		).toBe(true)
	})
})

describe('isDeclaredRuleType', () => {
	it('separates a known type from an unknown one', () => {
		expect(isDeclaredRuleType(ruleTypes, 'Students of Courses')).toBe(true)
		expect(isDeclaredRuleType(ruleTypes, 'Retired')).toBe(false)
		expect(isDeclaredRuleType([], 'Students of Courses')).toBe(false)
	})

	it('agrees with fieldsOf on what is covered', () => {
		expect(fieldsOf(ruleTypes, 'Retired')).toEqual([])
	})
})
