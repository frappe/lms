import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type Router,
	type RouterHistory,
} from 'vue-router'
import { openFormRoute, useFormRoute } from '@/composables/useFormRoute'

// createMemoryHistory's own replace() stores state VERBATIM (no merge with
// the entry it replaces) — see its source, routerHistory.replace(to, state) =>
// setLocation(to, state). createWebHistory's replace() instead merges the new
// state on top of the current entry's state (vue-router's
// useHistoryStateNavigation spreads history.state before the caller's data).
// A plain memory-history test therefore cannot reproduce the leaking-marker
// bug: it would pass even against the old, unfixed saveAndReplace. This wraps
// a real memory history so its replace() merges the same way, without
// touching the live location/state getters the router relies on internally.
const makeMergingMemoryHistory = (): RouterHistory => {
	const history = createMemoryHistory()
	const originalReplace = history.replace.bind(history)
	history.replace = (to: string, state?: unknown) =>
		originalReplace(to, { ...(history.state as object), ...(state as object) })
	return history
}

// List renders a nested router-view so its child form route ('new') actually
// mounts. h(RouterView) (the component), not h('router-view') (a literal
// string), is required: manual h() calls never resolve string tag names
// through the app's registered components the way a compiled template does.
const List = defineComponent({
	render: () => h('div', ['LIST', h(RouterView)]),
})
const Start = defineComponent({ render: () => h('div', 'START') })

// The form route component. It calls useFormRoute in setup, exactly as a real
// routed form does, and exposes the returned handles so tests can drive them.
let handles: ReturnType<typeof useFormRoute>
const Form = defineComponent({
	setup() {
		handles = useFormRoute({ name: 'Batches' })
		return () => h('div', 'FORM')
	},
})
// A second, distinct component for the form-to-form test below. Vue Router's
// RouterView has no :key on the matched record, so navigating between two
// routes that resolve to the SAME component object patches the existing
// instance in place rather than remounting it — setup() would never rerun and
// `handles` would stay frozen on the first form. A different component type
// forces Vue to unmount/mount, which is what actually happens when a real app
// navigates from one distinct form route to another.
const Form2 = defineComponent({
	setup() {
		handles = useFormRoute({ name: 'Batches' })
		return () => h('div', 'FORM2')
	},
})

const makeRouter = (history: RouterHistory = createMemoryHistory()): Router =>
	createRouter({
		history,
		routes: [
			{ path: '/', name: 'Start', component: Start },
			{
				path: '/batches',
				name: 'Batches',
				component: List,
				children: [
					{ path: 'new', name: 'NewBatch', component: Form },
					// A second form route, reachable only via saveAndReplace in the
					// test below — mirrors a later cycle where one form can navigate
					// straight to another.
					{ path: 'edit', name: 'EditBatch', component: Form2 },
				],
			},
		],
	})

const mountAt = async (router: Router) => {
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: { plugins: [router] },
	})
	await flushPromises()
	return wrapper
}

describe('useFormRoute', () => {
	it('pops the entry when the form was opened through openFormRoute', async () => {
		const router = makeRouter()
		await router.push({ name: 'Start' })
		await router.push({ name: 'Batches' })
		await openFormRoute(router, { name: 'NewBatch' })
		await mountAt(router)

		expect(handles.openedByUs).toBe(true)

		handles.close()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Batches')

		// A pop leaves the form reachable by Forward. A replace would have
		// destroyed that entry — this is what distinguishes the two branches.
		router.forward()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('NewBatch')
	})

	it('openFormRoute merges FORM_ENTRY into state rather than clobbering it', async () => {
		const router = makeRouter()
		await router.push({ name: 'Batches' })
		await openFormRoute(router, { name: 'NewBatch', state: { draftId: 'abc' } })

		expect(router.options.history.state).toMatchObject({
			lmsFormEntry: true,
			draftId: 'abc',
		})
	})

	it('close() guards against a second call before the first pop flushes', async () => {
		const router = makeRouter()
		await router.push({ name: 'Start' })
		await router.push({ name: 'Batches' })
		await openFormRoute(router, { name: 'NewBatch' })
		await mountAt(router)

		// router.back() is async; the component (and `handles`) stay alive until
		// the pop actually flushes. Two synchronous calls, as a double-tapped
		// back chevron or two Escape presses would produce, must only pop once.
		handles.close()
		handles.close()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Batches')

		// If the guard failed, the second close() would have popped past
		// Batches to Start, and Forward from Batches would land on Start, not
		// NewBatch. Proves only one entry was consumed.
		router.forward()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('NewBatch')
	})

	it('replaces to the parent when the form was reached directly', async () => {
		const router = makeRouter()
		// A deep link / reload: the entry exists, but we did not stamp it.
		await router.push({ name: 'NewBatch' })
		await mountAt(router)

		expect(handles.openedByUs).toBe(false)

		handles.close()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Batches')

		// The decisive assertion: because close() REPLACED, the form is gone from
		// the stack. Going back must not return to it.
		router.back()
		await flushPromises()
		expect(router.currentRoute.value.name).not.toBe('NewBatch')
	})

	it('saveAndReplace consumes the form entry so back never returns to it', async () => {
		const router = makeRouter()
		await router.push({ name: 'Batches' })
		await openFormRoute(router, { name: 'NewBatch' })
		await mountAt(router)

		handles.saveAndReplace({ name: 'Start' })
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Start')

		router.back()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Batches')
	})

	it('saveAndReplace does not leak the form-entry marker onto the destination', async () => {
		// Under createMemoryHistory this would pass even unfixed (it doesn't
		// merge state), so the merge behavior is simulated explicitly.
		const router = makeRouter(makeMergingMemoryHistory())
		await router.push({ name: 'Batches' })
		await openFormRoute(router, { name: 'NewBatch' })
		await mountAt(router)
		expect(handles.openedByUs).toBe(true)

		// NewBatch saves and replaces itself with a second form route — the
		// scenario a later cycle introduces (one form navigating to another).
		handles.saveAndReplace({ name: 'EditBatch' })
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('EditBatch')

		// `handles` was reassigned by EditBatch's own setup() call. Without the
		// fix, EditBatch inherits NewBatch's stamp from the merge and wrongly
		// believes WE opened it, so its own close() would call back() out of
		// the app instead of replacing to its parent.
		expect(handles.openedByUs).toBe(false)
	})
})
