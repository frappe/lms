/**
 * The Raven rule adapter — the only place that knows LMS is the provider.
 * fromApiRule flattens the wire rule; toApiRule nests the fields back into config.
 */
import { describe, expect, it } from 'vitest'
import {
	fromApiRule,
	membershipSignature,
	ruleIdentity,
	toApiRule,
} from '@/utils/raven/ruleAdapter'
import type { ApiRule, RavenMemberRule } from '@/types'

describe('raven ruleAdapter', () => {
	it('flattens an API rule config into the flat UI shape', () => {
		const flat = fromApiRule({
			name: 'r1',
			label: 'Cohort',
			provider: 'LMS',
			rule_type: 'Students of Courses',
			status: 'Active',
			config: { payment_filter: 'Paid', courses: ['C1', 'C2'] },
			matches: 'Students of Courses',
		})
		expect(flat.rule_type).toBe('Students of Courses')
		expect(flat.label).toBe('Cohort')
		expect(flat.payment_filter).toBe('Paid')
		expect(flat.courses).toEqual(['C1', 'C2'])
	})

	it('nests LMS fields back into config and stamps provider LMS', () => {
		const rule: RavenMemberRule = {
			name: 'r1',
			label: 'Cohort',
			rule_type: 'Students of Courses',
			status: 'Active',
			payment_filter: 'Paid',
			courses: ['C1', 'C2'],
		}
		const api = toApiRule(rule)
		expect(api.provider).toBe('LMS')
		expect(api.rule_type).toBe('Students of Courses')
		expect(api.config).toEqual({
			payment_filter: 'Paid',
			courses: ['C1', 'C2'],
		})
		// flat-only fields must not leak into config
		expect((api.config as Record<string, unknown>).label).toBeUndefined()
	})

	it('round-trips the label, which is mandatory and never derived', () => {
		const api: ApiRule = {
			name: 'r3',
			label: 'Paid cohort',
			provider: 'LMS',
			rule_type: 'All Enrolled Students',
			status: 'Active',
			config: { payment_filter: 'Paid' },
		}
		expect(fromApiRule(api).label).toBe('Paid cohort')
		expect(toApiRule(fromApiRule(api)).label).toBe('Paid cohort')
	})

	it('keeps an unnamed rule unnamed rather than inventing a label', () => {
		const flat = fromApiRule({
			provider: 'LMS',
			rule_type: 'All Enrolled Students',
			status: 'Active',
			config: {},
		})
		expect(flat.label).toBeUndefined()
		expect(toApiRule(flat).label).toBeUndefined()
	})

	it('round-trips a staff rule without losing config', () => {
		const original: ApiRule = {
			name: 'r2',
			label: 'Staff',
			provider: 'LMS',
			rule_type: 'Staff',
			status: 'Paused',
			config: { staff_role: 'Instructor', staff_scope_courses: ['C9'] },
		}
		const back = toApiRule(fromApiRule(original))
		expect(back.config).toEqual(original.config)
		expect(back.rule_type).toBe('Staff')
		expect(back.status).toBe('Paused')
	})

	it('does not invent a payment_filter for rules that never had one', () => {
		const flat = fromApiRule({
			provider: 'LMS',
			rule_type: 'Staff',
			status: 'Active',
			config: { staff_role: 'Mentor' },
		})
		expect(flat.payment_filter).toBeUndefined()
		expect(toApiRule(flat).config).toEqual({ staff_role: 'Mentor' })
	})

	// Was: unknown config keys were dropped, because the adapter carried a hardcoded
	// list of LMS keys. Config keys are now whatever the declaration named, so an
	// unrecognised one is data to preserve, not noise to strip.
	it('keeps config keys it does not recognise', () => {
		const flat = fromApiRule({
			provider: 'LMS',
			rule_type: 'All Enrolled Students',
			status: 'Active',
			config: { payment_filter: 'Free', some_other_provider_field: 'x' },
		})
		expect(toApiRule(flat).config).toEqual({
			payment_filter: 'Free',
			some_other_provider_field: 'x',
		})
	})
})

describe('raven ruleAdapter — provider ownership', () => {
	const foreign: ApiRule = {
		name: 'RMR-9',
		label: 'Widget owners',
		provider: 'Acme',
		rule_type: 'Widget Owners',
		status: 'Active',
		config: { widget_tier: 'gold', regions: ['EU', 'US'] },
	}

	it('carries the owning provider through the round-trip', () => {
		expect(fromApiRule(foreign).provider).toBe('Acme')
		expect(toApiRule(fromApiRule(foreign))).toEqual(foreign)
	})

	it('stamps LMS only on a rule that names no provider', () => {
		expect(
			toApiRule({ rule_type: 'All Enrolled Students', status: 'Active' })
				.provider,
		).toBe('LMS')
	})

	it('never gives two providers the same rule identity', () => {
		const asLms: RavenMemberRule = { ...fromApiRule(foreign), provider: 'LMS' }
		expect(ruleIdentity(fromApiRule(foreign))).not.toBe(ruleIdentity(asLms))
	})

	it('sees a provider change as a membership change', () => {
		const rule = fromApiRule(foreign)
		expect(membershipSignature([rule])).not.toBe(
			membershipSignature([{ ...rule, provider: 'LMS' }]),
		)
	})
})

describe('membershipSignature', () => {
	const rule: RavenMemberRule = {
		name: 'r1',
		label: 'Cohort',
		rule_type: 'Students of Courses',
		status: 'Active',
		payment_filter: 'Paid',
		courses: ['C1'],
	}

	it('ignores label and name — a rename moves nobody', () => {
		const renamed: RavenMemberRule = { ...rule, label: 'Renamed', name: 'r9' }
		expect(membershipSignature([renamed])).toBe(membershipSignature([rule]))
	})

	it('leaves the label out of the signature but keeps it in the payload', () => {
		expect(membershipSignature([rule])).not.toContain('Cohort')
		expect(toApiRule(rule).label).toBe('Cohort')
	})

	it('changes when the rule config changes', () => {
		const widened: RavenMemberRule = { ...rule, courses: ['C1', 'C2'] }
		expect(membershipSignature([widened])).not.toBe(membershipSignature([rule]))
	})

	it('changes when a rule is paused', () => {
		const paused: RavenMemberRule = { ...rule, status: 'Paused' }
		expect(membershipSignature([paused])).not.toBe(membershipSignature([rule]))
	})

	it('changes when a rule is removed', () => {
		expect(membershipSignature([])).not.toBe(membershipSignature([rule]))
	})
})
