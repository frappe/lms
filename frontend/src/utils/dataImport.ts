import type { Router } from 'vue-router'
import { pushSettingsHash } from '@/composables/useSettingsHash'

/**
 * Where an imported record of each LMS doctype lives in the app. The Data
 * Import wizard and list use it to name the doctype and link back; a doctype
 * not listed here is named as is and gets no links.
 */
type ImportTarget = {
	title: string
	openList: (router: Router) => void
	/** The list is in Settings, which phones do not have. */
	listInSettings?: boolean
	openRecord?: (router: Router, name: string) => void
}

const TARGETS: Record<string, ImportTarget> = {
	'LMS Course': {
		title: 'Courses',
		openList: (router) => router.push({ name: 'Courses' }),
		openRecord: (router, name) =>
			router.push({ name: 'CourseDetail', params: { courseName: name } }),
	},
	'LMS Batch': {
		title: 'Batches',
		openList: (router) => router.push({ name: 'Batches' }),
		openRecord: (router, name) =>
			router.push({ name: 'BatchDetail', params: { batchName: name } }),
	},
	// Categories have no page of their own; they are managed in Settings.
	'LMS Category': {
		title: 'Categories',
		openList: (router) => pushSettingsHash(router, 'categories'),
		listInSettings: true,
	},
}

export const LMS_IMPORT_DOCTYPES = Object.keys(TARGETS)

export const importTarget = (doctype?: string | null) =>
	doctype ? TARGETS[doctype] : undefined

/** "Courses" for LMS Course; any other doctype by its own name. */
export const importTitle = (doctype?: string | null) => {
	const target = importTarget(doctype)
	return target ? __(target.title) : doctype ?? ''
}
