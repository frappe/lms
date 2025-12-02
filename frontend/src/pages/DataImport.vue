<template>
	<DataImport
		:doctype="route.params.doctype"
		:importName="route.params.importName"
		:doctypeMap="doctypeMap"
	/>
</template>
<script setup lang="ts">
import { usePageMeta } from 'frappe-ui'
import { DataImport } from 'frappe-ui/frappe'
import { sessionStore } from '../stores/session'
import { useRoute, useRouter } from 'vue-router'
import { inject, onMounted } from 'vue'

const { brand } = sessionStore()
const route = useRoute()
const router = useRouter()
const user = inject<any>('$user')

onMounted(() => {
	if (!user.data?.is_moderator) {
		router.push({
			name: 'Courses',
		})
	}
})

const doctypeMap = {
	'LMS Course': {
		title: 'Courses',
		listRoute: '/courses',
		pageRoute: `/courses/docname`,
	},
	'LMS Batch': {
		title: 'Batches',
		listRoute: '/batches',
	},
	'LMS Category': {
		title: 'Categories',
		listRoute: '/lms',
	},
}

usePageMeta(() => {
	return {
		title: __('Data Import'),
		icon: brand.favicon,
	}
})
</script>
