import { call } from 'frappe-ui'
import {
	computed,
	getCurrentInstance,
	inject,
	ref,
	unref,
	watch,
	type MaybeRef,
	type Ref,
} from 'vue'
import { IS_STUDENT_VIEW } from './useStudentView'

export type Permissions = Record<string, number>

type Fetcher = (
	doctype: string,
	names: string[]
) => Promise<Record<string, Permissions>>

export interface UsePermissionsOptions {
	/** null means Guest: deny everything, ask nobody. undefined means "logged in". */
	user?: string | null
	/** Overrides the injected Student View flag. */
	studentView?: boolean
	/** Answer to start from, so a caller that already has one issues no request. */
	seed?: Permissions
	fetcher?: Fetcher
}

const DENY: Permissions = Object.freeze({})

// One answer per document, shared by every caller on the page. The course
// outline mounts a row per lesson; without this each row would ask again.
const cache = new Map<string, Permissions>()
const inFlight = new Map<string, Promise<void>>()

// A plain Map is not reactive, and every caller reads it through a computed.
// Bumping this on each mutation is what makes an answer — or an invalidation —
// reach the components already on screen.
const revision = ref(0)

const key = (doctype: string, name: string) => `${doctype}:${name}`

function remember(doctype: string, name: string, answer: Permissions) {
	cache.set(key(doctype, name), answer)
	revision.value++
}

export function invalidatePermissions(doctype: string, name: string) {
	cache.delete(key(doctype, name))
	inFlight.delete(key(doctype, name))
	revision.value++
}

/** For a role change, which invalidates every answer at once. */
export function invalidateAllPermissions() {
	cache.clear()
	inFlight.clear()
	revision.value++
}

const defaultFetcher: Fetcher = (doctype, names) =>
	call('lms.lms.api.get_doc_permissions_many', { doctype, names })

// Names asked for in the same tick go out as one request — the reason the
// endpoint takes a list at all.
const queued = new Map<string, Set<string>>()
const waiters = new Map<string, Array<() => void>>()
let scheduled = false

function flush(fetcher: Fetcher) {
	scheduled = false
	const batches = new Map(queued)
	queued.clear()

	for (const [doctype, names] of batches) {
		const wanted = [...names]
		const done = waiters.get(doctype) ?? []
		waiters.delete(doctype)

		const settle = () => {
			for (const name of wanted) inFlight.delete(key(doctype, name))
			for (const fn of done) fn()
		}

		fetcher(doctype, wanted)
			.then((answers) => {
				for (const name of wanted) {
					// A name the server did not answer for stays unknown, which reads
					// as deny, rather than being cached as an empty grant.
					const answer = answers?.[name]
					if (answer) remember(doctype, name, answer)
				}
			})
			.catch(() => {
				// An unreachable server is not a grant. Leaving the cache empty keeps
				// every affordance hidden, which is the safe direction.
			})
			.finally(settle)
	}
}

function request(
	doctype: string,
	name: string,
	fetcher: Fetcher
): Promise<void> {
	const existing = inFlight.get(key(doctype, name))
	if (existing) return existing

	const promise = new Promise<void>((resolve) => {
		if (!queued.has(doctype)) queued.set(doctype, new Set())
		queued.get(doctype)!.add(name)
		if (!waiters.has(doctype)) waiters.set(doctype, [])
		waiters.get(doctype)!.push(resolve)
	})

	inFlight.set(key(doctype, name), promise)
	if (!scheduled) {
		scheduled = true
		queueMicrotask(() => flush(fetcher))
	}
	return promise
}

/**
 * Server permissions for one document, or for the doctype when no name is given.
 *
 * `can()` answers false until a real answer has arrived. A flicker is a UX bug;
 * a button that is live before the server has spoken is a correctness one.
 */
export function usePermissions(
	doctype: string,
	name?: MaybeRef<string | undefined>,
	options: UsePermissionsOptions = {}
) {
	const fetcher = options.fetcher ?? defaultFetcher
	const isGuest = options.user === null
	const loading = ref(false)

	// inject() only works during setup; the composable is also used from plain
	// modules and from tests.
	const injected = getCurrentInstance()
		? inject(IS_STUDENT_VIEW, undefined)
		: undefined
	const studentView = computed(() =>
		options.studentView !== undefined ? options.studentView : !!unref(injected)
	)

	const current = () => unref(name)

	if (options.seed && current()) {
		remember(doctype, current()!, options.seed)
	}

	const answer = computed<Permissions>(() => {
		revision.value
		const docname = current()
		if (isGuest || !docname) return DENY
		return cache.get(key(doctype, docname)) ?? DENY
	})

	const load = () => {
		const docname = current()
		if (isGuest || !docname) return
		if (cache.has(key(doctype, docname))) return
		loading.value = true
		request(doctype, docname, fetcher).then(() => {
			// Only clear the flag if we are still asking about the same document.
			if (current() === docname) loading.value = false
		})
	}

	// Synchronous: a consumer that reads can() in the same tick as the name
	// change must already see loading, not the previous document's answer.
	watch(() => current(), load, { immediate: true, flush: 'sync' })

	const can = (ptype: string): boolean => {
		if (isGuest) return false
		// Student View is a presentation mask over the real session, so it has to
		// win over the server answer — otherwise the preview keeps handing an
		// instructor the affordances the mask exists to remove.
		if (studentView.value && ptype !== 'read') return false
		return !!answer.value[ptype]
	}

	return {
		can,
		loading: loading as Ref<boolean>,
		invalidate: () => {
			const docname = current()
			if (docname) invalidatePermissions(doctype, docname)
		},
	}
}
