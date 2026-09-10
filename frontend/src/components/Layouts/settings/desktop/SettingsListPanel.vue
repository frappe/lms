<template>
	<SettingsFieldsPanel
		v-if="detailFields"
		:page="detailFields"
		:title="detailTitle"
		show-back
		@back="closeDetail"
		@renamed="recordRenamed"
	/>

	<component
		:is="detailComponent"
		v-else-if="detailComponent"
		:name="record"
		@back="closeDetail"
		@renamed="recordRenamed"
	/>

	<SettingsList
		v-else
		v-model:search="list.search"
		:title="title"
		:columns="page.columns"
		:rows="list.rows"
		:row-key="page.resource.rowKey"
		:loading="list.loading"
		:has-next-page="list.hasNextPage"
		:searchable="page.searchable"
		:show-new="Boolean(page.create)"
		:new-label="page.create?.label"
		:empty-name="page.empty?.name"
		:empty-icon="page.empty?.icon"
		:disabled="dependencyUnmet"
		flush
		@new="openCreate"
		@load-more="list.loadMore()"
		@row-click="openRow"
	>
		<template v-if="page.filter" #header-bottom>
			<Select
				v-model="filterValue"
				class="w-40"
				:aria-label="page.filter.ariaLabel()"
				:options="page.filter.options()"
			/>
		</template>
		<template v-if="dependencyBanner" #banner>
			<Alert
				class="mb-4"
				theme="yellow"
				variant="subtle"
				:dismissible="false"
				:title="dependencyBanner"
			/>
		</template>
	</SettingsList>
</template>

<script lang="ts">
import type { ListPage, SelectOption } from '@/types/settingsSchema'
import type { SettingsListRow } from '@/types'
import type { SettingsListFilters } from '@/composables/useSettingsListResource'

/**
 * A single-choice narrowing of the list, drawn beside the search box.
 * Every string is produced by a call, not a plain property. `__` loads
 * only after the settings tree is imported, so a module-scope value would call an undefined global.
 */
export interface ListPanelFilter {
	/** The request parameter this filter contributes. */
	name: string
	/** The value standing for "everything", and what the list opens on. */
	default: string
	ariaLabel: () => string
	options: () => SelectOption[]
	/**
	 * Maps the chosen value to get_list filters, for a doctype-backed list.
	 * Return nothing for the default value. Declaring it on a method-backed
	 * page has no effect, since there is no resource to hand filters to.
	 */
	filters?: (value: string) => SettingsListFilters
}

/**
 * A `ListPage` plus the two things the shared schema cannot say yet.
 * Both belong on `ListPage` in types/settingsSchema.ts; declared here
 * because this panel is what reads them.
 */
export interface ListPanelPage extends ListPage {
	filter?: ListPanelFilter
	/**
	 * What a row click does INSTEAD of opening `rowDetail`.
	 * Users has both: a member's profile is a page of its own, so the row
	 * leaves settings entirely, while the record sub-page is reached from the row menu.
	 */
	rowClick?: (row: SettingsListRow) => void
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Alert, createResource, Select } from 'frappe-ui'
import SettingsFieldsPanel from '@/components/Layouts/settings/desktop/SettingsFieldsPanel.vue'
import SettingsList from '@/components/Layouts/settings/desktop/SettingsList.vue'
import { useSettingsSource } from '@/composables/useSettingsSource'
import {
	useSettingsListResource,
	useSettingsMethodResource,
	type SettingsListSource,
	type SettingsListView,
} from '@/composables/useSettingsListResource'
import type {
	DetailPage,
	FieldsPage,
	SettingsSource,
} from '@/types/settingsSchema'

// A `kind: 'list'` page, rendered whole. The list, the New affordance, and
// the detail that replaces the list when a record is open. Every list panel
// behaved this way already, so the behaviour now lives here once.
const props = defineProps<{
	page: ListPanelPage
	title: string
}>()

// The create id reserved by the settings hash ('#settings/<slug>/new'), so a
// record model driven from the URL and one driven from a click agree.
const NEW_RECORD = 'new'

// The open record, as a model rather than internal state: the URL layer drives
// this from the hash's second segment, and nothing else here knows about hashes.
const record = defineModel<string | null>('record', { default: null })

// Not `record.value = name`. The record model is the URL, and writing to it
// PUSHES a history entry. Back from a renamed record must land on the list,
// not on the same record under its dead name. The page above owns the hash.
const emit = defineEmits<{ renamed: [string] }>()

// The filter's own value, held here rather than in the config module: the
// config is a module-level constant shared by every mount, and a value written
// into it would be waiting in the next panel that opened.
const filterValue = ref(props.page.filter?.default ?? '')

const filterParams = (): Record<string, unknown> =>
	props.page.filter ? { [props.page.filter.name]: filterValue.value } : {}

// Read once for the whole mount. Only fetched for a page that opts in.
// Google Calendar's and Google Meet's own item condition already
// guarantees whoever reaches this component holds permission on it.
const dependsOnGoogleApi =
	props.page.requiresGoogleApi || props.page.requiresGoogleCalendar
const googleApiSource = dependsOnGoogleApi
	? useSettingsSource({ doctype: 'Google Settings', name: 'Google Settings' })
	: null
const googleApiEnabled = computed(() => Boolean(googleApiSource?.doc?.enable))

// A narrow existence check, not a list the page ever shows. One row is
// enough to know a Google Calendar exists.
const calendarCheck = props.page.requiresGoogleCalendar
	? createResource<{ name: string }[]>({
			url: 'frappe.client.get_list',
			params: { doctype: 'Google Calendar', fields: ['name'], limit: 1 },
			auto: true,
	  })
	: null
const hasGoogleCalendar = computed(() => Boolean(calendarCheck?.data?.length))

// True from the first render, not just once a fetch resolves "not enabled".
// Otherwise a click before that arrives opens a form for a dependency that
// was never actually met.
const dependencyUnmet = computed(
	() =>
		dependsOnGoogleApi &&
		(Boolean(googleApiSource?.loading) ||
			!googleApiEnabled.value ||
			(Boolean(props.page.requiresGoogleCalendar) &&
				(Boolean(calendarCheck?.loading) || !hasGoogleCalendar.value)))
)

// The banner's text waits for the real answer, unlike the disabled state
// itself, so it's never wrong for a moment.
const dependencyBanner = computed((): string => {
	if (!dependencyUnmet.value) return ''
	if (googleApiSource?.loading) return ''
	if (!googleApiEnabled.value) {
		return props.page.requiresGoogleCalendar
			? __(
					'Enable Google API in Services and set up a Google Calendar to use this.'
			  )
			: __('Enable Google API in Services to use this.')
	}
	if (props.page.requiresGoogleCalendar) {
		if (calendarCheck?.loading) return ''
		if (!hasGoogleCalendar.value)
			return __('Set up a Google Calendar to use this.')
	}
	return ''
})

// Read once, at setup: a caller rendering two different ListPages through this
// component must key it per item, or the second reuses the first's resource.
// A `method` page (e.g. get_members) pages against `start` instead of get_list.
const listSource = props.page.resource

// Read once, at setup, and kept: `filters` on a config can be a getter, and the
// resource was built from whatever it returned then. Re-reading it later would
// scope the list by a different answer than the rows on screen came from.
const scopeFilters = listSource.filters

// Held apart from `list` because only the doctype branch can be handed filters.
const doctypeList: SettingsListSource | null = listSource.method
	? null
	: useSettingsListResource({
			doctype: listSource.doctype,
			fields: listSource.fields,
			filters: scopeFilters,
			orderBy: listSource.orderBy,
			searchFields: listSource.searchFields,
	  })

const list: SettingsListView =
	doctypeList ??
	useSettingsMethodResource({
		method: listSource.method as string,
		doctype: listSource.doctype,
		// A catalogue endpoint returns the whole list at once and takes no
		// `start`, so paging it is meaningless: a catalogue at or above the
		// default 13 would draw a Load More that appends the same rows again.
		pageLength: listSource.pageLength,
		params: filterParams,
	})

const asTriples = (filters: SettingsListFilters): any[][] =>
	Array.isArray(filters)
		? filters
		: Object.entries(filters).map(([field, value]) =>
				Array.isArray(value) ? [field, value[0], value[1]] : [field, '=', value]
		  )

// The page's own filters are a scope, not a default: Google Meet holds a
// non-moderator to their own row that way. `applyFilters` replaces outright, so
// the scope has to be sent again underneath every chosen value.
const mergeFilters = (
	scope: SettingsListFilters | undefined,
	chosen: SettingsListFilters
): SettingsListFilters => {
	if (!scope) return chosen
	if (!Array.isArray(scope) && !Array.isArray(chosen))
		return { ...scope, ...chosen }
	return [...asTriples(scope), ...asTriples(chosen)]
}

// Back to the first page, the way a search is: the filter goes to the server,
// so what is on screen was fetched under the old one and none of it can be kept.
watch(filterValue, (value) => {
	const toFilters = props.page.filter?.filters
	if (doctypeList && toFilters)
		return doctypeList.applyFilters(
			mergeFilters(scopeFilters, toFilters(value))
		)
	return list.reload()
})

// The row behind the open record is found by name and the detail's header is
// drawn from it, so once the record model follows a rename, no row matches
// and the header falls back to the page's generic title.
const recordRenamed = (name: string) => {
	emit('renamed', name)
	list.reload()
}

const detail = computed<DetailPage | null>(() => {
	if (!record.value) return null
	if (record.value === NEW_RECORD) return props.page.create?.detail ?? null
	return props.page.rowDetail ?? null
})

// The row behind the open record, for the detail's title. A create form has no
// row, and a deep link can name a record on a page the list has not reached, so
// the title function has to survive being handed nothing.
const detailRow = computed<SettingsListRow>(() => {
	if (!record.value || record.value === NEW_RECORD) return {}
	return list.rows.find((row) => row.name === record.value) ?? {}
})

// `record: 'route'` says the record is whichever one the URL names; that
// value is the record model here, so the fields page gets a concrete name.
// A create form has no name yet, and that empty name is what makes the write an insert.
const resolveSource = (source: SettingsSource): SettingsSource => {
	if (!('record' in source)) return source
	return {
		doctype: source.doctype,
		name: record.value === NEW_RECORD ? '' : record.value ?? '',
	}
}

// The spread carries `title` and `enabledField` through untouched. Both belong
// to whoever owns the document and header, SettingsFieldsPanel for a fields
// detail, which renders its own SettingsLayout, so the toggle can't be hoisted out here.
const detailFields = computed<FieldsPage | null>(() => {
	const page = detail.value
	if (!page || page.kind !== 'fields') return null
	return { ...page, source: resolveSource(page.source) }
})

const detailComponent = computed(() =>
	detail.value?.kind === 'custom' ? detail.value.component : null
)

const detailTitle = computed(() => {
	const page = detail.value
	return page && page.kind === 'fields' ? page.title(detailRow.value) : ''
})

const openCreate = () => {
	record.value = NEW_RECORD
}

// A page that says where its rows go is obeyed, whether or not it also has a
// record sub-page: Users has both, and a click on a member is a click on the
// person, not on their settings record.
const openRow = (row: SettingsListRow) => {
	if (props.page.rowClick) return props.page.rowClick(row)
	if (props.page.rowDetail) record.value = row.name
}

// A detail owns its own writes and reports only that it is finished, so a save
// and a delete both reach the list as a close. Reloading here is what keeps a
// renamed or removed row from lingering.
const closeDetail = () => {
	record.value = null
	list.reload()
}
</script>
