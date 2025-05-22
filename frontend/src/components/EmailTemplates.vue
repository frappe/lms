<template>
	<div class="flex flex-col min-h-0 text-base">
		<div class="flex items-center justify-between mb-5">
			<div class="flex flex-col space-y-2">
				<div class="text-xl font-semibold text-ink-gray-9">
					{{ label }}
				</div>
				<div class="text-xs text-ink-gray-5">
					{{ __(description) }}
				</div>
			</div>
			<div class="flex items-center space-x-5">
				<Button @click="() => (showForm = true)">
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
						if (readOnlyMode) return
						selectedTemplate = row.name
						showForm = true
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
								<div v-if="column.key == 'use_html'">
									<FormControl
										v-model="row[column.key]"
										type="checkbox"
										:disabled="true"
									/>
								</div>
								<div v-else class="leading-5 text-sm">
									{{ row[column.key] }}
								</div>
							</ListRowItem>
						</template>
					</ListRow>
				</ListRows>
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
	createListResource,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListSelectBanner,
	FormControl,
	ListRows,
	ListRow,
	ListRowItem,
	Button,
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
	fields: ['name', 'subject', 'use_html', 'response'],
	auto: true,
	orderBy: 'modified desc',
	cache: 'email-templates',
})

const columns = computed(() => {
	return [
		{
			label: 'Name',
			key: 'name',
			width: '15rem',
		},
		{
			label: 'Subject',
			key: 'subject',
			width: '18rem',
		},
		{
			label: 'Use HTML',
			key: 'use_html',
			width: '10rem',
			align: 'right',
		},
	]
})
</script>
