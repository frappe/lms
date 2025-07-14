<template>
	<BadgeAssignments
		v-if="showAssignments"
		v-model="showAssignments"
		:badgeName="showAssignmentsFor"
	/>
	<div v-else class="flex flex-col min-h-0 text-base">
		<div class="flex items-center justify-between mb-5">
			<div class="flex flex-col space-y-2">
				<div class="text-xl font-semibold text-ink-gray-9">
					{{ label }}
				</div>
				<div class="text-ink-gray-6 leading-5">
					{{ __(description) }}
				</div>
			</div>
			<Button @click="openForm('new')">
				<template #prefix>
					<Plus class="h-3 w-3 stroke-1.5" />
				</template>
				{{ __('New') }}
			</Button>
		</div>
		<div v-if="badges.data?.length" class="overflow-y-scroll">
			<ListView
				:columns="columns"
				:rows="badges.data"
				row-key="name"
				:options="{
					showTooltip: false,
					selectable: false,
				}"
			>
				<ListHeader
					class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
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
					<ListRow :row="row" v-for="row in badges.data" :key="row.name">
						<template #default="{ column, item }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<div v-if="column.key == 'enabled'">
									<Badge v-if="row[column.key]" theme="green">
										{{ __('Enabled') }}
									</Badge>
									<Badge v-else theme="gray">
										{{ __('Disabled') }}
									</Badge>
								</div>
								<div v-else-if="column.key == 'reference_doctype'">
									{{
										doctypeLabel[
											row[column.key] as keyof typeof doctypeLabel
										] || row[column.key]
									}}
								</div>
								<FormControl
									v-else-if="column.key == 'grant_only_once'"
									v-model="row[column.key]"
									type="checkbox"
									:disabled="true"
								/>
								<div
									v-else-if="column.key != 'action'"
									class="leading-5 text-sm"
								>
									{{ row[column.key] }}
								</div>
								<Dropdown
									v-else
									:options="getMoreOptions(row.name)"
									:button="{
										icon: 'more-horizontal',
										onblur: (e: Event) => {
											e.stopPropagation()
										},
									}"
									placement="right"
								/>
							</ListRowItem>
						</template>
					</ListRow>
				</ListRows>
			</ListView>
		</div>
	</div>
	<BadgeForm
		v-model="showForm"
		:badgeName="selectedBadge"
		v-model:badges="badges"
	/>
</template>
<script setup lang="ts">
import {
	Badge,
	Button,
	createListResource,
	Dropdown,
	FeatherIcon,
	FormControl,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	toast,
} from 'frappe-ui'
import { computed, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import { cleanError } from '@/utils'
import BadgeForm from '@/components/Settings/BadgeForm.vue'
import BadgeAssignments from '@/components/Settings/BadgeAssignments.vue'

const showForm = ref<boolean>(false)
const selectedBadge = ref<string | null>(null)
const showAssignments = ref<boolean>(false)
const showAssignmentsFor = ref<string | null>(null)

const props = defineProps<{
	label: string
	description: string
}>()

const badges = createListResource({
	doctype: 'LMS Badge',
	fields: [
		'name',
		'title',
		'enabled',
		'description',
		'image',
		'grant_only_once',
		'event',
		'reference_doctype',
		'condition',
		'user_field',
		'field_to_check',
	],
	order_by: 'creation desc',
	auto: true,
})

const getMoreOptions = (badgeName: string) => {
	return [
		{
			label: __('Edit'),
			icon: 'edit',
			onClick() {
				openForm(badgeName)
			},
		},
		{
			label: __('Assignments'),
			icon: 'download',
			onClick() {
				showAssignmentsFor.value = badgeName
				showAssignments.value = true
			},
		},
		{
			label: __('Delete'),
			icon: 'trash-2',
			onClick() {
				deleteBadge(badgeName)
			},
		},
	]
}

const openForm = (badgeName: string) => {
	selectedBadge.value = badgeName
	showForm.value = true
}

const deleteBadge = (badgeName: string) => {
	badges.delete
		.submit(badgeName)
		.then(() => {
			badges.reload()
			toast.success(__('Badge deleted successfully'))
		})
		.catch((err: any) => {
			toast.error(cleanError(err.messages[0]) || __('Error deleting badge'))
		})
}

const doctypeLabel = computed(() => {
	return {
		'LMS Course': __('Course'),
		'LMS Batch': __('Batch'),
		'LMS Enrollment': __('Course Enrollment'),
		'LMS Batch Enrollment': __('Batch Enrollment'),
		'LMS Quiz Submission': __('Quiz Submission'),
		'LMS Assignment Submission': __('Assignment Submission'),
		'LMS Programming Exercise Submission': __(
			'Programming Exercise Submission'
		),
	}
})

const columns = computed(() => {
	return [
		{
			label: __('Badge'),
			key: 'title',
			icon: 'award',
			align: 'left',
			width: '25%',
		},
		{
			label: __('Assigned For'),
			key: 'reference_doctype',
			icon: 'info',
			align: 'left',
			width: '35%',
		},
		{
			label: __('Status'),
			key: 'enabled',
			icon: 'check-square',
			align: 'left',
			width: '15%',
		},
		{
			label: __('Grant Only Once'),
			key: 'grant_only_once',
			icon: 'check',
			align: 'center',
			width: '20%',
		},
		{
			key: 'action',
			align: 'right',
		},
	]
})
</script>
