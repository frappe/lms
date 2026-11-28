<template>
	<section class="flex flex-col gap-4">
		<InlineText
			bleed
			v-if="doc"
			v-model="doc.title"
			:placeholder="__('Batch title')"
			:missing="form?.isMissing('title')"
			class="-my-px !py-0 text-4xl-semibold text-ink-gray-9"
			@enter="descriptionField?.focus()"
		/>
		<h1 v-else class="text-4xl-semibold text-ink-gray-9">
			{{ batch.title }}
		</h1>

		<!-- Dots only from @xl: on a phone the facts wrap and a dot would lead a line. -->
		<div
			class="flex flex-wrap items-center gap-x-3 gap-y-2 text-ink-gray-7"
			:class="doc && '-my-0.5'"
		>
			<CategoryField v-if="doc" v-model="doc.category" class="-mx-2" />
			<span
				v-else-if="batch.category"
				class="flex items-center gap-1.5 font-medium"
			>
				<span class="lucide-tag size-4" />
				{{ batch.category }}
			</span>
			<span
				v-if="doc || batch.category || batch.instructors?.length"
				class="lucide-dot hidden @xl:block size-5"
			/>
			<InstructorsField
				v-if="doc && form && batch.can_change_instructors"
				v-model="form.instructors.value"
				memberRole="batch_evaluator"
				:roles="['Moderator', 'Course Creator', 'Batch Evaluator']"
				class="-mx-2"
				:missing="form.isMissing('instructors')"
			/>
			<div v-else-if="batch.instructors?.length" class="flex items-center">
				<span
					class="h-6 me-1"
					:class="{ 'avatar-group overlap': batch.instructors.length > 1 }"
				>
					<template
						v-for="instructor in batch.instructors"
						:key="instructor.username"
					>
						<InstructorHoverCard
							v-if="batch.instructors.length > 3"
							:instructor="instructor"
						>
							<UserAvatar :user="instructor" />
						</InstructorHoverCard>
						<UserAvatar v-else :user="instructor" />
					</template>
				</span>
				<CourseInstructors :instructors="batch.instructors" hoverCards />
			</div>
			<template v-if="batch.student_count">
				<span class="lucide-dot hidden @xl:block size-5" />
				<span class="flex items-center gap-1.5">
					<span class="lucide-users-round size-4" />
					{{ __('{0} enrolled').format(batch.student_count) }}
				</span>
			</template>
		</div>

		<InlineText
			bleed
			v-if="doc"
			ref="descriptionField"
			v-model="doc.description"
			:placeholder="
				__(
					'Short description: one line on who this batch is for and what they leave with'
				)
			"
			:missing="form?.isMissing('description')"
			class="-my-[7px] text-base leading-6 text-ink-gray-7"
		/>
		<p v-else-if="batch.description" class="leading-6 text-ink-gray-7">
			{{ batch.description }}
		</p>
	</section>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import CourseInstructors from '@/components/CourseInstructors.vue'
import InstructorHoverCard from '@/components/InstructorHoverCard.vue'
import CategoryField from '@/components/InlineEdit/CategoryField.vue'
import InlineText from '@/components/InlineEdit/InlineText.vue'
import InstructorsField from '@/components/InlineEdit/InstructorsField.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import type { BatchForm } from '@/pages/Batches/composables/useBatchForm'
import type { LMSBatch } from '@/types/lms/LMSBatch'

/** Title, meta row and short description: inline fields when `doc` is set. */
defineProps<{
	batch: Record<string, any>
	doc: LMSBatch | null
	form: BatchForm | null
}>()

const descriptionField = useTemplateRef<{ focus: () => void }>(
	'descriptionField'
)
</script>
