import { createResource, toast } from 'frappe-ui'
import type { DialogAction } from 'frappe-ui'
import { computed, ref, shallowRef, watch } from 'vue'
import type { Ref, WatchSource } from 'vue'
import { bulkDeleteDocs } from '@/utils/bulkDelete'
import { groupOf } from '@/utils/dashboard/filters'
import type { LoadFailure } from '@/utils/loadError'
import { resourceErrorMessage } from '@/utils/resource'
import type { FilterChoice } from '@/types'

interface StudentsPage<Row> {
	total: number
	rows: Row[]
}

export interface StudentsPaging {
	search: string | null
	start: number
	page_length: number
}

interface DashboardStudentsOptions<
	Row,
	Filter extends string,
	Params extends StudentsPaging
> {
	url: string
	cache: [string, string]
	doctype: string
	stage: Ref<Filter | null>
	filterGroups: Filter[][]
	filterLabels: Record<Filter, () => string>
	params: (paging: StudentsPaging) => Params
	filters?: WatchSource[]
	onRemoved: (done: Row[]) => void
}

const sameParams = (a: StudentsPaging, b: StudentsPaging): boolean =>
	JSON.stringify(a) === JSON.stringify(b)

// The paged, filtered student list of a course or batch dashboard, and the
// removal of students from it.
export function useDashboardStudents<
	Row extends { enrollment: string },
	Filter extends string,
	Params extends StudentsPaging
>(options: DashboardStudentsOptions<Row, Filter, Params>) {
	const search = ref<string>('')
	const start = ref<number>(0)
	const pageLength = ref<number>(20)

	// The cache key is also how the enroll form reaches this list to reload it.
	// Params go in per fetch, never through makeParams: a cached resource keeps
	// the first mount's closure, which would read a dead instance.
	const students = createResource<StudentsPage<Row>>({
		url: options.url,
		cache: options.cache,
	})

	// The page on screen and the params it answers, never the resource's own
	// data: that is whichever reply landed last, or the previous visit's page.
	const shown = shallowRef<{ params: Params; page: StudentsPage<Row> } | null>(
		null
	)
	let latest: Params | null = null
	let loads = 0
	let submitting = false

	const load = (): void => {
		const params = options.params({
			search: search.value.trim() || null,
			start: start.value,
			page_length: pageLength.value,
		})
		const current = ++loads
		latest = params
		submitting = true
		const reply = students.submit(params)
		submitting = false
		reply.then(
			(page: StudentsPage<Row> | null) => {
				if (current === loads && page) shown.value = { params, page }
			},
			(error: unknown) => {
				if (current !== loads) return
				// A failed refresh keeps its page; any other page on screen answers
				// params the user has left, so the list itself says it failed.
				if (shown.value && sameParams(shown.value.params, params))
					toast.error(
						resourceErrorMessage(error, __('Could not load students'))
					)
				else shown.value = null
			}
		)
	}

	// A reload from outside, through the cache key, refetches the latest params;
	// its page shows unless an own load started since. Own pages land in load().
	watch(
		() => students.promise,
		(promise) => {
			if (!promise || submitting) return
			const after = loads
			promise.then(
				(page) => {
					if (after === loads && page && latest)
						shown.value = { params: latest, page }
				},
				() => undefined
			)
		},
		{ flush: 'sync' }
	)

	const showPage = (offset: number): void => {
		start.value = Math.max(0, offset)
		load()
	}

	watch(
		[options.stage, search, pageLength, ...(options.filters ?? [])],
		() => showPage(0),
		{ immediate: true }
	)

	const rows = computed<Row[]>(() => shown.value?.page.rows ?? [])
	const total = computed<number>(() => shown.value?.page.total ?? 0)
	const shownStart = computed<number>(() => shown.value?.params.start ?? 0)
	const loading = computed<boolean>(() => !shown.value && students.loading)
	const error = computed<LoadFailure | null>(() =>
		shown.value || students.loading
			? null
			: (students.error as LoadFailure | null)
	)

	const listKey = computed<string>(
		() => `${JSON.stringify(shown.value?.params ?? null)}|${total.value}`
	)

	// The filters the applied one can be swapped for, when it has a group.
	const filterChoices = computed<FilterChoice[]>(() => {
		const stage = options.stage.value
		const group = stage ? groupOf(options.filterGroups, stage) : []
		return group.length > 1
			? group.map((value) => ({ value, label: options.filterLabels[value]() }))
			: []
	})

	const pending = shallowRef<Row[]>([])
	const showRemoveDialog = ref<boolean>(false)
	let clearSelection: (() => void) | null = null

	const confirmRemove = (
		selected: Row[],
		onDone: (() => void) | null = null
	): void => {
		if (!selected.length) return
		pending.value = selected
		clearSelection = onDone
		showRemoveDialog.value = true
	}

	const confirmBulkRemove = (
		selections: ReadonlySet<unknown>,
		unselectAll: () => void
	): void => {
		confirmRemove(
			rows.value.filter((row) => selections.has(row.enrollment)),
			unselectAll
		)
	}

	const removeStudents = async (close: () => void): Promise<void> => {
		const selected = pending.value
		const { failed, firstError } = await bulkDeleteDocs(
			options.doctype,
			new Set(selected.map((row) => row.enrollment))
		)
		if (failed.length)
			toast.error(
				resourceErrorMessage(firstError, __('Could not remove student'))
			)
		const done = selected.filter((row) => !failed.includes(row.enrollment))
		if (!done.length) return
		close()
		clearSelection?.()
		const pageEmptied =
			done.length === rows.value.length && shownStart.value > 0
		showPage(
			pageEmptied ? shownStart.value - pageLength.value : shownStart.value
		)
		options.onRemoved(done)
	}

	const removeActions = computed<DialogAction[]>(() => [
		{ label: __('Cancel'), onClick: ({ close }) => close() },
		{
			label: __('Remove'),
			variant: 'solid',
			theme: 'red',
			onClick: ({ close }) => removeStudents(close),
		},
	])

	return {
		search,
		pageLength,
		rows,
		total,
		start: shownStart,
		loading,
		error,
		reload: load,
		listKey,
		filterChoices,
		showPage,
		pending,
		showRemoveDialog,
		confirmRemove,
		confirmBulkRemove,
		removeActions,
	}
}
