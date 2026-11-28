<template>
	<section class="space-y-4">
		<InlineText
			bleed
			v-if="doc"
			v-model="doc.title"
			:placeholder="__('Course title')"
			:missing="isMissing?.('title')"
			class="!py-0.5 text-4xl-semibold !leading-[1.2] text-ink-gray-9"
			@update:modelValue="markDirty?.()"
			@enter="intro?.focus()"
		/>
		<h1 v-else class="text-4xl-semibold text-ink-gray-9">
			{{ course.title }}
		</h1>

		<!-- Dots only from @xl: on a phone the facts wrap and a dot would lead a line. -->
		<div class="flex flex-wrap items-center gap-x-3 gap-y-2 text-ink-gray-7">
			<CategoryField
				v-if="doc"
				class="-mx-2"
				v-model="doc.category"
				@update:modelValue="markDirty?.()"
			/>
			<router-link
				v-else-if="course.category"
				:to="{ name: 'Courses', query: { category: course.category } }"
				class="flex items-center gap-1.5 font-medium hover:text-ink-gray-9"
			>
				<span class="lucide-tag size-4" />
				<span>{{ course.category }}</span>
			</router-link>
			<div v-if="hasRating" class="flex items-center gap-1">
				<span
					v-if="hasCategory"
					aria-hidden="true"
					class="lucide-dot hidden @xl:block size-5 shrink-0 me-2"
				/>
				<LucideStar class="size-4 text-transparent fill-ink-amber-7" />
				<span class="font-medium text-ink-gray-9">
					{{ formatRating(course.rating) }}
				</span>
				<span v-if="course.rating_count">
					({{ formatAmount(course.rating_count) }})
				</span>
			</div>
			<div v-if="course.enrollments" class="flex items-center gap-1.5">
				<span
					v-if="hasCategory || hasRating"
					aria-hidden="true"
					class="lucide-dot hidden @xl:block size-5 shrink-0 me-1.5"
				/>
				<span class="lucide-users-round size-4" />
				<span>
					{{ __('{0} students').format(formatAmount(course.enrollments)) }}
				</span>
			</div>
			<div v-if="doc && form" class="flex items-center gap-3">
				<span
					v-if="hasCategory || hasRating || course.enrollments"
					aria-hidden="true"
					class="lucide-dot hidden @xl:block size-5 shrink-0"
				/>
				<InstructorsField
					v-model="form.instructors.value"
					memberRole="course_creator"
					class="-mx-2"
					:missing="isMissing?.('instructors')"
					@update:modelValue="markDirty?.()"
				/>
			</div>
			<div v-else-if="course.instructors?.length" class="flex items-center">
				<span
					v-if="hasCategory || hasRating || course.enrollments"
					aria-hidden="true"
					class="lucide-dot hidden @xl:block size-5 shrink-0 me-3"
				/>
				<span
					class="h-6 me-1"
					:class="{ 'avatar-group overlap': course.instructors.length > 1 }"
				>
					<template
						v-for="instructor in course.instructors"
						:key="instructor.username"
					>
						<InstructorHoverCard
							v-if="course.instructors.length > 3"
							:instructor="instructor"
						>
							<UserAvatar :user="instructor" />
						</InstructorHoverCard>
						<UserAvatar v-else :user="instructor" />
					</template>
				</span>
				<CourseInstructors :instructors="course.instructors" hoverCards />
			</div>
		</div>

		<CourseTagsField v-if="doc" />
		<div v-else-if="course.tags" class="flex flex-wrap gap-2">
			<Badge
				v-for="tag in course.tags.split(', ')"
				:key="tag"
				theme="gray"
				size="lg"
			>
				{{ tag }}
			</Badge>
		</div>

		<InlineText
			bleed
			v-if="doc"
			ref="introField"
			v-model="doc.short_introduction"
			:placeholder="
				__('Short introduction: one line on what learners get out of it')
			"
			:missing="isMissing?.('short_introduction')"
			class="leading-6 text-ink-gray-7"
			@update:modelValue="markDirty?.()"
		/>
		<p v-else-if="course.short_introduction" class="text-ink-gray-7 leading-6">
			{{ course.short_introduction }}
		</p>
		<!-- Last: an earlier sibling would take the section's spacing above the title. -->
		<h1 v-if="doc" class="sr-only">{{ doc.title || __('Untitled course') }}</h1>
	</section>
</template>

<script setup lang="ts">
import { Badge } from 'frappe-ui'
import { computed, inject, useTemplateRef } from 'vue'
import { formatAmount, formatRating } from '@/utils/'
import CourseInstructors from '@/components/CourseInstructors.vue'
import InstructorHoverCard from '@/components/InstructorHoverCard.vue'
import CourseTagsField from '@/components/Courses/CourseTagsField.vue'
import CategoryField from '@/components/InlineEdit/CategoryField.vue'
import InlineText from '@/components/InlineEdit/InlineText.vue'
import InstructorsField from '@/components/InlineEdit/InstructorsField.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import type { CourseDetails, CourseFormContext } from '@/types'

/** Title, meta row, tags and intro: inline fields when `editable`. */
const props = defineProps<{
	course: CourseDetails
	editable?: boolean
}>()

const form = inject<CourseFormContext | null>('courseForm', null)
const markDirty = form?.markDirty
const isMissing = form?.isMissing
const intro = useTemplateRef<{ focus: () => void }>('introField')

const doc = computed(() => (props.editable ? form?.resource.doc : null))
const hasCategory = computed<boolean>(() =>
	Boolean(doc.value || props.course.category)
)
const hasRating = computed<boolean>(() => Number(props.course.rating) > 0)
</script>
