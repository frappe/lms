<template>
	<div class="flex items-center justify-between mb-4">
		<div class="text-lg font-semibold">
			{{ __('Students') }}
		</div>
		<Button @click="openStudentModal()">
			<template #prefix>
				<Plus class="h-4 w-4" />
			</template>
			{{ __('Add') }}
		</Button>
	</div>
	<div v-if="students.data?.length">
		<ListView
			:columns="getStudentColumns()"
			:rows="students.data"
			row-key="name"
			:options="{ showTooltip: false }"
		>
			<ListHeader
				class="mb-2 grid items-center space-x-4 rounded bg-gray-100 p-2"
			>
				<ListHeaderItem
					:item="item"
					v-for="item in getStudentColumns()"
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
				<ListRow :row="row" v-for="row in students.data">
					<template #default="{ column, item }">
						<ListRowItem :item="row[column.key]" :align="column.align">
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
							<div v-if="column.key == 'courses'">
								{{ row[column.key] }}
							</div>
							<div v-else-if="column.icon == 'book-open'">
								{{ Math.ceil(row.courses[column.key]) }}
							</div>
							<div v-else-if="column.icon == 'help-circle'">
								<Badge
									v-if="isAssignment(row.assessments[column.key])"
									:theme="getStatusTheme(row.assessments[column.key])"
									class="text-xs"
								>
									{{ row.assessments[column.key] }}
								</Badge>
								<div v-else>{{ parseInt(row.assessments[column.key]) }}</div>
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
		</ListView>
	</div>
	<div v-else class="text-sm italic text-gray-600">
		{{ __('There are no students in this batch.') }}
	</div>
	<StudentModal
		:batch="props.batch"
		v-model="showStudentModal"
		v-model:reloadStudents="students"
	/>
</template>
<script setup>
import {
	Avatar,
	Badge,
	Button,
	createResource,
	FeatherIcon,
	ListHeader,
	ListHeaderItem,
	ListSelectBanner,
	ListRow,
	ListRows,
	ListView,
	ListRowItem,
} from 'frappe-ui'
import { Trash2, Plus } from 'lucide-vue-next'
import { ref } from 'vue'
import StudentModal from '@/components/Modals/StudentModal.vue'
import { showToast } from '@/utils'

const showStudentModal = ref(false)

const props = defineProps({
	batch: {
		type: String,
		default: null,
	},
})

const students = createResource({
	url: 'lms.lms.utils.get_batch_students',
	cache: ['students', props.batch],
	params: {
		batch: props.batch,
	},
	auto: true,
})

const getStudentColumns = () => {
	let columns = [
		{
			label: 'Full Name',
			key: 'full_name',
			width: '15rem',
		},
	]

	if (students.data?.[0].assessments) {
		Object.keys(students.data?.[0].assessments).forEach((assessment) => {
			columns.push({
				label: assessment,
				key: assessment,
				width: '10rem',
				icon: 'help-circle',
				align: isAssignment(students.data?.[0].assessments[assessment])
					? 'left'
					: 'center',
			})
		})
	}

	if (students.data?.[0].courses) {
		Object.keys(students.data?.[0].courses).forEach((course) => {
			columns.push({
				label: course,
				key: course,
				width: '10rem',
				icon: 'book-open',
				align: 'center',
			})
		})
	}

	return columns
}

const openStudentModal = () => {
	showStudentModal.value = true
}

const deleteStudents = createResource({
	url: 'lms.lms.api.delete_documents',
	makeParams(values) {
		return {
			doctype: 'Batch Student',
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
				showToast(__('Success'), __('Students deleted successfully'), 'check')
				unselectAll()
			},
		}
	)
}

const getStatusTheme = (status) => {
	if (status === 'Pass') {
		return 'green'
	} else if (status == 'Not Graded') {
		return 'orange'
	} else {
		return 'red'
	}
}

const isAssignment = (value) => {
	return isNaN(value)
}
</script>
