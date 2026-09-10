import {
	computed,
	getCurrentScope,
	onScopeDispose,
	reactive,
	ref,
	watch,
	type Ref,
} from 'vue'
import { createListResource, createResource } from 'frappe-ui'

export const SETTINGS_PAGE_LENGTH = 13

/**
 * The settings lists on screen, by doctype. A row action lives in a config
 * module handed the row and nothing else, so a delete has no way to tell
 * the list to refetch. frappe-ui keeps this registry internally only.
 */
const liveLists = new Map<string, Set<{ reload: () => Promise<unknown> }>>()

/** Refetches every list showing `doctype`, first page first. */
export function reloadSettingsLists(doctype: string): Promise<unknown> {
	const lists = liveLists.get(doctype)
	if (!lists?.size) return Promise.resolve()
	return Promise.all([...lists].map((list) => list.reload()))
}

export interface ResourceCallbacks<T = unknown> {
	onSuccess?: (data: T) => void
	onError?: (error: { messages?: string[] }) => void
}

/**
 * The slice of frappe-ui's list resource the settings panels touch. Declared
 * here because the package ships `ListResource` only as an internal .d.ts and
 * re-exports neither it nor the path, so there is nothing to import.
 */
export interface SettingsListResource<TRow = Record<string, any>> {
	data: TRow[] | null
	start: number
	pageLength: number
	hasNextPage: boolean
	list: { loading: boolean; fetch: () => Promise<unknown> }
	delete: { submit: (name: string, callbacks?: ResourceCallbacks) => void }
	insert: {
		submit: (values: Partial<TRow>, callbacks?: ResourceCallbacks) => void
	}
	setValue: {
		submit: (values: Partial<TRow>, callbacks?: ResourceCallbacks) => void
	}
	update: (options: Record<string, unknown>) => void
	reload: () => Promise<TRow[] | null>
}

export type SettingsListFilters = Record<string, any> | any[][]

export interface SettingsListResourceOptions {
	doctype: string
	fields: string[]
	searchFields?: string[]
	orderBy?: string
	filters?: SettingsListFilters
	cache?: string | string[]
	auto?: boolean
	transform?: (data: any[]) => any[]
}

/**
 * What a rendered list needs, and nothing about where the rows came from.
 * A doctype list and a method-backed one differ in how they fetch, but a
 * panel renders them identically, which is what lets SettingsListPanel hold either.
 */
export interface SettingsListView<TRow = Record<string, any>> {
	search: string
	rows: TRow[]
	loading: boolean
	hasNextPage: boolean
	loadMore: () => Promise<unknown>
	reload: () => Promise<unknown>
}

export interface SettingsListSource<TRow = Record<string, any>>
	extends SettingsListView<TRow> {
	resource: SettingsListResource<TRow>
	applyFilters: (filters: SettingsListFilters) => Promise<unknown>
	remove: (
		name: string,
		callbacks?: {
			onSuccess?: () => void
			onError?: (error: { messages?: string[] }) => void
		}
	) => Promise<unknown>
}

export function useSettingsListResource<TRow = Record<string, any>>(
	options: SettingsListResourceOptions
): SettingsListSource<TRow> {
	const search = ref('')
	const baseFilters = options.filters ?? {}

	const resource = createListResource({
		doctype: options.doctype,
		fields: options.fields,
		orderBy: options.orderBy,
		filters: baseFilters,
		cache: options.cache,
		transform: options.transform,
		pageLength: SETTINGS_PAGE_LENGTH,
		auto: false,
	}) as unknown as SettingsListResource<TRow>

	// Requests are serialised because frappe-ui's resources carry no sequence
	// number: whichever response lands last wins. A Load More issued before a
	// search would otherwise overwrite the search results with unfiltered rows.
	let inFlight: Promise<unknown> = Promise.resolve()
	const enqueue = (run: () => unknown) => {
		const next = inFlight.catch(() => {}).then(() => run())
		inFlight = next
		return next
	}

	const searchFilters = (term: string) => {
		if (!term || !options.searchFields?.length) return []
		return options.searchFields.map((field) => [field, 'like', `%${term}%`])
	}

	// `reload()` rewrites pageLength to the number of rows already loaded
	// whenever start > 0, so narrowing the list after Load More would ask for 26
	// rows in one page and leave paging skewed. Going back to start 0 prevents it.
	const fetchFirstPage = () =>
		enqueue(() => {
			resource.start = 0
			return resource.reload()
		})

	// A cached resource comes back carrying the previous mount's orFilters and
	// start, and createListResource returns it before applying any new option,
	// so the panel would reopen filtered by a search its box no longer shows.
	resource.update({ orFilters: [], filters: baseFilters })
	if (options.auto ?? true) fetchFirstPage()

	watch(search, (term) => {
		resource.update({ orFilters: searchFilters(term) })
		fetchFirstPage()
	})

	const applyFilters = (filters: SettingsListFilters) => {
		resource.update({ filters })
		return fetchFirstPage()
	}

	const loadMore = () =>
		enqueue(() => {
			resource.start = resource.start + resource.pageLength
			return resource.list.fetch()
		})

	// frappe-ui's own delete handler refetches with `fetch()`, which keeps the
	// current start; past page one that concatenates onto the rows already shown
	// and the deleted row stays on screen. The list has to go back to page one.
	const remove: SettingsListSource<TRow>['remove'] = (name, callbacks = {}) =>
		enqueue(
			() =>
				new Promise((resolve) => {
					resource.delete.submit(name, {
						onSuccess: () => {
							resource.start = 0
							resolve(resource.reload())
							callbacks.onSuccess?.()
						},
						onError: (error: { messages?: string[] }) => {
							callbacks.onError?.(error)
							resolve(undefined)
						},
					})
				})
		)

	const source = reactive({
		resource,
		search,
		rows: computed(() => resource.data || []),
		loading: computed(() => Boolean(resource.list?.loading)),
		hasNextPage: computed(() => Boolean(resource.hasNextPage)),
		loadMore,
		reload: fetchFirstPage,
		applyFilters,
		remove,
	}) as SettingsListSource<TRow>

	const registered = liveLists.get(options.doctype) ?? new Set()
	registered.add(source)
	liveLists.set(options.doctype, registered)
	// A panel that has gone leaves nothing to refetch. Guarded because this is
	// also called outside a component, where there is no scope to dispose.
	if (getCurrentScope()) onScopeDispose(() => registered.delete(source))

	return source
}

export interface SettingsMethodResourceOptions {
	/** A whitelisted method returning one page of rows. */
	method: string
	/**
	 * The doctype the rows belong to, as an invalidation key only:
	 * `reloadSettingsLists(doctype)` reaches this list too, so a delete from a
	 * row menu can refetch without holding the resource behind it.
	 */
	doctype?: string
	/** Extra request params, read at call time: a header filter's value. */
	params?: () => Record<string, unknown>
	/**
	 * The server's own page size. Load More is offered while a page comes back
	 * full, so this has to match what the method pages at.
	 */
	pageLength?: number
	auto?: boolean
}

/**
 * A settings list backed by a whitelisted method rather than a doctype;
 * paging is hand-rolled since createListResource only builds get_list calls.
 * No frappe-ui `cache` key: a remounted panel would otherwise inherit a resource still writing into the unmounted one's state.
 */
export function useSettingsMethodResource<TRow = Record<string, any>>(
	options: SettingsMethodResourceOptions
): SettingsListView<TRow> {
	const search = ref('')
	const rows = ref([]) as Ref<TRow[]>
	const start = ref(0)
	const hasNextPage = ref(false)
	const loading = ref(false)
	const pageLength = options.pageLength ?? SETTINGS_PAGE_LENGTH

	const resource = createResource({
		url: options.method,
		makeParams: () => ({
			search: search.value,
			start: start.value,
			...options.params?.(),
		}),
		auto: false,
	}) as unknown as { reload: () => Promise<TRow[] | null> }

	// createResource carries no request sequence and aborts nothing, so two
	// calls in flight both resolve and both append. Each call takes a token,
	// and a superseded response is dropped, so the newer one owns the offset.
	let requestToken = 0

	const fetchPage = async (): Promise<void> => {
		const token = ++requestToken
		loading.value = true
		let data: TRow[] | null = null
		try {
			data = await resource.reload()
		} catch (error) {
			console.error(error)
		}
		if (token !== requestToken) return
		loading.value = false
		if (!data) return
		rows.value = rows.value.concat(data)
		// Paged by what the server actually returned, not the constant. An
		// exact-equality check would hide Load More the moment the two disagree.
		start.value = start.value + data.length
		hasNextPage.value = data.length >= pageLength
	}

	// Back to the first page, dropping what's on screen: the search term and
	// filter both go to the server, so a match past page one is reachable without Load More.
	const reload = (): Promise<void> => {
		rows.value = []
		start.value = 0
		hasNextPage.value = false
		return fetchPage()
	}

	watch(search, () => reload())

	if (options.auto ?? true) reload()

	const source = reactive({
		search,
		rows,
		loading,
		hasNextPage,
		loadMore: fetchPage,
		reload,
	}) as SettingsListView<TRow>

	const key = options.doctype ?? options.method
	const registered = liveLists.get(key) ?? new Set()
	registered.add(source)
	liveLists.set(key, registered)
	if (getCurrentScope()) onScopeDispose(() => registered.delete(source))

	return source
}
