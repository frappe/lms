<template>
	<PageHeader :breadcrumbs="breadcrumbs" />
	<div class="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col p-5">
		<DataImportWizard
			:dataImport="dataImport"
			:onOpenList="canOpenList ? openList : undefined"
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
import { importTarget, importTitle } from '@/utils/dataImport'
import { useScreenSize } from '@/utils/composables'
import { useRoute, useRouter } from 'vue-router'
import { computed, inject, onMounted, ref, watch } from 'vue'

const { brand } = sessionStore()
const route = useRoute()
const router = useRouter()
const user = inject<any>('$user')
const { isMobile } = useScreenSize()

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

const openList = (doctype: string) => importTarget(doctype)?.openList(router)

// The wizard shows "Go to list" only when it is given somewhere to go.
const canOpenList = computed(() => {
	const target = importTarget(dataImport.doc.value.reference_doctype)
	return Boolean(target && !(target.listInSettings && isMobile.value))
})

const openRecord = (doctype: string, docname: string) =>
	importTarget(doctype)?.openRecord?.(router, docname)

const openImports = (doctype: string) =>
	router.push({
		name: 'DataImportList',
		query: { doctype, status: 'Pending' },
	})

const newImport = (doctype: string) => {
	router.push({ name: 'NewDataImport', params: { doctype } })
}

const breadcrumbs = computed<Breadcrumb[]>(() => {
	const doctype = dataImport.doc.value.reference_doctype || param('doctype')
	return [
		{ label: __('Data Import'), route: { name: 'DataImportList' } },
		{
			label: doctype
				? __('Importing {0}').format(importTitle(doctype))
				: __('New Import'),
		},
	]
})

usePageMeta(() => {
	return {
		title: __('Data Import'),
		icon: brand.favicon,
	}
})
</script>
