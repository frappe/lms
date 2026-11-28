import { inject, onScopeDispose } from 'vue'
import { toast } from 'frappe-ui'
import type { CourseFormContext } from '@/types'

/** What lms.lms.flow.publish_flow_change sends when Flow writes a record. */
export interface FlowChange {
	doctype: string
	name: string
	deleted?: boolean
	/** The fields its LMS page is addressed by, such as a lesson's course. */
	values?: Record<string, string>
}

export const FLOW_CHANGE_EVENT = 'lms_flow_change'

interface FlowChangeSocket {
	on: (event: string, handler: (change: FlowChange) => void) => void
	off: (event: string, handler: (change: FlowChange) => void) => void
}

export interface FlowChangeOptions {
	/** The doctypes the page shows. */
	doctypes: string[]
	/** The record the page shows; leave it out to follow every record, as a list does. */
	name?: () => string | null | undefined
	/** Refetches what the page shows. */
	reload: (change: FlowChange) => void
	/** Unsaved edits that a reload would drop: the page then offers it instead. */
	isDirty?: () => boolean
}

/** Same id per record, so a second change replaces the notice instead of stacking. */
function offerReload(change: FlowChange, reload: () => void) {
	toast.info(__('Flow changed this page. Your unsaved edits are kept.'), {
		id: `flow-change:${change.doctype}:${change.name}`,
		duration: Infinity,
		action: { label: __('Load changes'), onClick: reload },
	})
}

/**
 * Refetches the page when Flow, acting for this user, changes the record it
 * shows, so the change appears without a reload. A dirty form is left alone and
 * offers to load the change.
 */
export function useFlowChanges(options: FlowChangeOptions): void {
	const socket = inject<FlowChangeSocket | null>('$socket', null)
	if (!socket) return
	const onChange = (change: FlowChange) => {
		if (!options.doctypes.includes(change.doctype)) return
		if (options.name && options.name() !== change.name) return
		if (options.isDirty?.()) offerReload(change, () => options.reload(change))
		else options.reload(change)
	}
	socket.on(FLOW_CHANGE_EVENT, onChange)
	onScopeDispose(() => socket.off(FLOW_CHANGE_EVENT, onChange))
}

interface CourseResource {
	data?: { name?: string } | null
	reload: () => unknown
}

/**
 * The course page's tabs: Flow's change to the course refetches the page and,
 * unless it holds unsaved edits, the form the tabs share.
 */
export function useCourseFlowChanges(course: CourseResource): void {
	const form = inject<CourseFormContext | null>('courseForm', null)
	useFlowChanges({
		doctypes: ['LMS Course'],
		name: () => course.data?.name,
		isDirty: () => Boolean(form?.isDirty?.value),
		reload: () => {
			form?.discardChanges?.()
			course.reload()
		},
	})
}
