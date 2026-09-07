import { computed, reactive, ref, watch } from 'vue'
import { createListResource } from 'frappe-ui'

export const SETTINGS_PAGE_LENGTH = 13

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

export interface SettingsListSource<TRow = Record<string, any>> {
	resource: SettingsListResource<TRow>
	search: string
	rows: TRow[]
	loading: boolean
	hasNextPage: boolean
	loadMore: () => Promise<unknown>
	reload: () => Promise<unknown>
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

	return reactive({
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
}
