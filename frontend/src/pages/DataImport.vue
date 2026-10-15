<template>
	<PageHeader :breadcrumbs="breadcrumbs" />
	<div class="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col p-5">
		<DataImportWizard
			:dataImport="dataImport"
			@open-list="openList"
			@open-record="openRecord"
			@open-imports="openImports"
			@new-import="newImport"
		/>
	</div>
</template>
<script setup lang="ts">
import { usePageMeta } from 'frappe-ui'
import {
	DataImportWizard,
	useDataImport,
} from '@framework/ui/components/DataImport/index'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import type { Breadcrumb } from '@/types'
import { sessionStore } from '../stores/session'
import { openExternal } from '@/utils/openExternal'
import { useRoute, useRouter } from 'vue-router'
import { computed, inject, onMounted, ref, watch } from 'vue'

const { brand } = sessionStore()
const route = useRoute()
const router = useRouter()
const user = inject<any>('$user')

// Both route segments are single dynamic params (routes.js), never repeated —
// narrowed here because vue-router types every param as `string | string[]`.
const param = (key: 'doctype' | 'importName') => {
	const value = route.params[key]
	return (Array.isArray(value) ? value[0] : value) || undefined
}

onMounted(() => {
	if (!user.data?.is_moderator) {
		router.push({
			name: 'Courses',
		})
	}
})

// The LMS pages an import can lead back to. Anything else stays in the
// wizard: it shows these links only when we handle them.
const lmsPages: Record<
	string,
	{ title: string; list: string; page?: string; param?: string }
> = {
	'LMS Course': {
		title: 'Courses',
		list: 'Courses',
		page: 'CourseDetail',
		param: 'courseName',
	},
	'LMS Batch': {
		title: 'Batches',
		list: 'Batches',
		page: 'BatchDetail',
		param: 'batchName',
	},
}

const name = ref<string | null>(param('importName') ?? null)
// With no doctype in the route, the wizard's first step asks for one.
const dataImport = useDataImport(name, { doctype: () => param('doctype') })

// The first save names a new import; keep the URL on it so a reload reopens it.
watch(name, (importName) => {
	if (importName && importName !== param('importName')) {
		router.replace({ name: 'DataImport', params: { importName } })
	}
})
watch(
	() => route.params.importName,
	() => (name.value = param('importName') ?? null)
)

const openList = (doctype: string) => {
	const page = lmsPages[doctype]
	if (page) router.push({ name: page.list })
}

const openRecord = (doctype: string, docname: string) => {
	const page = lmsPages[doctype]
	if (page?.page && page.param) {
		router.push({ name: page.page, params: { [page.param]: docname } })
	}
}

// Learning has no list of imports of its own, so pending ones open in the Desk.
const openImports = (doctype: string) => {
	const query = new URLSearchParams({ reference_doctype: doctype })
	openExternal(`/app/data-import?${query}`)
}

const newImport = (doctype: string) => {
	router.push({ name: 'NewDataImport', params: { doctype } })
}

const breadcrumbs = computed<Breadcrumb[]>(() => {
	const doctype =
		dataImport.doc.value.reference_doctype || param('doctype') || ''
	const page = lmsPages[doctype]
	const crumbs: Breadcrumb[] = []
	if (page) crumbs.push({ label: __(page.title), route: { name: page.list } })
	crumbs.push({ label: __('Data Import'), route: { name: 'DataImportList' } })
	if (doctype) {
		crumbs.push({
			label: __('Importing {0}').format(__(page?.title ?? doctype)),
		})
	}
	return crumbs
})

usePageMeta(() => {
	return {
		title: __('Data Import'),
		icon: brand.favicon,
	}
})
</script>
