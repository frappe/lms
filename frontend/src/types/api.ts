import type { Ref } from 'vue'
import type { LMSCourse } from './lms/LMSCourse'
import type { LMSBatch } from './lms/LMSBatch'

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
	setValue: { submit(values: unknown, opts?: unknown): Promise<T> }
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
		is_student?: boolean
		is_system_manager?: boolean
	}
}

export interface CourseInstructorInfo extends UserInfo {
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
	students?: string[]
	batch_details_raw?: string
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
	certificate?: { name: string; template: string } | null
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
}
