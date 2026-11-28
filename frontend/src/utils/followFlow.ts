import { toast } from 'frappe-ui'
import type { RouteLocationNamedRaw, Router } from 'vue-router'
import {
	FLOW_CHANGE_EVENT,
	type FlowChange,
} from '@/composables/useFlowChanges'
import { hasUnsavedEdits } from '@/composables/useUnsavedChangesGuard'
import {
	getRecordRoute,
	type RecordRouteContext,
	type RecordValues,
} from '@/utils/recordRoutes'

interface FlowSocket {
	on: (event: string, handler: (change: FlowChange) => void) => void
}

/** Flow saves a course's records in a burst: only the last one is opened. */
export const FOLLOW_DELAY_MS = 500

/**
 * The page that shows a change while Flow works. A chapter is followed into
 * the course editor, where its lessons are written, not its own form.
 */
export function getFollowRoute(
	change: FlowChange,
	context: RecordRouteContext
): RouteLocationNamedRaw | null {
	if (change.deleted) return null
	const values: RecordValues = change.values ?? {}
	if (change.doctype === 'Course Chapter' && values.course)
		return {
			name: 'CourseDetail',
			params: { courseName: String(values.course) },
			hash: '#editor',
		}
	return getRecordRoute(change.doctype, change.name, context, values)
}

/** The page already shows the record: its own refresh shows the change. */
function isShowing(router: Router, target: RouteLocationNamedRaw): boolean {
	const current = router.currentRoute.value
	const resolved = router.resolve(target)
	if (resolved.name !== current.name) return false
	if (JSON.stringify(resolved.params) !== JSON.stringify(current.params))
		return false
	const lesson = resolved.query.editLessonName
	return !lesson || lesson === current.query.editLessonName
}

/**
 * Opens the LMS page of what Flow, acting for this user, has just written, so
 * the work shows up where it happens. Unsaved edits stay put behind an offer.
 */
export function followFlowChanges(
	router: Router,
	socket: FlowSocket | null,
	getContext: () => RecordRouteContext
): void {
	if (!socket) return
	let timer: ReturnType<typeof setTimeout> | undefined
	let latest: FlowChange | null = null

	const open = () => {
		const target = latest && getFollowRoute(latest, getContext())
		latest = null
		if (!target || isShowing(router, target)) return
		if (!hasUnsavedEdits()) {
			router.push(target)
			return
		}
		toast.info(__('Flow is working on another page.'), {
			id: 'flow-follow',
			duration: Infinity,
			action: { label: __('Open'), onClick: () => router.push(target) },
		})
	}

	socket.on(FLOW_CHANGE_EVENT, (change) => {
		if (change.deleted) return
		latest = change
		clearTimeout(timer)
		timer = setTimeout(open, FOLLOW_DELAY_MS)
	})
}
