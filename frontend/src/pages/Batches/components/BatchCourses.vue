<template>
	<div>
		<div class="flex items-center justify-between mb-4">
			<div class="text-ink-gray-9 font-semibold">
				{{ __('Courses') }}
			</div>
			<Button v-if="isAdmin()" @click="openCourseModal()">
				<template #prefix>
					<Plus class="h-4 w-4" />
				</template>
				{{ __('Add') }}
			</Button>
		</div>
		<div v-if="courses.data?.length" class="text-sm">
			<ListView
				:columns="getCoursesColumns()"
				:rows="courses.data"
				row-key="name"
				class="border rounded-lg"
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
					class="mb-2 grid items-center space-x-4 rounded-none rounded-t bg-surface-gray-2 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in getCoursesColumns()">
					</ListHeaderItem>
				</ListHeader>
				<ListRows>
					<ListRow :row="row" v-for="row in courses.data" class="!rounded-none">
						<template #default="{ column, item }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<div>
									{{ row[column.key] }}
								</div>
							</ListRowItem>
						</template>
					</ListRow>
				</ListRows>
				<ListSelectBanner class="!min-w-0">
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
		<div v-else class="text-ink-gray-7">
			{{ __('No courses added to this batch') }}
		</div>
		<BatchCourseModal
			v-model="showCourseModal"
			:batch="batch.data?.name"
			v-model:courses="courses"
		/>
	</div>
</template>
<script setup>
import { ref, inject, nextTick } from 'vue'
import BatchCourseModal from '@/components/Modals/BatchCourseModal.vue'
import {
	createListResource,
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
		type: Object,
		required: true,
	},
})

const courses = createListResource({
	doctype: 'Batch Course',
	filters: {
		parent: props.batch.data?.name,
		parenttype: 'LMS Batch',
	},
	fields: ['name', 'course', 'title', 'evaluator'],
	parent: 'LMS Batch',
	orderBy: 'idx',
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
		},
		{
			label: 'Evaluator',
			key: 'evaluator',
			width: '10rem',
		},
	]
}

const removeCourses = async (selections, unselectAll) => {
	for (const course of selections) {
		await courses.delete.submit(course)
	}

	unselectAll()
	toast.success(__('Courses deleted successfully'))
}

const isAdmin = () => {
	if (readOnlyMode) {
		return false
	}
	return user.data?.is_moderator || user.data?.is_evaluator
}
</script>
