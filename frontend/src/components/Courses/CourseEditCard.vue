<template>
	<div
		class="w-full overflow-hidden rounded-6 border border-outline-gray-2 bg-surface-base"
	>
		<div class="px-5 pt-5">
			<CourseVideoField
				:image="doc.image"
				:tint="doc.card_gradient"
				:icon="doc.icon"
				:videoLink="doc.video_link"
				@update:videoLink="(value) => setField('video_link', value)"
			/>
		</div>
		<div class="space-y-4 p-5">
			<PriceField
				:paid="Boolean(doc.paid_course)"
				:currency="doc.currency"
				:amount="doc.course_price"
				:label="__('Course price')"
				:missing="isMissing?.('price')"
				@update:paid="setPaidCourse"
				@update:currency="(value) => setField('currency', value)"
				@update:amount="(value) => setField('course_price', value)"
			/>
			<div class="space-y-2">
				<Button variant="solid" size="md" class="w-full" disabled>
					<template #prefix>
						<span
							class="size-4"
							:class="
								doc.paid_course ? 'lucide-credit-card' : 'lucide-book-text'
							"
						/>
					</template>
					{{ doc.paid_course ? __('Buy this course') : __('Start learning') }}
				</Button>
				<p
					v-if="doc.disable_self_learning"
					class="text-center text-p-xs text-ink-gray-6"
				>
					{{ __('Self enrollment is off, so you enroll learners yourself.') }}
				</p>
			</div>
			<CourseCertificateBox />
			<div class="border-t border-outline-gray-1 pt-4">
				<CourseIncludes
					:enrollments="doc.enrollments"
					:lessons="course.data?.lessons"
					:quizzes="course.data?.quiz_count"
					:hasVideo="Boolean(doc.video_link)"
					:certificate="certificate"
				/>
			</div>
		</div>
	</div>

	<PaymentsAppDialog v-model="needsPaymentsApp" />
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'
import { computed } from 'vue'
import CourseCertificateBox from '@/components/Courses/CourseCertificateBox.vue'
import CourseIncludes from '@/components/Courses/CourseIncludes.vue'
import CourseVideoField from '@/components/Courses/CourseVideoField.vue'
import PriceField from '@/components/InlineEdit/PriceField.vue'
import PaymentsAppDialog from '@/components/PaymentsAppDialog.vue'
import { useCourseOffer } from '@/composables/useCourseOffer'
import type { CourseDetails, Resource } from '@/types'

/** The enrol card as instructors edit it: learners see the same card. */
defineProps<{ course: Resource<CourseDetails | null> }>()

const {
	resource,
	isMissing,
	certificate: kind,
	needsPaymentsApp,
	setField,
	setPaidCourse,
} = useCourseOffer()

const doc = computed(() => resource.doc!)

const certificate = computed<'free' | 'paid' | null>(() =>
	kind.value === 'none' ? null : kind.value
)
</script>
