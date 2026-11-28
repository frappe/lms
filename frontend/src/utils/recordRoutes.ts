import type { RouteLocationNamedRaw } from 'vue-router'

/** What the visitor may do, where it decides which page a record opens on. */
export interface RecordRouteContext {
	/** Moderators and instructors open a program's edit form, others its detail page. */
	canEditPrograms?: boolean
}

/** Fields read off the record, for a page addressed by its parent. */
export type RecordValues = Record<string, string | null | undefined>

interface RecordRoute {
	/** The fields `to` needs from the record besides its name. */
	needs?: string[]
	/** The route name of the doctype's list page. */
	list?: string
	to: (
		name: string,
		values: RecordValues,
		context: RecordRouteContext
	) => RouteLocationNamedRaw
}

const value = (values: RecordValues, field: string): string =>
	String(values[field])

/**
 * The LMS page of each LMS doctype: the one map that search hits and links
 * from Flow route through. A doctype missing here keeps its Desk page.
 */
const RECORD_ROUTES: Record<string, RecordRoute> = {
	'LMS Course': {
		list: 'Courses',
		to: (name) => ({ name: 'CourseDetail', params: { courseName: name } }),
	},
	'Course Chapter': {
		needs: ['course'],
		to: (name, values) => ({
			name: 'ChapterForm',
			params: { courseName: value(values, 'course'), chapterName: name },
		}),
	},
	// The course editor opens a lesson by name; the learner's page needs its number.
	'Course Lesson': {
		needs: ['course'],
		to: (name, values) => ({
			name: 'CourseDetail',
			params: { courseName: value(values, 'course') },
			query: { editLessonName: name },
			hash: '#editor',
		}),
	},
	'LMS Enrollment': {
		needs: ['course'],
		to: (_name, values) => ({
			name: 'CourseDetail',
			params: { courseName: value(values, 'course') },
			hash: '#dashboard',
		}),
	},
	'LMS Batch': {
		list: 'Batches',
		to: (name) => ({ name: 'BatchDetail', params: { batchName: name } }),
	},
	'LMS Batch Enrollment': {
		needs: ['batch'],
		to: (_name, values) => ({
			name: 'BatchDetail',
			params: { batchName: value(values, 'batch') },
			hash: '#dashboard',
		}),
	},
	'LMS Live Class': {
		needs: ['batch_name'],
		to: (_name, values) => ({
			name: 'BatchDetail',
			params: { batchName: value(values, 'batch_name') },
			hash: '#classes',
		}),
	},
	'LMS Program': {
		list: 'Programs',
		to: (name, _values, context) => ({
			name: context.canEditPrograms ? 'ProgramForm' : 'ProgramDetail',
			params: { programName: name },
		}),
	},
	'LMS Quiz': {
		list: 'Quizzes',
		to: (name) => ({ name: 'QuizForm', params: { quizID: name } }),
	},
	'LMS Quiz Submission': {
		list: 'QuizSubmissions',
		to: (name) => ({ name: 'QuizSubmission', params: { submission: name } }),
	},
	'LMS Assignment': {
		list: 'Assignments',
		to: (name) => ({ name: 'AssignmentForm', params: { assignmentID: name } }),
	},
	'LMS Assignment Submission': {
		needs: ['assignment'],
		list: 'AssignmentSubmissions',
		to: (name, values) => ({
			name: 'AssignmentSubmission',
			params: {
				assignmentID: value(values, 'assignment'),
				submissionName: name,
			},
		}),
	},
	'LMS Programming Exercise': {
		list: 'ProgrammingExercises',
		to: (name) => ({
			name: 'ProgrammingExerciseForm',
			params: { exerciseID: name },
		}),
	},
	'LMS Programming Exercise Submission': {
		needs: ['exercise'],
		list: 'ProgrammingExerciseSubmissions',
		to: (name, values) => ({
			name: 'ProgrammingExerciseSubmission',
			params: { exerciseID: value(values, 'exercise'), submissionID: name },
		}),
	},
	'Job Opportunity': {
		list: 'Jobs',
		to: (name) => ({ name: 'JobDetail', params: { job: name } }),
	},
	User: {
		needs: ['username'],
		to: (_name, values) => ({
			name: 'Profile',
			params: { username: value(values, 'username') },
		}),
	},
}

/** Desk's slug for a doctype, as in /desk/lms-course. */
export const doctypeSlug = (doctype: string): string =>
	doctype.toLowerCase().replace(/ /g, '-')

const DOCTYPES_BY_SLUG = new Map(
	Object.keys(RECORD_ROUTES).map((doctype) => [doctypeSlug(doctype), doctype])
)

/** The LMS doctype a Desk slug names, or null for one the LMS has no page for. */
export function getDoctypeFromSlug(slug: string): string | null {
	return DOCTYPES_BY_SLUG.get(slug.toLowerCase()) ?? null
}

/** The record fields getRecordRoute needs before it can build the route. */
export function getRecordRouteFields(doctype: string): string[] {
	return RECORD_ROUTES[doctype]?.needs ?? []
}

/**
 * The LMS page of a record, or null when the doctype has none or a field it
 * needs is missing from `values`.
 */
export function getRecordRoute(
	doctype: string,
	name: string,
	context: RecordRouteContext = {},
	values: RecordValues = {}
): RouteLocationNamedRaw | null {
	const entry = RECORD_ROUTES[doctype]
	if (!entry || entry.needs?.some((field) => !values[field])) return null
	return entry.to(name, values, context)
}

/** The LMS list page of a doctype, or null. */
export function getListRoute(doctype: string): RouteLocationNamedRaw | null {
	const list = RECORD_ROUTES[doctype]?.list
	return list ? { name: list } : null
}

/** Mirrors Programs.vue: its cards open the edit form for these users only. */
export function canEditPrograms(
	user: { is_moderator?: unknown; is_instructor?: unknown } | null | undefined
): boolean {
	return (
		!window.read_only_mode && Boolean(user?.is_moderator || user?.is_instructor)
	)
}
