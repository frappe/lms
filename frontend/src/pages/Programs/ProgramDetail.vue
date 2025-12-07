<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
	</header>
	<div v-if="program.data" class="pt-5 px-5 pb-10 mx-auto">
		<div class="flex items-center space-x-2 mb-5">
			<div class="text-lg font-semibold text-ink-gray-9">
				{{ program.data.name }}
			</div>

			<Badge :theme="program.data.progress < 100 ? 'orange' : 'green'">
				{{ program.data.progress }}% {{ __('completed') }}
			</Badge>

			<Tooltip
				v-if="program.data.enforce_course_order"
				placement="right"
				:text="
					__(
						'Courses must be completed in order. You can only start the next course after completing the previous one.'
					)
				"
			>
				<Info class="size-3 cursor-pointer" />
			</Tooltip>
		</div>
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
			<div
				v-for="course in program.data.courses"
				:key="course.name"
				class="relative group"
				:class="
					(course.eligible && program.data.enforce_course_order) ||
					!program.data.enforce_course_order
						? 'cursor-pointer'
						: 'cursor-default'
				"
			>
				<CourseCard
					:course="course"
					@click="openCourse(course, program.data.enforce_course_order)"
				/>
				<div
					v-if="!course.eligible && program.data.enforce_course_order"
					class="absolute inset-0 flex flex-col items-center justify-center space-y-2 text-ink-white rounded-md invisible group-hover:visible"
					:style="{
						background: 'radial-gradient(circle, darkgray 0%, lightgray 100%)',
					}"
				>
					<LockKeyhole class="size-5" />
					<span class="font-medium text-center leading-5 px-10">
						{{ __('Please complete the previous course to unlock this one.') }}
					</span>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, inject, onMounted } from 'vue'
import {
	Badge,
	Breadcrumbs,
	call,
	createResource,
	Tooltip,
	usePageMeta,
} from 'frappe-ui'
import { sessionStore } from '@/stores/session'
import { LockKeyhole, Info } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import CourseCard from '@/components/CourseCard.vue'

const { brand } = sessionStore()
const router = useRouter()
const user = inject<any>('$user')

const props = defineProps<{
	programName: string
}>()

onMounted(() => {
	checkIfEnrolled()
})

const checkIfEnrolled = () => {
	call('frappe.client.get_value', {
		doctype: 'LMS Program Member',
		filters: {
			member: user.data.name,
			parent: props.programName,
		},
		parent: 'LMS Program',
		fieldname: 'name',
	}).then((data: { name: string }) => {
		if (data.name) {
			program.reload()
		} else {
			router.push({ name: 'Programs' })
		}
	})
}

const program = createResource({
	url: 'lms.lms.utils.get_program_details',
	params: {
		program_name: props.programName,
	},
})

const openCourse = (course: any, enforceCourseOrder: boolean) => {
	if (!course.eligible && enforceCourseOrder) return
	router.push({
		name: 'CourseDetail',
		params: { courseName: course.name },
	})
}

const breadcrumbs = computed(() => {
	return [
		{ label: __('Programs'), route: { name: 'Programs' } },
		{
			label: props.programName,
			route: {
				name: 'ProgramDetail',
				params: { programName: props.programName },
			},
		},
	]
})

usePageMeta(() => {
	return {
		title: props.programName,
		icon: brand.favicon,
	}
})
</script>
