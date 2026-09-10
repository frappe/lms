import { onScopeDispose, ref, watch, type Ref } from 'vue'
import type { Router } from 'vue-router'

// Confirm before a navigation discards an unsaved settings form.
// A set, not one slot: Settings.vue renders every panel in a `v-for`, so
// several are registered at once, and one slot would leave earlier panels unguarded.
type DirtyCheck = () => boolean

const registered = new Set<DirtyCheck>()

// Register a form from its setup; it deregisters itself when that component
// goes away. Registering while showing a list is harmless — a list is clean.
export function useDirtyGuard(isDirty: DirtyCheck) {
	registered.add(isDirty)
	onScopeDispose(() => {
		registered.delete(isDirty)
	})
}

// Install the guard on the router (Settings.vue does this once). Must abort
// (return false), never navigate: navigating from a guard cancels the pop, and vue-router won't restore the URL.
export function installDirtyGuard(
	router: Router,
	confirm: () => Promise<boolean>
) {
	return router.beforeEach(async (to, from) => {
		const dirty = [...registered].filter((isDirty) => isDirty())
		if (!dirty.length) return true
		// Same view: a query change (the page's filters) is not leaving the form.
		if (to.hash === from.hash) return true

		if (!(await confirm())) return false

		// Discarding: drop every checker now, so a redirect chained off this
		// navigation does not ask again for the same decision.
		for (const isDirty of dirty) registered.delete(isDirty)
		return true
	})
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
