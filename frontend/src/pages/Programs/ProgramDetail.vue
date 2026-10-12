<template>
	<PageHeader :breadcrumbs="breadcrumbs" />
	<PageBody>
		<template #name>
			<span class="flex items-center gap-x-2">
				{{ program.data?.name }}

				<Badge
					v-if="program.data"
					:theme="program.data.progress < 100 ? 'amber' : 'green'"
				>
					{{ program.data.progress }}% {{ __('completed') }}
				</Badge>

				<template v-if="program.data?.enforce_course_order">
					<Tooltip side="right" :text="courseOrderNote">
						<span
							class="lucide-info size-3 cursor-pointer"
							aria-hidden="true"
						/>
					</Tooltip>
					<span class="sr-only">{{ courseOrderNote }}</span>
				</template>
			</span>
		</template>

		<div v-if="program.data" class="px-5 pb-10">
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
				<div
					v-for="(course, index) in program.data.courses"
					:key="course.name"
					:tabindex="isLocked(course) ? 0 : undefined"
					:aria-describedby="
						isLocked(course) ? `${lockNoteId}-${index}` : undefined
					"
					class="relative group"
				>
					<CourseCard
						:course="course"
						:to="isLocked(course) ? undefined : courseRoute(course)"
					/>
					<div
						v-if="isLocked(course)"
						:id="`${lockNoteId}-${index}`"
						class="absolute inset-0 flex flex-col items-center justify-center space-y-2 text-ink-base rounded-5 invisible group-hover:visible group-focus-within:visible [@media(hover:none)]:group-active:visible"
						:style="{
							background:
								'radial-gradient(circle, darkgray 0%, lightgray 100%)',
						}"
					>
						<span class="lucide-lock-keyhole size-5" aria-hidden="true" />
						<span class="font-medium text-center leading-5 px-10">
							{{
								__('Please complete the previous course to unlock this one.')
							}}
						</span>
					</div>
				</div>
			</div>
		</div>
	</PageBody>
</template>
<script setup lang="ts">
import { computed, inject, onMounted, useId } from 'vue'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import PageBody from '@/components/Layouts/pages/PageBody.vue'
import { Badge, call, createResource, Tooltip, usePageMeta } from 'frappe-ui'
import { sessionStore } from '@/stores/session'

import { useRouter } from 'vue-router'
import CourseCard from '@/components/CourseCard.vue'
import type { CourseDetails } from '@/types/api'

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

const courseOrderNote = __(
	'Courses must be completed in order. You can only start the next course after completing the previous one.'
)

type ProgramCourseCard = Pick<CourseDetails, 'name'> & { eligible: boolean }

const lockNoteId = useId()

const isLocked = (course: ProgramCourseCard) =>
	!course.eligible && Boolean(program.data?.enforce_course_order)

const courseRoute = (course: ProgramCourseCard) => ({
	name: 'CourseDetail',
	params: { courseName: course.name },
})

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
