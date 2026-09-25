/**
 * Tests for the settings <-> URL hash sync. The hash is the source of truth:
 * /courses#settings/branding opens the settings dialog on the Branding tab.
 */
import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest'
import {
	computed,
	defineComponent,
	h,
	reactive,
	ref,
	type ComputedRef,
} from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import {
	pushSettingsHash,
	useSettingsHash,
} from '@/composables/useSettingsHash'
import type { SettingsRoutableGroup } from '@/types/settingsSchema'

const store = reactive<{ isSettingsOpen: boolean; activeTab: string | null }>({
	isSettingsOpen: false,
	activeTab: null,
})
vi.mock('@/stores/settings', () => ({
	useSettings: () => store,
}))

const tabs = computed<SettingsRoutableGroup[]>(() => [
	{
		label: 'Configuration',
		items: [
			{ label: 'General', slug: 'general' },
			{ label: 'Badges', slug: 'badges', records: true },
		],
	},
	{
		label: 'Users',
		items: [{ label: 'Users', slug: 'members' }],
	},
	{
		label: 'Customize',
		items: [{ label: 'Branding', slug: 'branding' }],
	},
])

const item = (slug: string) =>
	tabs.value.flatMap((tab) => tab.items).find((i) => i.slug === slug)!

// The store is module-level; a host left mounted from a previous test would keep
// reacting to it and drive its own router. Track and unmount.
let wrapper: VueWrapper | null = null

async function setup(
	initial = '/courses',
	source: ComputedRef<SettingsRoutableGroup[]> = tabs
) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/courses', component: { template: '<div />' } }],
	})
	router.push(initial)
	await router.isReady()

	let api: ReturnType<typeof useSettingsHash>
	const Host = defineComponent({
		setup() {
			api = useSettingsHash(source)
			return () => h('div')
		},
	})
	wrapper = mount(Host, { global: { plugins: [router] } })
	await flushPromises()
	return { router: router as Router, api: api! }
}

beforeEach(() => {
	store.isSettingsOpen = false
	store.activeTab = null
})

afterEach(() => {
	wrapper?.unmount()
	wrapper = null
})

describe('useSettingsHash', () => {
	it('stays closed without a settings hash', async () => {
		const { api } = await setup('/courses')
		expect(api.isOpen.value).toBe(false)
		expect(api.activeTab.value).toBe(null)
		expect(store.isSettingsOpen).toBe(false)
	})

	// A bare '#settings' is the batch/course detail pages' own Settings tab —
	// those pages address their tabs as '#<label>'. It must not open the modal.
	it('ignores a bare #settings, which belongs to a page tab', async () => {
		const { router, api } = await setup('/courses#settings')
		expect(api.isOpen.value).toBe(false)
		expect(store.isSettingsOpen).toBe(false)
		expect(router.currentRoute.value.hash).toBe('#settings')
	})

	it("leaves other pages' tab hashes alone", async () => {
		const { api } = await setup('/courses#students')
		expect(api.isOpen.value).toBe(false)
	})

	it('resolves a slug to its tab', async () => {
		const { api } = await setup('/courses#settings/branding')
		expect(api.activeTab.value?.label).toBe('Branding')
		expect(store.activeTab).toBe('Branding')
	})

	it('falls back to the default tab on an unknown slug and replaces the hash', async () => {
		const { router, api } = await setup('/courses#settings/nope')
		await flushPromises()
		expect(api.activeTab.value?.label).toBe('General')
		expect(router.currentRoute.value.hash).toBe('#settings/general')
	})

	// The real tab list loads asynchronously, so on a deep link it is still
	// empty when the hash first arrives. A slug can only be judged unknown
	// once there are tabs to judge it against.
	it('falls back once the tabs arrive, when they load after the hash', async () => {
		const loaded = ref(false)
		const asyncTabs = computed<SettingsRoutableGroup[]>(() =>
			loaded.value ? tabs.value : []
		)

		const { router, api } = await setup('/courses#settings/nope', asyncTabs)
		expect(api.activeTab.value).toBe(null)
		expect(router.currentRoute.value.hash).toBe('#settings/nope')

		loaded.value = true
		await flushPromises()

		expect(api.activeTab.value?.label).toBe('General')
		expect(router.currentRoute.value.hash).toBe('#settings/general')
	})

	it('normalises an empty slug, which still opens the default tab', async () => {
		const { router, api } = await setup('/courses#settings/')
		await flushPromises()
		expect(api.activeTab.value?.label).toBe('General')
		expect(router.currentRoute.value.hash).toBe('#settings/general')
	})

	it('does not push a duplicate entry for the tab already shown', async () => {
		const { router, api } = await setup('/courses#settings/general')

		api.selectTab(item('general'))
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/general')
		expect(router.options.history.state.settingsDepth ?? 0).toBe(0)
	})

	it('pushes a history entry per tab switch, and back walks them', async () => {
		const { router, api } = await setup('/courses')

		pushSettingsHash(router)
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/general')

		api.selectTab(item('branding'))
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/branding')

		router.back()
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/general')
		expect(api.isOpen.value).toBe(true)

		router.back()
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('')
		expect(api.isOpen.value).toBe(false)
		expect(store.isSettingsOpen).toBe(false)
	})

	it('closes in one step after several tab switches', async () => {
		const { router, api } = await setup('/courses')

		pushSettingsHash(router, 'general')
		await flushPromises()
		api.selectTab(item('members'))
		await flushPromises()
		api.selectTab(item('branding'))
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/branding')

		api.close()
		await flushPromises()
		expect(api.isOpen.value).toBe(false)
		expect(router.currentRoute.value.hash).toBe('')
		expect(router.currentRoute.value.path).toBe('/courses')
		expect(store.isSettingsOpen).toBe(false)
	})

	it('closing a deep link replaces the hash instead of leaving the app', async () => {
		const { router, api } = await setup('/courses#settings/branding')
		const back = vi.spyOn(router, 'go')

		api.close()
		await flushPromises()
		expect(back).not.toHaveBeenCalled()
		expect(router.currentRoute.value.hash).toBe('')
		expect(router.currentRoute.value.path).toBe('/courses')
	})

	it('closing after switching tabs from a deep link leaves settings entirely', async () => {
		const { router, api } = await setup('/courses#settings/branding')

		api.selectTab(item('badges'))
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/badges')

		api.close()
		await flushPromises()
		expect(api.isOpen.value).toBe(false)
		expect(router.currentRoute.value.hash).toBe('')
	})

	it('openSettings(slug) opens that tab, and the store mirrors its label', async () => {
		const { router } = await setup('/courses')

		pushSettingsHash(router, 'members')
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/members')
		expect(store.isSettingsOpen).toBe(true)
		expect(store.activeTab).toBe('Users')
	})

	it('openSettings() with no slug is a no-op when settings is already open', async () => {
		const { router } = await setup('/courses#settings/branding')

		pushSettingsHash(router)
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/branding')
		expect(store.activeTab).toBe('Branding')
	})

	it('openSettings() with no slug opens the default tab', async () => {
		const { router } = await setup('/courses')

		pushSettingsHash(router)
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/general')
		expect(store.activeTab).toBe('General')
	})

	it('openSettings(slug, close) fires the callback, then navigates', async () => {
		const { router } = await setup('/courses')
		const calls: string[] = []
		const close = () => calls.push('closed')

		// what ZoomAccountForm's Link does: dismiss its popover, then switch tab
		const open = (slug: string, cb: () => void) => {
			cb()
			pushSettingsHash(router, slug)
		}
		open('members', close)
		await flushPromises()
		expect(calls).toEqual(['closed'])
		expect(router.currentRoute.value.hash).toBe('#settings/members')
	})

	it('the store is a mirror: writing it does not navigate', async () => {
		const { router } = await setup('/courses')

		store.isSettingsOpen = true
		store.activeTab = 'branding'
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('')
	})

	// A settingsDepth can outlive the settings entry that stamped it: a real
	// browser's replace() merges history.state, so a page's own filter sync
	// can carry a stale depth onto a non-settings entry. Trusting it would
	// make close() over-pop and eject the user from the app entirely.
	it('ignores a settingsDepth left behind on a non-settings entry', async () => {
		const { router, api } = await setup('/courses')

		// A non-settings entry that nonetheless carries a depth — what the page's
		// own filter sync leaves behind. It must differ from the current location,
		// or the navigation is a duplicate and the state never lands.
		await router.push({
			path: '/courses',
			query: { title: 'vue' },
			state: { settingsDepth: 4 },
		})
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('')
		expect(router.options.history.state.settingsDepth).toBe(4)

		// Opening must stamp depth 1 — there is exactly one entry to pop — not 5.
		pushSettingsHash(router, 'branding')
		await flushPromises()
		expect(router.options.history.state.settingsDepth).toBe(1)

		const go = vi.spyOn(router, 'go')
		api.close()
		await flushPromises()
		expect(go).toHaveBeenCalledWith(-1)
		expect(router.currentRoute.value.path).toBe('/courses')
		expect(router.currentRoute.value.hash).toBe('')
	})

	// The restore replace() must name its hash. vue-router defaults a missing hash
	// to '', which would silently eat a page's own tab hash.
	it('keeps the page hash when restoring the query on close', async () => {
		const { router, api } = await setup('/courses#settings/general')

		api.close()
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('')
	})

	// The query-restore on close is the one replace() that has a page hash to
	// lose. Without an explicit `hash`, vue-router defaults it to '' and the
	// restore eats '#students', dumping the user off the tab they were on.
	it("keeps the page's own tab hash when the restore fires on close", async () => {
		const { router, api } = await setup('/courses?title=vue#students')

		pushSettingsHash(router, 'branding')
		await flushPromises()
		expect(router.options.history.state.settingsDepth).toBe(1)

		// The page syncs a new filter while the dialog is open.
		router.replace({
			query: { title: 'react' },
			hash: router.currentRoute.value.hash,
			state: { settingsDepth: 1 },
		})
		await flushPromises()

		api.close()
		await flushPromises()
		expect(api.isOpen.value).toBe(false)
		// The entry we popped to predates the filter, so the restore fires — and it
		// must not take the page's tab hash down with it.
		expect(router.currentRoute.value.query.title).toBe('react')
		expect(router.currentRoute.value.hash).toBe('#students')
	})
})

describe('useSettingsHash records', () => {
	it('has no record on a list view', async () => {
		const { api } = await setup('/courses#settings/badges')
		expect(api.activeTab.value?.slug).toBe('badges')
		expect(api.activeRecord.value).toBe(null)
	})

	it('resolves the second segment to a record', async () => {
		const { api } = await setup('/courses#settings/badges/BDG-0001')
		expect(api.activeTab.value?.slug).toBe('badges')
		expect(api.activeRecord.value).toBe('BDG-0001')
	})

	it("treats 'new' as a record id like any other", async () => {
		const { api } = await setup('/courses#settings/badges/new')
		expect(api.activeRecord.value).toBe('new')
	})

	it('pushes an entry for a record, and back returns to the list', async () => {
		const { router, api } = await setup('/courses')

		pushSettingsHash(router, 'badges')
		await flushPromises()
		api.selectRecord('BDG-0001')
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/badges/BDG-0001')
		expect(router.options.history.state.settingsDepth).toBe(2)

		router.back()
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/badges')
		expect(api.activeRecord.value).toBe(null)
	})

	// Closing from a record pops the tab entry AND the record entry: one counter
	// covers both, because a record push increments the same settingsDepth.
	it('closes in one step from a record view', async () => {
		const { router, api } = await setup('/courses')

		pushSettingsHash(router, 'badges')
		await flushPromises()
		api.selectRecord('BDG-0001')
		await flushPromises()

		api.close()
		await flushPromises()
		expect(api.isOpen.value).toBe(false)
		expect(router.currentRoute.value.path).toBe('/courses')
		expect(router.currentRoute.value.hash).toBe('')
	})

	it('carries the page query into a record', async () => {
		const { router, api } = await setup('/courses?title=vue#settings/badges')

		api.selectRecord('BDG-0001')
		await flushPromises()
		expect(router.currentRoute.value.query).toEqual({ title: 'vue' })
	})

	// The bad-id fallback: the detail view could not load the record, so it drops
	// back to the list. replace(), not push() — a dead id must not sit in history
	// waiting for Back to land on it again.
	it('drops an unloadable record without leaving a history entry', async () => {
		const { router, api } = await setup('/courses')

		pushSettingsHash(router, 'badges')
		await flushPromises()
		api.selectRecord('BDG-9999')
		await flushPromises()

		api.selectRecord(null, { replace: true })
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/badges')

		router.back()
		await flushPromises()
		expect(api.isOpen.value).toBe(false)
	})

	// go() is async: until the pop lands, route.hash and the history state
	// still describe the entry we are leaving. A second drop in the same tick
	// would read the same depth and pop again, off the settings stack entirely.
	it('drops a record once when two drops race in the same tick', async () => {
		const { router, api } = await setup('/courses')

		pushSettingsHash(router, 'badges')
		await flushPromises()
		api.selectRecord('BDG-9999')
		await flushPromises()
		expect(router.options.history.state.settingsDepth).toBe(2)

		const go = vi.spyOn(router, 'go')
		api.selectRecord(null, { replace: true })
		api.selectRecord(null, { replace: true })
		await flushPromises()

		expect(go).toHaveBeenCalledTimes(1)
		expect(router.currentRoute.value.hash).toBe('#settings/badges')
		expect(api.isOpen.value).toBe(true)
	})

	// A drop can be refused by the unsaved-changes guard, and route.hash never
	// changes on abort — a `dropping` flag cleared only by the hash watcher
	// would stay stuck, killing the drop path for the rest of the session.
	it('can still drop a record after a drop was aborted by a guard', async () => {
		const { router, api } = await setup('/courses')

		pushSettingsHash(router, 'badges')
		await flushPromises()
		api.selectRecord('BDG-9999')
		await flushPromises()

		let abort = true
		const stop = router.beforeEach(() => (abort ? false : true))

		api.selectRecord(null, { replace: true })
		await flushPromises()
		// The guard refused, so we are still on the record.
		expect(router.currentRoute.value.hash).toBe('#settings/badges/BDG-9999')

		abort = false
		api.selectRecord(null, { replace: true })
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/badges')
		stop()
	})

	// A tab that does not opt into records cannot have one. '#settings/general/x'
	// is nonsense; normalise it away rather than render a list with a phantom id.
	it('strips a record from a tab that does not take records', async () => {
		const { router, api } = await setup('/courses#settings/general/BDG-0001')
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/general')
		expect(api.activeRecord.value).toBe(null)
	})

	// The slug still has to resolve. An unknown tab with a record falls back to
	// the default tab and drops the record with it.
	it('falls back to the default tab and drops the record on an unknown slug', async () => {
		const { router, api } = await setup('/courses#settings/nope/BDG-0001')
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/general')
		expect(api.activeRecord.value).toBe(null)
	})

	// A rename keeps the record open but changes its docname.
	// replaceRecord() rehashes the CURRENT entry in place, so Back still
	// lands on the list, not on a now-dead old-name entry.
	it('rehashes the current record in place on rename, keeping depth and Back', async () => {
		const { router, api } = await setup('/courses')

		pushSettingsHash(router, 'badges')
		await flushPromises()
		api.selectRecord('OLD')
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/badges/OLD')
		expect(router.options.history.state.settingsDepth).toBe(2)

		api.replaceRecord('NEW')
		await flushPromises()
		// (a) the hash names the new docname
		expect(router.currentRoute.value.hash).toBe('#settings/badges/NEW')
		// (b) depth is unchanged — a replace, not a push
		expect(router.options.history.state.settingsDepth).toBe(2)

		// (c) Back still returns to the list, one entry down
		router.back()
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/badges')
		expect(api.activeRecord.value).toBe(null)
	})
})

describe('useSettingsHash: dismissing twice', () => {
	/**
	 * `close()` had no re-entrancy guard. `router.go()` is async, so the dialog
	 * is still visibly open when a second dismiss arrives and pops again.
	 * Escape twice quickly went back four entries instead of two.
	 */
	it('pops once when two dismisses arrive before the first lands', async () => {
		const { router, api } = await setup('/courses')

		pushSettingsHash(router, 'badges')
		await flushPromises()
		api.selectRecord('badge-1')
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/badges/badge-1')
		expect(router.options.history.state.settingsDepth).toBe(2)

		// createMemoryHistory applies go() synchronously; stubbing it models a real
		// browser's async go(), where the dialog is still open for the second dismiss.
		const go = vi.spyOn(router, 'go').mockImplementation(() => {})
		api.close()
		api.close()

		expect(go).toHaveBeenCalledTimes(1)
		expect(go).toHaveBeenCalledWith(-2)
	})
})

describe('useSettingsHash: a dismiss the guard refuses', () => {
	/**
	 * The re-entrancy flag must clear on aborts too: a refused navigation never
	 * changes the hash, so a `closing` flag cleared only by the hash watcher
	 * would leave `close()` dead for the rest of the session.
	 */
	it('still closes after an earlier dismiss was refused', async () => {
		const { router, api } = await setup('/courses')

		pushSettingsHash(router, 'badges')
		await flushPromises()
		api.selectRecord('badge-1')
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/badges/badge-1')

		const refuse = router.beforeEach(() => false)
		api.close()
		await flushPromises()
		expect(router.currentRoute.value.hash).toBe('#settings/badges/badge-1')

		refuse()
		api.close()
		await flushPromises()

		expect(api.isOpen.value).toBe(false)
		expect(router.currentRoute.value.hash).toBe('')
	})
})
