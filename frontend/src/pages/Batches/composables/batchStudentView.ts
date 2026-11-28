import { inject } from 'vue'
import type { InjectionKey } from 'vue'
import type { BatchDetails, Resource } from '@/types'

export interface BatchPreview {
	/** Stands in for enrolling while an instructor previews the page. */
	enroll: () => void
}

export const BATCH_PREVIEW: InjectionKey<BatchPreview> = Symbol('batchPreview')

export function injectBatchPreview(): BatchPreview | null {
	return inject(BATCH_PREVIEW, null)
}

/**
 * The batch resource as a learner sees it: every manage flag off, enrolled or
 * not as previewed. Presentation only; the session keeps its permissions.
 */
export function studentBatch(
	batch: Resource<BatchDetails | null>,
	enrolled: boolean
): Resource<BatchDetails | null> {
	return new Proxy(batch, {
		get(target, key, receiver) {
			if (key !== 'data' || !target.data) {
				return Reflect.get(target, key, receiver)
			}
			return {
				...target.data,
				can_manage: false,
				can_change_instructors: false,
				can_schedule_classes: false,
				is_student: enrolled,
			}
		},
	})
}
