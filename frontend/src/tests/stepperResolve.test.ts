import { describe, expect, it } from 'vitest'
import { resolveSteps } from '@/components/Stepper/resolve'
import type { ResolvedStep, StepItem } from '@/components/Stepper/types'

const flat: StepItem[] = [
	{ value: 'account', label: 'Account' },
	{ value: 'workspace', label: 'Workspace' },
	{ value: 'invite', label: 'Invite team', skipped: true },
	{ value: 'import', label: 'Import data' },
	{ value: 'review', label: 'Review' },
]

const nested: StepItem[] = [
	{ value: 'plan', label: 'Plan' },
	{
		value: 'build',
		label: 'Build',
		children: [
			{ value: 'configure', label: 'Configure' },
			{ value: 'apply', label: 'Apply' },
		],
	},
	{ value: 'verify', label: 'Verify' },
]

const states = (steps: ResolvedStep[]) => steps.map((s) => s.state)

describe('resolveSteps', () => {
	it('marks steps before the current one done and after it upcoming', () => {
		const steps = resolveSteps(flat.slice(0, 2).concat(flat.slice(3)), {
			current: 'import',
		})
		expect(states(steps)).toEqual([
			'complete',
			'complete',
			'current',
			'upcoming',
		])
	})

	it('shows a flagged step as skipped only once it is passed', () => {
		expect(states(resolveSteps(flat, { current: 'import' }))).toEqual([
			'complete',
			'complete',
			'skipped',
			'current',
			'upcoming',
		])
		expect(resolveSteps(flat, { current: 'workspace' })[2].state).toBe(
			'upcoming'
		)
	})

	it('fails the current step', () => {
		expect(
			resolveSteps(flat, { current: 'import', failed: true })[3].state
		).toBe('failed')
	})

	it('treats an empty or unknown value as not started', () => {
		expect(states(resolveSteps(flat, { current: null }))).toEqual(
			Array(5).fill('upcoming')
		)
		expect(states(resolveSteps(flat, { current: 'nope' }))).toEqual(
			Array(5).fill('upcoming')
		)
	})

	it('finishes every step when completed, keeping skipped ones', () => {
		expect(
			states(resolveSteps(flat, { current: 'account', completed: true }))
		).toEqual(['complete', 'complete', 'skipped', 'complete', 'complete'])
	})

	it('derives a parent from its sub-steps', () => {
		const steps = resolveSteps(nested, { current: 'apply' })
		expect(states(steps)).toEqual(['complete', 'current', 'upcoming'])
		expect(states(steps[1].children)).toEqual(['complete', 'current'])
		expect(resolveSteps(nested, { current: 'verify' })[1].state).toBe(
			'complete'
		)
	})

	it('makes the first sub-step current when the value names its parent', () => {
		const steps = resolveSteps(nested, { current: 'build' })
		expect(states(steps[1].children)).toEqual(['current', 'upcoming'])
	})

	it('fails the parent of a failed sub-step', () => {
		expect(
			resolveSteps(nested, { current: 'apply', failed: true })[1].state
		).toBe('failed')
	})

	it('keeps sibling indexes and never mutates the input', () => {
		const before = JSON.stringify(nested)
		const steps = resolveSteps(nested, { current: 'apply' })
		expect(steps.map((s) => s.index)).toEqual([0, 1, 2])
		expect(steps[1].children.map((c) => c.index)).toEqual([0, 1])
		expect(JSON.stringify(nested)).toBe(before)
	})
})
