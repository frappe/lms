<template>
	<SettingsLayout
		:title="label"
		:description="
			__('Create and manage reusable email templates for your notifications.')
		"
	>
		<template #header-actions>
			<Button
				:label="__('New')"
				variant="solid"
				@click="emit('update:step', 'template-new')"
			>
				<template #prefix>
					<LucidePlus class="size-4" />
				</template>
			</Button>
		</template>

		<div v-if="templates.data?.length">
			<ListView
				:columns="columns"
				:rows="templates.data"
				row-key="name"
				:options="{
					showTooltip: false,
					selectable: false,
					onRowClick: (row) => emit('update:step', 'template-edit', { ...row }),
				}"
			>
				<ListHeader
					class="mb-2 grid items-center gap-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in columns" :key="item.key">
						<template #prefix="{ item }">
							<FeatherIcon
								v-if="item.icon"
								:name="item.icon"
								class="h-4 w-4 stroke-1.5"
							/>
						</template>
					</ListHeaderItem>
				</ListHeader>
				<ListRows>
					<ListRow :row="row" v-for="row in templates.data" :key="row.name">
						<template #default="{ column }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<div
									v-if="column.key !== 'action'"
									class="truncate text-sm leading-5"
								>
									{{ row[column.key] }}
								</div>
								<div v-else @click.stop>
									<Dropdown
										:options="getMoreOptions(row)"
										:button="{
											icon: 'more-horizontal',
											onblur: (e: Event) => {
												e.stopPropagation()
											},
										}"
										placement="right"
									/>
								</div>
							</ListRowItem>
						</template>
					</ListRow>
				</ListRows>
			</ListView>
		</div>

		<EmptyStateLayout
			v-else
			name="Email Templates"
			:description="__('Add one to get started.')"
			icon="lucide-mail-plus"
		/>
	</SettingsLayout>

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
import {
	Button,
	Dialog,
	Dropdown,
	FeatherIcon,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	createListResource,
	toast,
} from 'frappe-ui'
import { computed, ref } from 'vue'
import { cleanError } from '@/utils'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import type { EmailTemplate, EmailTemplateStep } from '@/types/email'

defineProps<{
	label: string
}>()

interface E {
	(event: 'update:step', step: EmailTemplateStep, data?: EmailTemplate): void
}

const emit = defineEmits<E>()

const templates = createListResource({
	doctype: 'Email Template',
	fields: ['name', 'subject', 'use_html', 'response', 'response_html'],
	orderBy: 'modified desc',
	cache: 'email-templates',
	auto: true,
})

const columns = computed(() => [
	{
		label: __('Name'),
		key: 'name',
		icon: 'mail',
		align: 'left',
		width: 2,
	},
	{
		label: __('Subject'),
		key: 'subject',
		icon: 'type',
		align: 'left',
		width: 3,
	},
	{
		key: 'action',
		align: 'right',
		width: '52px',
	},
])

const showDeleteDialog = ref(false)
const templateToDelete = ref<string | null>(null)

const getMoreOptions = (template: EmailTemplate) => [
	{
		label: __('Edit'),
		icon: 'edit',
		onClick: () => emit('update:step', 'template-edit', { ...template }),
	},
	{
		label: __('Duplicate'),
		icon: 'copy',
		onClick: () => emit('update:step', 'template-new', { ...template }),
	},
	{
		label: __('Delete'),
		icon: 'trash-2',
		onClick: () => openDeleteDialog(template.name),
	},
]

const openDeleteDialog = (name: string) => {
	templateToDelete.value = name
	showDeleteDialog.value = true
}

const confirmDelete = () => {
	const name = templateToDelete.value
	if (!name) return
	templates.delete.submit(name, {
		onSuccess: () => {
			toast.success(__('Email Template deleted successfully'))
		},
		onError: (err: { messages?: string[] }) => {
			toast.error(
				cleanError(err.messages?.[0]) || __('Error deleting email template')
			)
		},
	})
	showDeleteDialog.value = false
	templateToDelete.value = null
}
</script>
