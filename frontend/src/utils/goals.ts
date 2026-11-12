import dayjs from '@/utils/dayjs'
export type GoalStatus = 'Draft' | 'Drafting' | 'Ready' | 'Published'
export type ActivityType = 'Lesson' | 'Scenario' | 'Role-play' | 'Check'

export interface Readiness {
	assigned: number
	ready: number
	in_progress: number
	not_started: number
	overdue: number
}

// A skill as a learner sees it, on the Skills list and as practice on a course.
export interface LearnerSkill {
	name: string
	title: string
	outcome?: string
	learner_outcome?: string
	minutes?: number
	due_date?: string
	enrolled: boolean
	state: 'Assigned' | 'In Progress' | 'Ready' | null
	progress: number
	enrolled_count: number
	instructor?: { name: string; full_name: string; image?: string }
}

/** The SkillCard props for a learner's skill: their state, due date and progress, never another person's. */
export const learnerCard = (skill: LearnerSkill) => ({
	title: skill.title,
	description: skill.learner_outcome || skill.outcome,
	topLine:
		skill.due_date && skill.state !== 'Ready'
			? __('Due {0}').format(dayjs(skill.due_date).format('D MMM'))
			: '',
	badge:
		skill.state === 'Ready'
			? { label: __('Ready'), theme: 'green' }
			: skill.state === 'In Progress'
				? { label: __('In progress'), theme: 'blue' }
				: null,
	instructor: skill.instructor,
	// Enrolment, as admins see it; a skill nobody has taken yet says nothing to learners.
	meta: skill.enrolled_count
		? __('{0} enrolled').format(skill.enrolled_count)
		: '',
	progress: skill.enrolled && skill.state !== 'Ready' ? skill.progress : 0,
	to: { name: 'GoalSession', params: { goal: skill.name } },
})

export const statusTheme = (
	status: string,
): 'gray' | 'amber' | 'blue' | 'green' =>
	(
		({
			Draft: 'gray',
			Drafting: 'amber',
			Ready: 'blue',
			Published: 'green',
			Assigned: 'gray',
			'In Progress': 'amber',
		}) as Record<string, 'gray' | 'amber' | 'blue' | 'green'>
	)[status] ?? 'gray'

export const statusLabel = (status: string): string =>
	(
		({
			Draft: __('Draft'),
			Drafting: __('Building'),
			Ready: __('Ready to publish'),
			Published: __('Published'),
			Assigned: __('Not started'),
			'In Progress': __('In progress'),
		}) as Record<string, string>
	)[status] ?? status

export const percentReady = (readiness?: Readiness | null): number =>
	readiness?.assigned
		? Math.round((100 * readiness.ready) / readiness.assigned)
		: 0

export const activityIcon: Record<ActivityType, string> = {
	Lesson: 'lucide-book-open',
	Scenario: 'lucide-git-fork',
	'Role-play': 'lucide-messages-square',
	Check: 'lucide-circle-check',
}

export const activityLabel = (type: ActivityType): string =>
	({
		Lesson: __('Key ideas'),
		Scenario: __('Scenario'),
		'Role-play': __('Role-play'),
		Check: __('Check'),
	})[type] ?? type

/** What a Flow tool call is doing, in words a learner or admin understands. */
/** The title a skill keeps until the admin or the AI names it. Matches goals.UNTITLED. */
export const UNTITLED = 'Untitled skill'

export const toolLabels = (): Record<string, string> => ({
	search_goal_sources: __('Reading your material…'),
	search_my_goal_sources: __('Checking the material…'),
	save_goal_plan: __('Putting the plan together…'),
	readiness_summary: __('Checking readiness…'),
	list_assignments: __('Looking up people…'),
	show_moment: __('Setting up something for you to try…'),
	finish_teaching: __('Wrapping up…'),
})

/**
 * Builds the link that opens a cited document at its page, for a learner's assignment or an
 * admin's goal. A citation looks like "Policy · p.3"; several joined by commas use the first.
 */
export const sourceLinkFor =
	(scope: { assignment?: string; goal?: string }, documents: string[]) =>
	(source: string): string | null => {
		const match = source
			.split(',')[0]
			.trim()
			.match(/^(.+?)(?: · p\.(\d+)(?:[-–]\d+)?)?$/)
		if (!match || !documents.includes(match[1])) return null
		const params = new URLSearchParams({ document: match[1], ...scope })
		return `/api/method/lms.lms.ai.api.source_file?${params}${match[2] ? `#page=${match[2]}` : ''}`
	}
