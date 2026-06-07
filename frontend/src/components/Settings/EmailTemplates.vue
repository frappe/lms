<template>
	<SettingsLayout
		:title="label"
		:description="
			__('Create and manage reusable email templates for your notifications.')
		"
	>
		<template #header-actions>
			<Button variant="solid" @click="openTemplateForm('new')">
				<template #prefix>
					<Plus class="h-4 w-4 stroke-1.5" />
				</template>
				{{ __('New') }}
			</Button>
		</template>
		<div v-if="emailTemplates.data?.length">
			<ListView
				:columns="columns"
				:rows="emailTemplates.data"
				row-key="name"
				:options="{
					showTooltip: false,
					onRowClick: (row) => {
						openTemplateForm(row.name)
					},
				}"
			>
				<ListHeader
					class="mb-2 grid items-center gap-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in columns">
						<template #prefix="{ item }">
							<component
								v-if="item.icon"
								:is="item.icon"
								class="h-4 w-4 stroke-1.5 ms-4"
							/>
						</template>
					</ListHeaderItem>
				</ListHeader>

				<ListRows>
					<ListRow :row="row" v-for="row in emailTemplates.data">
						<template #default="{ column, item }">
							<ListRowItem
								:item="row[column.key]"
								:align="column.align"
								class="min-w-0"
							>
								<div class="leading-5 text-sm truncate">
									{{ row[column.key] }}
								</div>
							</ListRowItem>
						</template>
					</ListRow>
				</ListRows>

				<ListSelectBanner>
					<template #actions="{ unselectAll, selections }">
						<div class="flex gap-2">
							<Button
								variant="ghost"
								@click="removeTemplate(selections, unselectAll)"
							>
								<Trash2 class="h-4 w-4 stroke-1.5" />
							</Button>
						</div>
					</template>
				</ListSelectBanner>
			</ListView>
		</div>
		<EmptyStateLayout
			v-else
			name="Email Templates"
			:description="__('Add one to get started.')"
			:icon="MailPlus"
		/>
	</SettingsLayout>
	<EmailTemplateModal
		v-model="showForm"
		v-model:emailTemplates="emailTemplates"
		:templateID="selectedTemplate"
	/>
</template>
<script setup lang="ts">
import {
	Button,
	call,
	createListResource,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListSelectBanner,
	ListRows,
	ListRow,
	ListRowItem,
	toast,
} from 'frappe-ui'
import { computed, ref } from 'vue'
import { Plus, Trash2, MailPlus } from 'lucide-vue-next'
import EmailTemplateModal from '@/components/Modals/EmailTemplateModal.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'

const props = defineProps({
	label: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		default: '',
	},
})

const showForm = ref(false)
const readOnlyMode = window.read_only_mode
const selectedTemplate = ref(null)

const emailTemplates = createListResource({
	doctype: 'Email Template',
	fields: ['name', 'subject', 'use_html', 'response', 'response_html'],
	auto: true,
	orderBy: 'modified desc',
	cache: 'email-templates',
})

const removeTemplate = (selections, unselectAll) => {
	call('lms.lms.api.delete_documents', {
		doctype: 'Email Template',
		documents: Array.from(selections),
	})
		.then(() => {
			emailTemplates.reload()
			toast.success(__('Email Templates deleted successfully'))
			unselectAll()
		})
		.catch((err) => {
			toast.error(
				cleanError(err.messages[0]) || __('Error deleting email templates')
			)
		})
}

const openTemplateForm = (templateID) => {
	if (readOnlyMode) {
		return
	}
	selectedTemplate.value = templateID
	showForm.value = true
}

const columns = computed(() => {
	return [
		{
			label: 'Name',
			key: 'name',
			width: 1,
		},
		{
			label: 'Subject',
			key: 'subject',
			width: 1,
		},
	]
})
</script>
