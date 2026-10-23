<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		layout="list"
		:columns="columns"
		:rows="imports.data || []"
		:list-options="listOptions"
		:list-resource="imports"
		:loading="imports.list.loading"
		:has-next-page="imports.hasNextPage"
		empty-name="Imports"
		empty-icon="lucide-arrow-down-to-line"
		@load-more="imports.next()"
	>
		<template #name="{ totalCount }">
			{{
				totalCount === 1
					? __('1 Import')
					: __('{0} Imports').format(totalCount || 0)
			}}
		</template>

		<template #actions>
			<Button variant="solid" @click="newImport">
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('New Import') }}
			</Button>
		</template>

		<template #filters>
			<Select
				v-model="doctype"
				:options="doctypeOptions"
				:placeholder="__('Importing')"
				:aria-label="__('Importing')"
			/>
			<Select
				v-model="status"
				:options="statusOptions"
				:placeholder="__('Status')"
				:aria-label="__('Status')"
			/>
		</template>

		<template #cell="{ column, value }">
			<Badge
				v-if="column.key === 'status'"
				:theme="statusTheme[value] ?? 'gray'"
				:label="__(value)"
			/>
			<div
				v-else-if="column.key === 'creation'"
				class="text-sm text-ink-gray-6"
			>
				{{ value }}
			</div>
			<div v-else>{{ value }}</div>
		</template>
	</ListPage>
</template>
<script setup lang="ts">
import { Badge, Button, createListResource, usePageMeta } from 'frappe-ui'
import ListPage from '@/components/Layouts/ListPage.vue'
import Select from '@/components/Controls/Select.vue'
import { sessionStore } from '@/stores/session'
import { importTitle, LMS_IMPORT_DOCTYPES } from '@/utils/dataImport'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const { brand } = sessionStore()
const user = inject<any>('$user')
const dayjs = inject<any>('$dayjs')
const route = useRoute()
const router = useRouter()

onMounted(() => {
	if (!user.data?.is_moderator) router.push({ name: 'Courses' })
})

const fromQuery = (key: string) =>
	typeof route.query[key] === 'string' ? (route.query[key] as string) : ''

// Read from the URL, so the wizard's "pending imports" link lands on a
// filtered list.
const doctype = ref(fromQuery('doctype'))
const status = ref(fromQuery('status'))

const filters = computed(() => ({
	...(doctype.value && { reference_doctype: doctype.value }),
	...(status.value && { status: status.value }),
}))

const imports = createListResource({
	doctype: 'Data Import',
	fields: [
		'name',
		'reference_doctype',
		'import_type',
		'status',
		'payload_count',
		'creation',
	],
	filters: filters.value,
	orderBy: 'creation desc',
	pageLength: 24,
	auto: true,
	transform: (rows: Record<string, any>[]) =>
		rows.map((row) => ({
			...row,
			reference_doctype: importTitle(row.reference_doctype),
			import_type: __(row.import_type),
			creation: dayjs(row.creation).format('DD MMM YYYY, hh:mm a'),
		})),
})

// Follows the URL too, so opening Import from the menu clears the filters.
watch(
	() => route.query,
	() => {
		doctype.value = fromQuery('doctype')
		status.value = fromQuery('status')
	}
)

watch(filters, (next) => {
	router.replace({
		query: {
			...(doctype.value && { doctype: doctype.value }),
			...(status.value && { status: status.value }),
		},
	})
	imports.update({ filters: next })
	imports.reload()
})

const doctypeOptions = computed(() => [
	{ label: __('Everything'), value: '' },
	...LMS_IMPORT_DOCTYPES.map((value) => ({ label: importTitle(value), value })),
])

const statusTheme: Record<
	string,
	'gray' | 'blue' | 'green' | 'orange' | 'red'
> = {
	Pending: 'gray',
	'In Progress': 'blue',
	Success: 'green',
	'Partial Success': 'orange',
	Error: 'red',
	'Timed Out': 'red',
}

const statusOptions = computed(() => [
	{ label: __('Any status'), value: '' },
	...Object.keys(statusTheme).map((value) => ({ label: __(value), value })),
])

const listOptions = {
	showTooltip: false,
	selectable: false,
	getRowRoute: (row: { name: string }) => ({
		name: 'DataImport',
		params: { importName: row.name },
	}),
}

const newImport = () =>
	router.push({
		name: 'NewDataImport',
		params: doctype.value ? { doctype: doctype.value } : {},
	})

const columns = [
	{
		label: __('Importing'),
		key: 'reference_doctype',
		width: 1.5,
		icon: 'lucide-database',
	},
	{
		label: __('Type'),
		key: 'import_type',
		width: 1.5,
		hideOnMobile: true,
		icon: 'lucide-file-input',
	},
	{
		label: __('Status'),
		key: 'status',
		width: 1,
		icon: 'lucide-circle-dot',
	},
	{
		label: __('Records'),
		key: 'payload_count',
		width: 0.5,
		hideOnMobile: true,
		align: 'left',
		icon: 'lucide-hash',
	},
	{
		label: __('Created'),
		key: 'creation',
		width: 1.2,
		hideOnMobile: true,
		icon: 'lucide-clock',
	},
]

const breadcrumbs = [
	{ label: __('Data Import'), route: { name: 'DataImportList' } },
]

usePageMeta(() => ({
	title: __('Data Import'),
	icon: brand.favicon,
}))
</script>
