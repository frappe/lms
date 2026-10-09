import { onScopeDispose, ref, watch, type Ref } from 'vue'
import type { Router } from 'vue-router'

// Confirm before a navigation discards an unsaved settings form.
// A set, not one slot: Settings.vue renders every panel in a `v-for`, so
// several are registered at once, and one slot would leave earlier panels unguarded.
type DirtyCheck = () => boolean

interface DirtyEntry {
	isDirty: DirtyCheck
	discard?: () => void
}

const registered = new Set<DirtyEntry>()

// Suppressed for the rest of the navigation the user answered, so a redirect
// chained off it does not ask a second time for one decision. Cleared by the
// router's afterEach, which fires once the whole chain settles.
const suppressed = new Set<DirtyEntry>()

// Register a form from its setup; it deregisters itself when that component
// goes away. `discard` is what the form does on Discard: without it the
// guard only stops asking, and the next Save writes the edits anyway.
export function useDirtyGuard(isDirty: DirtyCheck, discard?: () => void) {
	const entry: DirtyEntry = { isDirty, discard }
	registered.add(entry)
	onScopeDispose(() => {
		registered.delete(entry)
		suppressed.delete(entry)
	})
}

// Install the guard on the router (Settings.vue does this once). Must abort
// (return false), never navigate: navigating from a guard cancels the pop, and vue-router won't restore the URL.
export function installDirtyGuard(
	router: Router,
	confirm: () => Promise<boolean>
) {
	// A stub router in a test may not have afterEach; the suppression below is
	// then simply never released, which is the old drop-the-checker behaviour.
	const stopAfter = router.afterEach?.(() => suppressed.clear()) ?? (() => {})
	const stopBefore = router.beforeEach(async (to, from) => {
		const dirty = [...registered].filter(
			(entry) => !suppressed.has(entry) && entry.isDirty()
		)
		if (!dirty.length) return true
		// Same view: a query change (the page's filters) is not leaving the form.
		if (to.hash === from.hash) return true

		if (!(await confirm())) return false

		// Throw the edits away, then stop asking for the rest of this navigation.
		// Suppressed rather than deleted, so a form still mounted is guarded
		// again the next time it goes dirty.
		for (const entry of dirty) {
			entry.discard?.()
			suppressed.add(entry)
		}
		return true
	})
	return () => {
		stopBefore()
		stopAfter()
	}
}

// Keys that move on their own (new `modified`/`__last_sync_on` on every
// reload, whether or not anything visible changed); comparing them fires a false prompt.
const VOLATILE = new Set([
	'creation',
	'docstatus',
	'idx',
	'modified',
	'modified_by',
	'owner',
])

const isVolatile = (key: string) => key.startsWith('__') || VOLATILE.has(key)

// Key order is not meaning: sort, and drop volatile keys, before comparing.
const stable = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(stable)
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {}
		for (const key of Object.keys(value as object).sort()) {
			if (isVolatile(key)) continue
			out[key] = stable((value as Record<string, unknown>)[key])
		}
		return out
	}
	return value
}

const serialize = (value: unknown) => JSON.stringify(stable(value))

// Guard a detail form against the state it loaded with. Re-baseline only
// when a replaced doc was still clean; a dirty prev keeps its baseline.
export function useDirtyDoc(doc: Ref<any>) {
	let pristine: string | null = null
	const snapshot = () => {
		if (pristine === null && doc.value) pristine = serialize(doc.value)
		return pristine
	}
	watch(
		doc,
		(next, prev) => {
			if (!next) return
			// A prev already dirty keeps its baseline; it's a real edit, not a reload.
			if (pristine === null || (prev && serialize(prev) === pristine)) {
				pristine = serialize(next)
			}
		},
		{ immediate: true }
	)
	useDirtyGuard(() => !!doc.value && serialize(doc.value) !== snapshot())

	// A save is the new baseline; re-snapshot, don't latch a flag (a form stays
	// open after save and must be guarded again).
	return {
		markSaved: () => {
			pristine = doc.value ? serialize(doc.value) : null
		},
	}
}

// The confirm dialog's state, kept here (not a component) so the guard can
// await an answer from inside a navigation. Alias `show` in <script setup>,
// since Vue only unwraps top-level refs.
export const discardPrompt = { show: ref(false) }

let resolver: ((ok: boolean) => void) | null = null

export function confirmDiscard(): Promise<boolean> {
	// A second prompt can open mid-flight (browser-Back twice); settle the
	// one being superseded as FALSE rather than leak its promise.
	answerDiscard(false)
	discardPrompt.show.value = true
	return new Promise<boolean>((resolve) => {
		resolver = resolve
	})
}

// Safe against watch(show)'s dismissal-as-cancel: nulls `resolver` synchronously,
// so its re-entrant call finds nothing to resolve.
export function answerDiscard(ok: boolean) {
	discardPrompt.show.value = false
	const resolve = resolver
	resolver = null
	resolve?.(ok)
}
