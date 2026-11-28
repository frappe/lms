<template>
	<PageHeader :breadcrumbs="breadcrumbs" />
	<PageBody>
		<template #name>
			<span class="flex items-center gap-x-2">
				<span
					v-if="isPending"
					class="relative w-48 motion-safe:animate-pulse"
					aria-hidden="true"
					data-testid="program-title-skeleton"
				>
					&nbsp;
					<span
						class="absolute inset-x-0 top-1/2 h-[0.7em] -translate-y-1/2 rounded-4 bg-surface-gray-3"
					/>
				</span>
				{{ program.data?.name }}

				<Badge
					v-if="program.data?.is_member"
					:theme="program.data.progress < 100 ? 'amber' : 'green'"
				>
					{{ __('{0}% completed').format(program.data.progress) }}
				</Badge>

				<template v-if="program.data?.enforce_course_order">
					<Tooltip :side="inlineEndSide()" :text="courseOrderNote">
						<span
							class="lucide-info size-3 cursor-pointer"
							aria-hidden="true"
						/>
					</Tooltip>
					<span class="sr-only">{{ courseOrderNote }}</span>
				</template>
			</span>
		</template>

		<span class="sr-only" role="status">{{ loadingAnnouncement }}</span>
		<div v-if="isPending" class="px-5 pb-10" data-testid="program-skeleton">
			<div
				class="grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-5 mb-5"
			>
				<CourseCardSkeleton v-for="i in 3" :key="i" />
			</div>
		</div>
		<div v-else-if="program.data?.is_member" class="px-5 pb-10">
			<div
				class="grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-5 mb-5"
			>
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
import { computed, useId } from 'vue'
import { inlineEndSide } from '@/utils/textDirection'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import PageBody from '@/components/Layouts/pages/PageBody.vue'
import { Badge, createResource, Tooltip, usePageMeta } from 'frappe-ui'
import { useFlowChanges } from '@/composables/useFlowChanges'
import { sessionStore } from '@/stores/session'

import { useRouter } from 'vue-router'
import CourseCard from '@/components/CourseCard.vue'
import CourseCardSkeleton from '@/components/Skeletons/CourseCardSkeleton.vue'
import { useLoadingAnnouncement } from '@/utils/a11y'
import type { CourseDetails } from '@/types/api'

const { brand } = sessionStore()
const router = useRouter()

const props = defineProps<{
	programName: string
}>()

// Members only: get_program_details says whether the viewer is one.
const program = createResource({
	url: 'lms.lms.utils.get_program_details',
	params: {
		program_name: props.programName,
	},
	auto: true,
	onSuccess(data: { is_member?: boolean }) {
		if (!data.is_member) router.push({ name: 'Programs' })
	},
	onError() {
		router.push({ name: 'Programs' })
	},
})
useFlowChanges({
	doctypes: ['LMS Program'],
	name: () => props.programName,
	reload: () => program.reload(),
})

const isPending = computed(() => program.loading && !program.data)

const loadingAnnouncement = useLoadingAnnouncement(
	() => program.loading,
	() => (program.data ? __('Program loaded') : '')
)

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
