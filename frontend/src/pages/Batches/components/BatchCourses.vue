<template>
	<div>
		<div class="flex items-center justify-between mb-4">
			<div class="text-ink-gray-9 font-semibold">
				{{ __('Courses') }}
			</div>
			<Button v-if="isAdmin()" @click="openCourseModal()">
				<template #prefix>
					<span class="lucide-plus h-4 w-4" />
				</template>
				{{ __('Add') }}
			</Button>
		</div>
		<div v-if="courses.data?.length" class="text-sm">
			<ResponsiveListView
				:columns="courseColumns"
				:rows="courses.data"
				row-key="name"
				class="sm:border sm:rounded-lg"
				:options="listOptions"
			>
				<template #selection-actions="{ unselectAll, selections }">
					<Button
						variant="ghost"
						class="text-p-base-medium"
						:label="__('Delete selected courses')"
						@click="removeCourses(selections, unselectAll)"
					>
						<span class="lucide-trash-2 h-4 w-4" />
					</Button>
				</template>
			</ResponsiveListView>
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
import { computed, ref, inject } from 'vue'
import BatchCourseModal from '@/components/Modals/BatchCourseModal.vue'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
import { createListResource, Button, toast } from 'frappe-ui'
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

const courseColumns = [
	{
		label: __('Title'),
		key: 'title',
	},
	{
		label: __('Evaluator'),
		key: 'evaluator',
		width: '10rem',
	},
]

const listOptions = computed(() => ({
	showTooltip: false,
	selectable: user.data?.is_student ? false : true,
	getRowRoute: (row) => ({
		name: 'CourseDetail',
		params: { courseName: row.course },
	}),
}))

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
