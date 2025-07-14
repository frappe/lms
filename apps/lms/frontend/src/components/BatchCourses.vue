<template>
	<div>
		<div class="flex items-center justify-between mb-4">
			<div class="text-lg font-semibold text-ink-gray-9">
				{{ __('Courses') }}
			</div>
			<Button v-if="canSeeAddButton()" @click="openCourseModal()">
				<template #prefix>
					<Plus class="h-4 w-4" />
				</template>
				{{ __('Add') }}
			</Button>
		</div>
		<div v-if="courses.data?.length">
			<ListView
				:columns="getCoursesColumns()"
				:rows="courses.data"
				row-key="batch_course"
				:options="{
					showTooltip: false,
					selectable: user.data?.is_student ? false : true,
					getRowRoute: (row) => ({
						name: 'CourseDetail',
						params: { courseName: row.name },
					}),
				}"
			>
				<ListHeader
					class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in getCoursesColumns()">
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
					<ListRow :row="row" v-for="row in courses.data">
						<template #default="{ column, item }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<div>
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
								@click="removeCourses(selections, unselectAll)"
							>
								<Trash2 class="h-4 w-4 stroke-1.5" />
							</Button>
						</div>
					</template>
				</ListSelectBanner>
			</ListView>
		</div>
		<div v-else class="text-sm italic text-ink-gray-5">
			{{ __('No courses added') }}
		</div>
		<BatchCourseModal
			v-model="showCourseModal"
			:batch="batch"
			v-model:courses="courses"
		/>
	</div>
</template>
<script setup>
import { ref, inject } from 'vue'
import BatchCourseModal from '@/components/Modals/BatchCourseModal.vue'
import {
	createResource,
	Button,
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
const readOnlyMode = window.read_only_mode

const showCourseModal = ref(false)
const user = inject('$user')

const props = defineProps({
	batch: {
		type: String,
		required: true,
	},
})

const courses = createResource({
	url: 'lms.lms.utils.get_batch_courses',
	params: {
		batch: props.batch,
	},
	cache: ['batchCourses', props.batchName],
	auto: true,
})

const openCourseModal = () => {
	showCourseModal.value = true
}

const getCoursesColumns = () => {
	return [
		{
			label: 'Title',
			key: 'title',
			width: 2,
		},
		{
			label: 'Lessons',
			key: 'lessons',
			align: 'right',
		},
		{
			label: 'Enrollments',
			align: 'right',
			key: 'enrollments',
		},
	]
}

const deleteCourses = createResource({
	url: 'lms.lms.api.delete_documents',
	makeParams(values) {
		return {
			doctype: 'Batch Course',
			documents: values.courses,
		}
	},
})

const removeCourses = (selections, unselectAll) => {
	deleteCourses.submit(
		{
			courses: Array.from(selections),
		},
		{
			onSuccess(data) {
				courses.reload()
				toast.success(__('Courses deleted successfully'))
				unselectAll()
			},
		}
	)
}

const canSeeAddButton = () => {
	if (readOnlyMode) {
		return false
	}
	return user.data?.is_moderator || user.data?.is_evaluator
}
</script>
