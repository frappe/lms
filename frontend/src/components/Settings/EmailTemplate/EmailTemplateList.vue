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

		<template #header-bottom>
			<div class="flex items-center gap-2">
				<FormControl
					v-model="search"
					type="text"
					:debounce="300"
					class="w-1/3"
					:placeholder="__('Search Template')"
				>
					<template #prefix>
						<span class="lucide-search size-4 text-ink-gray-5" />
					</template>
				</FormControl>
			</div>
		</template>

		<List
			v-if="filteredTemplates.length"
			:columns="columns"
			class="list-row-px-3"
		>
			<ListHeader>
				<ListHeaderCell>{{ __('Template Name') }}</ListHeaderCell>
				<ListHeaderCell />
			</ListHeader>
			<ListRows
				:items="filteredTemplates"
				row-key="name"
				v-slot="{ item: row }"
			>
				<ListRow
					class="py-2.5"
					@click="emit('update:step', 'template-edit', { ...row })"
				>
					<!-- Name over subject, like CRM's template rows. -->
					<ListCell>
						<div class="flex min-w-0 flex-col">
							<span class="truncate text-p-base-medium text-ink-gray-8">
								{{ row.name }}
							</span>
							<span class="truncate text-p-sm text-ink-gray-5">
								{{ row.subject }}
							</span>
						</div>
					</ListCell>
					<ListCell class="justify-end" @click.stop>
						<Dropdown
							:options="getMoreOptions(row)"
							:button="{ icon: 'lucide-more-horizontal', variant: 'ghost' }"
							placement="right"
						/>
					</ListCell>
				</ListRow>
			</ListRows>
		</List>

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
	FormControl,
	createListResource,
	toast,
} from 'frappe-ui'
import {
	List,
	ListCell,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
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

const search = ref('')
const filteredTemplates = computed(() => {
	let list = (templates.data || []) as EmailTemplate[]
	if (search.value) {
		const term = search.value.toLowerCase()
		list = list.filter(
			(t) =>
				t.name.toLowerCase().includes(term) ||
				(t.subject || '').toLowerCase().includes(term)
		)
	}
	return list
})

const columns = ['minmax(0, 1fr)', '2.25rem']

const showDeleteDialog = ref(false)
const templateToDelete = ref<string | null>(null)

const getMoreOptions = (template: EmailTemplate) => [
	{
		label: __('Edit'),
		icon: 'lucide-edit',
		onClick: () => emit('update:step', 'template-edit', { ...template }),
	},
	{
		label: __('Duplicate'),
		icon: 'lucide-copy',
		onClick: () => emit('update:step', 'template-new', { ...template }),
	},
	{
		label: __('Delete'),
		icon: 'lucide-trash-2',
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
