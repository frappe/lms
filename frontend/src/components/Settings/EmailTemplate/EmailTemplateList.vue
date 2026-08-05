<template>
	<SettingsList
		:title="label"
		:description="
			__('Create and manage reusable email templates for your notifications.')
		"
		:columns="columns"
		:rows="list.rows"
		:loading="list.loading"
		:has-next-page="list.hasNextPage"
		v-model:search="list.search"
		searchable
		:search-label="__('Search Template')"
		empty-name="Email Templates"
		empty-icon="lucide-mail-plus"
		@new="emit('update:step', 'template-new')"
		@load-more="list.loadMore()"
		@row-click="openTemplate"
	/>

	<Dialog
		v-model:open="showDeleteDialog"
		:title="templateToDelete ? __('Delete {0}?').format(templateToDelete) : ''"
		:message="
			__('This permanently deletes the email template and cannot be undone.')
		"
		size="sm"
		:actions="[
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick: confirmDelete,
			},
			{
				label: __('Cancel'),
				onClick: () => {
					showDeleteDialog = false
				},
			},
		]"
	/>
</template>

<script setup lang="ts">
import { Dialog, toast } from 'frappe-ui'
import { ref } from 'vue'
import { cleanError } from '@/utils'
import SettingsList from '@/components/Layouts/SettingsList.vue'
import { useSettingsListResource } from '@/composables/useSettingsListResource'
import type {
	EmailTemplate,
	EmailTemplateStep,
	SettingsListColumn,
	SettingsListRow,
} from '@/types'

defineProps<{
	label: string
}>()

interface E {
	(event: 'update:step', step: EmailTemplateStep, data?: EmailTemplate): void
}

const emit = defineEmits<E>()

const list = useSettingsListResource({
	doctype: 'Email Template',
	fields: ['name', 'subject', 'use_html', 'response', 'response_html'],
	searchFields: ['name', 'subject'],
	orderBy: 'modified desc',
	cache: 'email-templates',
})

const openTemplate = (row: SettingsListRow) =>
	emit('update:step', 'template-edit', { ...row } as EmailTemplate)

const showDeleteDialog = ref(false)
const templateToDelete = ref<string | null>(null)

const openDeleteDialog = (name: string) => {
	templateToDelete.value = name
	showDeleteDialog.value = true
}

const columns: SettingsListColumn[] = [
	{
		key: 'name',
		label: __('Template Name'),
		type: 'stacked',
		primary: (row) => row.name,
		secondary: (row) => row.subject,
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(row.name),
		options: (row) => [
			{
				label: __('Duplicate'),
				icon: 'lucide-copy',
				onClick: () =>
					emit('update:step', 'template-new', { ...row } as EmailTemplate),
			},
			{
				label: __('Delete'),
				icon: 'lucide-trash-2',
				onClick: () => openDeleteDialog(row.name),
			},
		],
	},
]

const confirmDelete = () => {
	const name = templateToDelete.value
	if (!name) return
	list.remove(name, {
		onSuccess: () => {
			toast.success(__('Email Template deleted successfully'))
		},
		onError: (err) => {
			toast.error(
				cleanError(err.messages?.[0]) || __('Error deleting email template')
			)
		},
	})
	showDeleteDialog.value = false
	templateToDelete.value = null
}
</script>
