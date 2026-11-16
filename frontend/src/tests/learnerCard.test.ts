import { describe, expect, it } from 'vitest'
import { learnerCard } from '@/utils/goals'

const skill = {
	name: 'fire-alarm',
	title: 'Fire Alarm Response',
	outcome: 'Leave calmly.',
	enrolled: true,
	enrolled_count: 3,
	state: 'In Progress',
	progress: 40,
	due_date: null,
} as any

describe('a learner skill card', () => {
	it('shows progress as a bar and never as a badge', () => {
		const card = learnerCard(skill) as any
		expect(card.badge).toBeUndefined()
		expect(card.progress).toBe(40)
		const done = learnerCard({ ...skill, state: 'Ready', progress: 100 })
		expect(done.progress).toBe(100)
		expect(done.meta).toBe('Finished')
		expect(learnerCard({ ...skill, state: 'Ready', progress: 0 }).progress).toBe(100)
	})

	it('has no bar before the learner has joined', () => {
		expect(learnerCard({ ...skill, enrolled: false, state: null }).progress).toBe(0)
	})
})
