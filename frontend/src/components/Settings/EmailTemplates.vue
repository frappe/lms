<template>
	<div class="flex flex-col min-h-0 text-base">
		<div class="flex items-center justify-between mb-5">
			<div class="flex flex-col space-y-2">
				<div class="text-xl font-semibold text-ink-gray-9">
					{{ label }}
				</div>
				<!-- <div class="text-xs text-ink-gray-5">
					{{ __(description) }}
				</div> -->
			</div>
			<div class="flex items-center space-x-5">
				<Button @click="openTemplateForm('new')">
					<template #prefix>
						<Plus class="h-3 w-3 stroke-1.5" />
					</template>
					{{ __('New') }}
				</Button>
			</div>
		</div>
		<div v-if="emailTemplates.data?.length" class="overflow-y-scroll">
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
					class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in columns">
						<template #prefix="{ item }">
							<component
								v-if="item.icon"
								:is="item.icon"
								class="h-4 w-4 stroke-1.5 ml-4"
							/>
						</template>
					</ListHeaderItem>
				</ListHeader>

				<ListRows>
					<ListRow :row="row" v-for="row in emailTemplates.data">
						<template #default="{ column, item }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<div class="leading-5 text-sm">
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
	</div>
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
import { Plus, Trash2 } from 'lucide-vue-next'
import EmailTemplateModal from '@/components/Modals/EmailTemplateModal.vue'

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
			width: '20rem',
		},
		{
			label: 'Subject',
			key: 'subject',
			width: '25rem',
		},
	]
})
</script>
