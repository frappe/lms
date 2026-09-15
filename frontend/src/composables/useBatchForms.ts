import { createResource } from 'frappe-ui'
import { watch } from 'vue'
import type { RouteLocationRaw, Router } from 'vue-router'
import { openFormRoute } from '@/composables/useFormRoute'

/** Route names of the three forms `BatchDetail` hosts, plus the page itself. */
export type BatchRouteName =
	| 'BatchDetail'
	| 'BulkCertificates'
	| 'NewLiveClass'
	| 'NewAnnouncement'
	| 'NewBatchCourse'
	| 'NewAssessment'
	| 'NewBatchStudent'
	| 'NewBatchEmailTemplate'

/**
 * The one place a batch-form route location is built.
 *
 * `hash` is the load-bearing argument (design doc C2). `BatchDetail` keeps the
 * active tab in `route.hash` and *pushes* on tab change, so a location that
 * dropped the hash would re-render the page on tab 0 — behind the form on the
 * way in, and in place of the tab the user came from on the way out. Both
 * directions go through here so neither can drift from the other.
 */
export function batchRouteLocation(
	name: BatchRouteName,
	batchName: string,
	hash: string
): RouteLocationRaw {
	return { name, params: { batchName }, hash }
}

/** Opens one of BatchDetail's child forms, pushing exactly one history entry. */
export function openBatchForm(
	router: Router,
	name: BatchRouteName,
	batchName: string,
	hash: string
): Promise<unknown> {
	return openFormRoute(router, batchRouteLocation(name, batchName, hash))
}

/**
 * The subset of `lms.lms.utils.get_batch_details` the three routed batch forms
 * read. It is deliberately partial — the endpoint returns the whole LMS Batch
 * doc plus these extras, and nothing here should imply otherwise.
 */
export type BatchDetails = {
	name: string
	title?: string
	published?: number
	certification?: number
	/** Not on a plain `LMS Batch` fetch — assembled by the endpoint. */
	students?: string[]
	/** Child table rows; `course` is the LMS Course docname. */
	courses?: { course: string }[]
	zoom_account?: string
	google_meet_account?: string
	conferencing_provider?: string
}

export type BatchDetailsResource = {
	data: BatchDetails | null
	loading: boolean
	fetched: boolean
	reload: () => void
}

/**
 * Bulk Certificates, Live Class and Announcement all need batch context that a
 * URL cannot carry — `students`, `courses`, and the conferencing account that
 * selects which endpoint a live class is created through. None of it is on a
 * plain `LMS Batch` fetch; all of it comes from this one endpoint.
 *
 * **This does NOT share BatchDetail's instance, and must not try to.** The
 * page's resource deliberately carries no `cache` key: the router reuses
 * BatchDetail when you go straight from one batch to another, and a cache key
 * is read once at setup, so the second batch's data would be written into the
 * first batch's cache entry (`BatchDetail.vue`, and `resources.js:112`). Adding
 * a key back here to piggy-back on it would reintroduce exactly that bug, and
 * `getCachedResource` has nothing to hand back either way.
 *
 * So each form owns its own fetch: one extra `get_batch_details` request per
 * form open, in exchange for a form that is correct on a cold deep link with no
 * page state at all — which is the whole point of routing it. `batchName` is a
 * getter rather than a string for the same reuse reason: the resource follows
 * the route param instead of freezing the one setup happened to see.
 */
export function useBatchDetails(batchName: () => string): BatchDetailsResource {
	const batch = createResource({
		url: 'lms.lms.utils.get_batch_details',
		makeParams: () => ({ batch: batchName() }),
		auto: true,
	}) as unknown as BatchDetailsResource

	watch(batchName, () => batch.reload())

	return batch
}
