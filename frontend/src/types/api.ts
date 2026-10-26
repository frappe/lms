import type { Ref } from 'vue'
import type { LMSCourse } from './lms/LMSCourse'
import type { LMSBatch } from './lms/LMSBatch'
import type { CourseEvaluator } from './lms/CourseEvaluator'

export interface Resource<T = unknown> {
	data: T
	loading: boolean
	error: unknown
	doc?: T
	hasNextPage?: boolean
	reload(): Promise<T>
	fetch(): Promise<T>
	next?(): void
	// Promise, not void: frappe-ui's submit resolves or REJECTS, and typing it
	// away is what let bare `resource.submit(...)` statements spread unnoticed —
	// see utils/resource.ts.
	submit(params?: unknown, opts?: unknown): Promise<T>
	update(opts: unknown): void
	setData(data: T): void
	setValue: { submit(values: unknown, opts?: unknown): Promise<T> }
	/** createDocumentResource's fetch of `doc`. */
	get?: { loading: boolean }
}

export interface UserInfo {
	name: string
	full_name?: string
	first_name?: string
	last_name?: string
	email?: string
	username?: string
	user_image?: string
	open_to?: 'Work' | 'Hiring' | string
}

export interface SessionUser {
	data?: UserInfo & {
		is_moderator?: boolean
		is_instructor?: boolean
		is_evaluator?: boolean
		is_student?: boolean
		is_system_manager?: boolean
	}
}

// `name` is the login email, sent only to the instructor themselves.
export interface CourseInstructorInfo extends Omit<UserInfo, 'name'> {
	name?: string
	instructor?: string
	bio?: string | null
}

export interface Membership {
	name?: string
	member?: string
	progress?: number
	current_lesson?: string
	purchased_certificate?: 0 | 1 | boolean
	certificate?: string
}

export interface CourseDetails
	extends Omit<LMSCourse, 'instructors' | 'rating'> {
	price?: string
	current_lesson?: string
	instructors: CourseInstructorInfo[]
	membership?: Membership | null
	rating?: string
	rating_count?: number
	quiz_count?: number
}

export interface BatchDetails extends Omit<LMSBatch, 'instructors'> {
	instructors: string[]
	student_count?: number
	is_student?: boolean
	batch_details_raw?: string
	/** A listed instructor of this batch, or a Moderator: the server refuses
	 * instructor-list changes from anyone else, a tagged evaluator included. */
	can_change_instructors?: boolean
}

export interface CourseReviewInfo {
	name: string
	creation: string
	rating: number
	review?: string
	owner_details: UserInfo
}

export interface OutlineLesson {
	name: string
	title: string
	number: string
	icon?: string
	is_complete?: boolean
	locked?: 0 | 1
}

export interface OutlineChapter {
	name: string
	title: string
	idx: number
	is_scorm_package?: 0 | 1
	scorm_package?: { file_name: string; file_size: number } | null
	lessons?: OutlineLesson[]
}

export interface CertificationInfo {
	title?: string | null
	has_evaluator?: boolean
	// The evaluator's login email, sent only to the evaluator themselves.
	evaluator?: string | null
	certificate?: {
		name: string
		template: string
		issue_date?: string
	} | null
	membership?: {
		purchased_certificate?: 0 | 1
		certificate?: string
	} | null
	paid_certificate?: 0 | 1
}

export interface ChapterDetailInput {
	name?: string
	title?: string
	is_scorm_package?: 0 | 1
	/**
	 * build_outline expands this into the File's details only while that File row
	 * still exists; once it is deleted the raw Course Chapter.scorm_package
	 * DOCNAME comes through instead. Declaring only the object shape made every
	 * consumer assume `.file_name` was there.
	 */
	scorm_package?:
		| string
		| { name?: string; file_name?: string; file_size?: number }
		| null
}

export interface CourseFormMeta {
	description: string
	keywords: string
}

export interface CourseFormContext {
	resource: Resource<LMSCourse | null>
	instructors: Ref<string[]>
	relatedCourses: Ref<string[]>
	meta: CourseFormMeta
	markDirty: () => void
	/** Shows Not Saved without arming autosave. */
	markUnsaved: () => void
}

export interface EvaluatorCalendar {
	name?: string
	enable: 0 | 1
	calendar_name: string
	push_to_google_calendar: 0 | 1
	is_authorized: boolean
	connected: boolean
}

// lms.lms.api.get_evaluator_details, also returned by save_evaluator_availability.
export interface EvaluatorDetails {
	slots: Pick<
		CourseEvaluator,
		'evaluator' | 'schedule' | 'unavailable_from' | 'unavailable_to'
	>
	calendar: EvaluatorCalendar | null
	google_enabled: boolean
	can_configure_google: boolean
	timezone: string
	evaluation_invites: boolean
	can_configure_invites: boolean
}
