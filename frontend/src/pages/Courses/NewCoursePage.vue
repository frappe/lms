<template>
	<div class="flex min-h-full flex-col">
		<PageHeader :breadcrumbs="breadcrumbs">
			<template #status>
				<Badge theme="amber">{{ __('Draft') }}</Badge>
			</template>
			<template #actions>
				<DraftPageActions
					v-if="canCreate"
					:saveFirst="__('Save the course first')"
				>
					<CourseSaveButton :form="form" />
				</DraftPageActions>
			</template>
		</PageHeader>
		<p v-if="!canCreate" class="p-5 text-p-base text-ink-gray-6">
			{{ __('You are not permitted to create a course.') }}
		</p>
		<template v-else>
			<DraftBanner
				:title="__('This is your course page')"
				:description="
					__(
						'Learners see it exactly like this. Click any grey placeholder to fill it in, then save.'
					)
				"
			/>
			<CourseOverview :course="course" />
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, usePageMeta } from 'frappe-ui'
import { useOnboarding } from '@framework/ui/components/Onboarding/index'
import { useTelemetry } from '@framework/ui/telemetry/index'
import CourseSaveButton from '@/components/Courses/CourseSaveButton.vue'
import DraftBanner from '@/components/InlineEdit/DraftBanner.vue'
import DraftPageActions from '@/components/InlineEdit/DraftPageActions.vue'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import CourseOverview from '@/pages/Courses/CourseOverview.vue'
import { filledFields, takeFormSource } from '@/composables/formTracking'
import { chaptersToCreate, useCourseDraft } from '@/composables/useCourseDraft'
import {
	saveShortcut,
	useKeyboardShortcuts,
} from '@/composables/useKeyboardShortcuts'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'
import { canCreateCourse } from '@/utils'
import { seesOnboarding } from '@/utils/onboarding'
import type { CourseDetails, Resource, SessionUser } from '@/types'

const router = useRouter()
const user = inject<SessionUser>('$user')!
const { capture } = useTelemetry()
const { updateOnboardingStep } = useOnboarding('learning')
const canCreate = computed<boolean>(() => canCreateCourse())
let created = false
// Set while Save and leave creates the course, so it goes where the user was headed.
let isLeaving = false

// Whoever creates the course usually teaches it. Administrator is a system
// account, never an instructor.
const creator = user.data?.name
const form = useCourseDraft(
	creator && creator !== 'Administrator' ? creator : null,
	onCreated
)

function onCreated(name: string): void {
	created = true
	if (seesOnboarding(user.data)) {
		updateOnboardingStep('create_first_course', true, false, () => {
			localStorage.setItem('firstCourse', name)
		})
		const outline = chaptersToCreate(form.draftChapters.value)
		if (outline.length) updateOnboardingStep('create_first_chapter')
		if (outline.some((chapter) => chapter.lessons.length)) {
			updateOnboardingStep('create_first_lesson')
		}
	}
	if (isLeaving) return
	router.replace({
		name: 'CourseDetail',
		params: { courseName: name },
		hash: '#overview',
	})
}

useUnsavedChangesGuard({
	isDirty: () => form.hasEdits.value,
	isSaving: form.isSaving,
	save: async () => {
		isLeaving = true
		try {
			return await form.submitCourse()
		} finally {
			isLeaving = false
		}
	},
})

const title = computed<string>(() => form.resource.doc?.title?.trim() || '')

const course = reactive({
	data: computed(
		() =>
			({
				...form.resource.doc,
				name: '',
				title: title.value,
				instructors: [],
			} as unknown as CourseDetails)
	),
}) as unknown as Resource<CourseDetails | null>

const breadcrumbs = computed(() => [
	{ label: __('Courses'), route: { name: 'Courses' } },
	...(title.value
		? [{ label: title.value, route: { name: 'NewCourse' } }]
		: []),
])

useKeyboardShortcuts({
	active: () => canCreate.value,
	ignoreTyping: false,
	shortcuts: [saveShortcut(() => form.submitCourse())],
})

usePageMeta(() => ({ title: title.value || __('New course') }))

onMounted(() => capture('course_form_opened', { source: takeFormSource() }))
onBeforeUnmount(() => {
	if (created) return
	const doc = form.resource.doc as Record<string, unknown>
	capture('course_form_closed', { data: doc, filled_fields: filledFields(doc) })
})
</script>
