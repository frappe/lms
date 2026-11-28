<template>
	<SkeletonLoader v-if="!course.data" variant="course-page" />
	<div v-else class="p-5">
		<div
			class="flex flex-col @2xl:flex-row items-start justify-between w-full gap-x-8 gap-y-8"
		>
			<div class="w-full min-w-0 space-y-10 @2xl:w-2/3">
				<CourseHeading :course="course.data" :editable="editable" />
				<div class="@2xl:hidden">
					<CourseEditCard v-if="editable" :course="course" />
					<CourseCardOverlay
						v-else
						:course="course"
						:preview="preview"
						@enroll="emit('enroll')"
					/>
				</div>

				<section>
					<div class="flex items-baseline justify-between gap-4 mb-4">
						<h2 class="text-3xl-semibold text-ink-gray-9">
							{{ __('Course content') }}
						</h2>
						<div class="text-base text-ink-gray-6">
							{{ outlineStats }}
						</div>
					</div>
					<DraftCourseOutline
						v-if="form?.draftChapters"
						v-model="form.draftChapters.value"
					/>
					<div v-else class="border rounded-5 p-2">
						<SkeletonLoader
							v-if="outline.loading && !outline.data"
							variant="course-outline"
							:count="10"
						/>
						<div
							v-else-if="!hasCourseContent"
							class="flex items-center justify-center px-4 py-10 text-center"
						>
							<span class="text-sm text-ink-gray-6">
								{{ __('Course content coming soon!') }}
							</span>
						</div>
						<CourseOutline
							v-else
							:courseName="course.data.name"
							:getProgress="Boolean(membership)"
							:editorLinks="isCourseAdmin && !preview"
							:skeletonRows="outlineRows"
						/>
					</div>
				</section>

				<section v-if="editable && form?.resource.doc" class="space-y-3">
					<h2 :id="aboutHeadingId" class="text-3xl-semibold text-ink-gray-9">
						{{ __('About this course') }}
					</h2>
					<RichTextField
						bleed
						:modelValue="form.resource.doc.description"
						:ariaLabelledby="aboutHeadingId"
						:placeholder="
							__(
								'Describe what the course covers, who it is for and what learners can do at the end.'
							)
						"
						:missing="form.isMissing?.('description')"
						@update:modelValue="setDescription"
					/>
				</section>
				<section v-else-if="course.data.description" class="space-y-3">
					<h2 class="text-3xl-semibold text-ink-gray-9">
						{{ __('About this course') }}
					</h2>
					<div
						v-safe-html:rich="course.data.description"
						class="ProseMirror prose prose-sm max-w-none !whitespace-normal prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2"
					/>
				</section>

				<CourseReviews
					v-if="course.data.name"
					:courseName="course.data.name"
					:membership="membership"
				/>
			</div>

			<aside
				class="hidden @2xl:flex w-[22rem] shrink-0 flex-col space-y-6 self-start sticky-below-header"
			>
				<CourseEditCard v-if="editable" :course="course" />
				<CourseCardOverlay
					v-else
					:course="course"
					:preview="preview"
					@enroll="emit('enroll')"
				/>
			</aside>
		</div>

		<RelatedCoursesEditor
			v-if="editable && form"
			v-model="form.relatedCourses.value"
			:courseName="course.data.name"
			:category="course.data.category"
			class="mt-12"
			@update:modelValue="form.markDirty()"
		/>
		<RelatedCourses v-else :courseName="course.data.name" class="mt-12" />
	</div>
</template>

<script setup lang="ts">
import { computed, inject, useId, watch } from 'vue'
import { createResource } from 'frappe-ui'
import type {
	CourseDetails,
	CourseFormContext,
	OutlineChapter,
	Resource,
	SessionUser,
} from '@/types'
import CourseCardOverlay from '@/components/CourseCardOverlay.vue'
import CourseOutline from '@/components/CourseOutline.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import CourseReviews from '@/components/CourseReviews.vue'
import RelatedCourses from '@/components/RelatedCourses.vue'
import RelatedCoursesEditor from '@/components/Courses/RelatedCoursesEditor.vue'
import CourseEditCard from '@/components/Courses/CourseEditCard.vue'
import CourseHeading from '@/components/Courses/CourseHeading.vue'
import DraftCourseOutline from '@/components/Courses/DraftCourseOutline.vue'
import RichTextField from '@/components/InlineEdit/RichTextField.vue'
import { isInstructorOf } from '@/utils/instructors'
import { useCourseFlowChanges } from '@/composables/useFlowChanges'

/** The course page. Instructors edit it in place; learners and previews read it. */
const props = defineProps<{
	course: Resource<CourseDetails | null>
	preview?: 'not-enrolled' | 'enrolled' | null
}>()

const emit = defineEmits<{ enroll: [] }>()

const user = inject<SessionUser>('$user')
const form = inject<CourseFormContext | null>('courseForm', null)
useCourseFlowChanges(props.course)
const aboutHeadingId = useId()

const editable = computed<boolean>(
	() => !props.preview && Boolean(form?.resource.doc)
)

// In student view the server already answers as a learner in that mode.
const membership = computed(() => props.course.data?.membership || null)

const isCourseAdmin = computed<boolean>(
	() =>
		Boolean(user?.data?.is_moderator) ||
		isInstructorOf(props.course.data?.instructors, user?.data?.username)
)

function setDescription(value: string): void {
	if (!form?.resource.doc) return
	form.resource.doc.description = value
	form.markDirty()
}

const outline = createResource({
	url: 'lms.lms.utils.get_course_outline',
	makeParams() {
		return { course: props.course.data?.name, progress: false }
	},
	auto: false,
}) as Resource<OutlineChapter[]>

watch(
	() => props.course.data?.name,
	(name) => {
		if (name) outline.fetch()
	},
	{ immediate: true }
)

// A new course counts the outline being drafted; a saved one, its own.
const outlineCounts = computed<{ chapters: number; lessons: number }>(() => {
	const chapters = form?.draftChapters?.value ?? outline.data ?? []
	const lessons = chapters.reduce(
		(acc: number, chapter: { lessons?: unknown[] }) =>
			acc + (chapter.lessons?.length || 0),
		0
	)
	return { chapters: chapters.length, lessons }
})

const outlineStats = computed(() => {
	const { chapters, lessons } = outlineCounts.value
	const parts: string[] = []
	if (chapters) {
		parts.push(
			chapters === 1 ? __('1 chapter') : __('{0} chapters').format(chapters)
		)
	}
	if (lessons) {
		parts.push(
			lessons === 1 ? __('1 lesson') : __('{0} lessons').format(lessons)
		)
	}
	return parts.join(' · ')
})

// The outline opens with its first chapter expanded.
const outlineRows = computed<number>(
	() => (outline.data?.length || 0) + (outline.data?.[0]?.lessons?.length || 0)
)

const hasCourseContent = computed(() => {
	const chapters = outline.data || []
	const lessonCount = chapters.reduce(
		(acc, c) => acc + (c.lessons?.length || 0),
		0
	)
	return chapters.length > 0 && lessonCount > 0
})
</script>
