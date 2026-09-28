<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:title="__(config.title)"
		layout="list"
		:columns="config.columns"
		:rows="submissions.data || []"
		:loading="submissions.loading"
		:total-count="totalSubmissions.data ?? null"
		:has-next-page="submissions.hasNextPage"
		:list-options="listOptions"
		v-model:page-length="pageLength"
		:empty-name="config.emptyName"
		:empty-icon="config.emptyIcon"
		@load-more="submissions.next()"
	>
		<template #filters>
			<template v-for="field in config.filters" :key="field.key">
				<Link
					v-if="field.doctype"
					:doctype="field.doctype"
					:modelValue="filterValue(field.key)"
					:placeholder="__(field.placeholder)"
					:aria-label="__(field.placeholder)"
					:readonly="isLocked(field.key)"
					@update:modelValue="(value: string) => setFilter(field.key, value)"
				/>
				<Select
					v-else
					:modelValue="filterValue(field.key)"
					:options="field.options"
					:placeholder="__(field.placeholder)"
					:aria-label="__(field.placeholder)"
					@update:modelValue="
						(value?: SelectOptionValue) =>
							setFilter(field.key, (value as string) ?? '')
					"
				/>
			</template>
		</template>

		<template #cell="cellProps">
			<slot name="cell" v-bind="cellProps">
				<div>{{ cellProps.value }}</div>
			</slot>
		</template>

		<template v-if="canDelete" #selection-actions="{ unselectAll, selections }">
			<span class="sr-only" role="status">{{ deleteAnnouncement }}</span>
			<Button
				variant="ghost"
				:label="deleting ? __('Deleting…') : __('Delete')"
				:aria-disabled="deleting"
				:class="deleting ? 'cursor-not-allowed' : ''"
				@click="deleteSubmissions(selections, unselectAll)"
			>
				<template #icon>
					<span
						class="lucide-trash-2 size-4"
						:class="deleting ? 'opacity-60' : ''"
						aria-hidden="true"
					/>
				</template>
			</Button>
		</template>
	</ListPage>
</template>

<script setup lang="ts">
import {
	Button,
	call,
	createListResource,
	createResource,
	toast,
	usePageMeta,
} from 'frappe-ui'
import type { SelectOptionValue } from 'frappe-ui'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { sessionStore } from '@/stores/session'
import Link from '@/components/Controls/Link.vue'
import Select from '@/components/Controls/Select.vue'
import ListPage from '@/components/Layouts/pages/ListPage.vue'
import type { Breadcrumb, ListViewOptions, SubmissionsConfig } from '@/types'

const props = withDefaults(
	defineProps<{
		config: SubmissionsConfig
		// Filters the viewer cannot change (a student's own member id). Applied
		// and shown readonly, never written to the URL.
		lockedFilters?: Record<string, string>
		// The submission doctypes grant delete to different roles, so each page
		// says whether this viewer gets the checkboxes and the Delete button.
		canDelete?: boolean
	}>(),
	{ lockedFilters: () => ({}), canDelete: true }
)

const { brand } = sessionStore()
const router = useRouter()

const filters = reactive<Record<string, string>>(
	Object.fromEntries(props.config.filters.map((f) => [f.key, '']))
)

const isLocked = (key: string): boolean => key in props.lockedFilters

// A locked key's `filters` entry stays '', so its control shows the locked
// value instead of an empty disabled box.
const filterValue = (key: string): string =>
	isLocked(key) ? props.lockedFilters[key] : filters[key]

// Read at setup, not onMounted: the list would otherwise fetch unfiltered
// first, and the immediate scope watcher would never fetch the crumb title.
props.config.filters.forEach((field) => {
	if (isLocked(field.key)) return
	const value = router.currentRoute.value.query[field.key]
	if (typeof value === 'string') filters[field.key] = value
})

// A locked key in the URL is not honoured, so the URL is corrected. replace,
// not push: Back should never land on an address the reader did not choose.
const correctedQuery = { ...router.currentRoute.value.query }
let strippedLockedKey = false
for (const key of Object.keys(props.lockedFilters)) {
	if (!(key in correctedQuery)) continue
	delete correctedQuery[key]
	strippedLockedKey = true
}
if (strippedLockedKey) router.replace({ query: correctedQuery })

const activeFilters = (): Record<string, string> => {
	const active: Record<string, string> = { ...props.lockedFilters }
	props.config.filters.forEach((field) => {
		if (isLocked(field.key)) return
		if (filters[field.key]) active[field.key] = filters[field.key]
	})
	return active
}

const setFilter = (key: string, value: string): void => {
	if (isLocked(key)) return
	filters[key] = value ?? ''
}

const submissions = createListResource({
	doctype: props.config.doctype,
	fields: props.config.fields,
	orderBy: props.config.orderBy,
	filters: activeFilters(),
	pageLength: 24,
	auto: false,
	transform: props.config.transform,
})

const totalSubmissions = createResource({
	url: 'frappe.client.get_count',
	makeParams: () => ({
		doctype: props.config.doctype,
		filters: activeFilters(),
	}),
	auto: false,
})

onMounted(() => {
	submissions.update({ filters: activeFilters(), start: 0 })
	submissions.reload()
	totalSubmissions.reload()
})

watch(
	filters,
	() => {
		const query = { ...router.currentRoute.value.query }
		props.config.filters.forEach((field) => {
			// No isLocked skip: a locked key's entry here is always '', so the
			// else-branch strips one that arrives later instead of preserving it.
			if (filters[field.key]) query[field.key] = filters[field.key]
			else delete query[field.key]
		})
		router.push({ query })

		submissions.update({ filters: activeFilters(), start: 0 })
		submissions.reload()
		totalSubmissions.reload()
	},
	{ deep: true }
)

const pageLength = ref<number>(24)

watch(pageLength, (value: number) => {
	// reload() ignores a new pageLength while start > 0: it refetches the
	// already loaded rows instead, so paging must be reset for it to apply.
	submissions.update({ pageLength: value, start: 0 })
	submissions.reload()
})

const listOptions = computed<ListViewOptions>(() => ({
	// Both halves have to move together: ResponsiveListView enables selection
	// on `selectable === true` AND the slot being passed, so leaving either one
	// standing keeps the checkboxes on with nothing to do with them.
	selectable: props.canDelete,
	showTooltip: false,
	getRowRoute: props.config.getRowRoute,
}))

const deleting = ref<boolean>(false)

// The trigger renders as its icon alone — frappe-ui reads `label` into
// `aria-label` and never into the page — so the in-flight state reaches sighted
// users as a dimmed icon and everyone else through here.
const deleteAnnouncement = computed(() =>
	deleting.value ? __('Deleting submissions…') : ''
)

const errorMessage = (error: unknown): string => {
	const e = error as { messages?: string[]; message?: string } | undefined
	return e?.messages?.[0] || e?.message || __('Unknown error')
}

// All deletes in parallel, then one refetch. The list resource's own delete
// refetches after each row: 2N serial round trips.
const deleteSubmissions = async (
	selections: Set<string>,
	unselectAll: () => void
): Promise<void> => {
	// A run holds the banner up for its whole duration, so a second tap is easy
	// to make. It would resubmit names that have already gone, every one 404s,
	// and the run then reports failure for deletes that worked.
	if (deleting.value) return

	const names = Array.from(selections)
	if (!names.length) return

	deleting.value = true
	let results: PromiseSettledResult<unknown>[]
	try {
		results = await Promise.allSettled(
			names.map((name) =>
				call('frappe.client.delete', {
					doctype: props.config.doctype,
					name,
				})
			)
		)
	} finally {
		deleting.value = false
	}

	const failed: string[] = []
	let firstError: unknown
	results.forEach((result, index) => {
		if (result.status === 'rejected') {
			failed.push(names[index])
			firstError = firstError ?? result.reason
			return
		}
		// Only the rows that went. A failed row stays ticked to retry from.
		selections.delete(names[index])
	})

	const deleted = names.length - failed.length
	if (deleted) {
		submissions.reload()
		totalSubmissions.reload()
	}

	if (!failed.length) {
		unselectAll()
		toast.success(__('Submissions deleted successfully'))
		return
	}

	toast.error(
		__('{0} of {1} submissions could not be deleted: {2}').format(
			failed.length,
			names.length,
			errorMessage(firstError)
		),
		{ duration: Infinity }
	)
}

// The scoping assessment gets a crumb that tracks its filter both ways. Member
// and status filters get none.
const scopeValue = computed<string>(() => {
	const key = props.config.scopeCrumb?.filterKey
	if (!key) return ''
	return props.lockedFilters[key] ?? filters[key] ?? ''
})

const scopeTitle = createResource({
	url: 'frappe.client.get_value',
	makeParams: () => ({
		doctype: props.config.scopeCrumb?.doctype,
		fieldname: props.config.scopeCrumb?.titleField,
		filters: { name: scopeValue.value },
	}),
	auto: false,
})

watch(
	scopeValue,
	(value) => {
		// Cleared first: reload() keeps the old title until the reply, and for
		// good on failure, so the crumb would name the wrong assessment.
		scopeTitle.data = null
		if (value) scopeTitle.reload()
	},
	{ immediate: true }
)

const breadcrumbs = computed<Breadcrumb[]>(() => {
	const crumbs: Breadcrumb[] = [props.config.parentCrumb]
	const scope = props.config.scopeCrumb
	if (scope && scopeValue.value) {
		const titleField = scope.titleField
		const resolved = scopeTitle.data as Record<string, string> | null
		crumbs.push({
			label: resolved?.[titleField] || scopeValue.value,
			route: scope.route(scopeValue.value),
		})
	}
	crumbs.push({ label: __(props.config.title) })
	return crumbs
})

usePageMeta(() => ({
	title: __(props.config.pageTitle),
	icon: brand.favicon,
}))
</script>
