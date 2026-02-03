<template>
	<div>
		<div class="flex items-center justify-between mb-4">
			<div class="text-ink-gray-9 font-medium">
				{{ studentCount.data ?? 0 }} {{ __('Students') }}
			</div>
			<Button v-if="!readOnlyMode" @click="openStudentModal()">
				<template #prefix>
					<Plus class="h-4 w-4" />
				</template>
				{{ __('Add') }}
			</Button>
		</div>

		<div v-if="students.data?.length">
			<ListView
				class="max-h-[75vh]"
				:columns="studentColumns"
				:rows="students.data"
				row-key="name"
				:options="{
					showTooltip: false,
				}"
			>
				<ListHeader
					class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem
						:item="item"
						v-for="item in studentColumns"
						:title="item.label"
					>
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
					<ListRow
						:row="row"
						v-for="row in students.data"
						class="group cursor-pointer hover:bg-surface-gray-2 rounded"
						@click="openStudentProgressModal(row)"
					>
						<template #default="{ column, item }">
							<ListRowItem
								:item="row[column.key]"
								:align="column.align"
								class="text-sm"
							>
								<template #prefix>
									<div v-if="column.key == 'full_name'">
										<Avatar
											class="flex items-center"
											:image="row['user_image']"
											:label="item"
											size="sm"
										/>
									</div>
								</template>
								<div
									v-if="column.key == 'progress'"
									class="flex items-center space-x-4 w-full"
								>
									<ProgressBar :progress="row[column.key]" size="sm" />
									<div class="text-xs">{{ row[column.key] }}%</div>
								</div>
								<div v-else>
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
								@click="removeStudents(selections, unselectAll)"
							>
								<Trash2 class="h-4 w-4 stroke-1.5" />
							</Button>
						</div>
					</template>
				</ListSelectBanner>
				<div class="mt-4 flex justify-center" v-if="students.hasNextPage">
					<Button @click="students.next()">
						{{ __('Load More') }}
					</Button>
				</div>
			</ListView>
		</div>
		<div v-else-if="!students.loading" class="text-sm italic text-ink-gray-5">
			{{ __('There are no students in this batch.') }}
		</div>
	</div>

	<StudentModal
		:batch="props.batch.data.name"
		v-model="showStudentModal"
		v-model:reloadStudents="students"
		v-model:batchModal="props.batch"
	/>
	<BatchStudentProgress
		:student="selectedStudent"
		v-model="showStudentProgressModal"
	/>
</template>
<script setup>
import {
	Avatar,
	Button,
	createListResource,
	createResource,
	FeatherIcon,
	ListHeader,
	ListHeaderItem,
	ListSelectBanner,
	ListRow,
	ListRows,
	ListView,
	ListRowItem,
	toast,
} from 'frappe-ui'
import { Plus, Trash2 } from 'lucide-vue-next'
import { ref } from 'vue'
import StudentModal from '@/components/Modals/StudentModal.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import BatchStudentProgress from '@/components/Modals/BatchStudentProgress.vue'

const showStudentModal = ref(false)
const showStudentProgressModal = ref(false)
const selectedStudent = ref(null)
const readOnlyMode = window.read_only_mode

const props = defineProps({
	batch: {
		type: Object,
		default: null,
	},
})

const studentCount = createResource({
	url: 'frappe.client.get_count',
	cache: ['batch_student_count', props.batch?.data?.name],
	params: {
		doctype: 'LMS Batch Enrollment',
		filters: { batch: props.batch?.data?.name },
	},
	auto: true,
})

const students = createListResource({
	doctype: 'LMS Batch Enrollment',
	url: 'lms.lms.utils.get_batch_students',
	cache: ['batch_students', props.batch?.data?.name],
	pageLength: 50,
	filters: {
		batch: props.batch?.data?.name,
	},
	auto: true,
})

const studentColumns = [
	{
		label: 'Full Name',
		key: 'full_name',
		width: '25rem',
		icon: 'user',
	},
	{
		label: 'Progress',
		key: 'progress',
		width: '15rem',
		icon: 'activity',
	},
	{
		label: 'Last Active',
		key: 'last_active',
		width: '10rem',
		align: 'center',
		icon: 'clock',
	},
]

const openStudentModal = () => {
	showStudentModal.value = true
}

const openStudentProgressModal = (row) => {
	showStudentProgressModal.value = true
	selectedStudent.value = row
}

const deleteStudents = createResource({
	url: 'lms.lms.api.delete_documents',
	makeParams(values) {
		return {
			doctype: 'LMS Batch Enrollment',
			documents: values.students,
		}
	},
})

const removeStudents = (selections, unselectAll) => {
	deleteStudents.submit(
		{
			students: Array.from(selections),
		},
		{
			onSuccess(data) {
				students.reload()
				studentCount.reload()
				props.batch.reload()
				toast.success(__('Students deleted successfully'))
				unselectAll()
			},
		}
	)
}
</script>
