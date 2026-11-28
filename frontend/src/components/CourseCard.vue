<template>
	<article
		v-if="course.title"
		class="relative isolate flex h-full flex-col rounded-6 border border-outline-gray-2 bg-surface-base p-2 transition hover:border-outline-gray-3 hover:shadow-sm"
	>
		<div
			class="relative flex h-40 shrink-0 items-center justify-center overflow-hidden rounded-4"
			:class="course.image ? 'bg-surface-gray-2' : thumbnailTint"
		>
			<img
				v-if="course.image"
				:src="safeUrl(encodeURI(course.image))"
				alt=""
				class="size-full object-cover"
			/>
			<span
				v-else
				class="size-10 stroke-[1.5]"
				:class="courseIcon(course.icon)"
				aria-hidden="true"
			/>
			<span
				v-if="course.featured"
				class="absolute end-2 top-2 flex items-center gap-1 rounded-full bg-surface-base px-2 py-0.5 text-p-xs text-ink-gray-8 shadow-sm"
			>
				<span class="lucide-award size-3 text-ink-gray-6" aria-hidden="true" />
				{{ __('Featured') }}
			</span>
		</div>

		<div class="flex flex-1 flex-col gap-1.5 px-2 pb-1.5 pt-3">
			<h3 class="line-clamp-2 text-base-semibold leading-snug text-ink-gray-9">
				<CardLink :to="to" :external="external">{{ course.title }}</CardLink>
			</h3>
			<p
				v-if="course.short_introduction"
				class="line-clamp-2 text-p-sm text-ink-gray-6"
			>
				{{ course.short_introduction }}
			</p>

			<!-- First visually, after the title in reading and tab order. -->
			<div class="order-first flex min-h-6 items-center justify-between gap-2">
				<span
					class="flex min-w-0 items-center gap-1.5 text-p-xs-medium uppercase tracking-wide text-ink-gray-6"
				>
					<span v-if="course.category" class="truncate">
						{{ course.category }}
					</span>
				</span>
				<span
					v-if="instructors.length"
					role="img"
					:aria-label="instructorNames"
					class="flex -space-x-1.5 rtl:space-x-reverse"
				>
					<UserAvatar
						v-for="instructor in instructors"
						:key="instructor.username || instructor.full_name"
						:user="instructor"
						size="sm"
					/>
				</span>
			</div>

			<div
				class="mt-auto flex items-center gap-4 pt-3 text-p-sm text-ink-gray-6"
			>
				<template v-if="progress !== null">
					<ProgressBar
						class="flex-1"
						:progress="progress"
						:label="__('Course progress')"
					/>
					<span class="tabular-nums">{{ Math.ceil(progress) }}%</span>
				</template>
				<template v-else>
					<span v-if="hasRating" class="flex items-center gap-1">
						<span class="lucide-star size-4" aria-hidden="true" />
						<span aria-hidden="true">{{ formatRating(course.rating) }}</span>
						<span class="sr-only">
							{{ __('Rated {0} out of 5').format(formatRating(course.rating)) }}
						</span>
					</span>
					<span v-if="hasCertificate" class="flex min-w-0 items-center gap-1">
						<span class="lucide-circle-check size-4" aria-hidden="true" />
						<span class="truncate">{{ __('Certificate') }}</span>
					</span>
					<Badge v-if="isDraft" theme="amber" :label="__('Draft')" />
					<span
						class="ms-auto shrink-0"
						:class="
							course.paid_course
								? 'text-sm-semibold text-ink-gray-9'
								: 'text-ink-gray-7'
						"
					>
						{{ priceLabel }}
					</span>
				</template>
			</div>
		</div>
	</article>
</template>
<script setup>
import { Badge } from 'frappe-ui'
import { computed } from 'vue'
import { sessionStore } from '@/stores/session'
import { formatRating } from '@/utils'
import { joinLabels } from '@/utils/courseForm'
import { courseIcon } from '@/utils/courseIcons'
import { courseTint } from '@/utils/courseTints'
import { safeUrl } from '@/utils/safeUrl'
import CardLink from '@/components/CardLink.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import UserAvatar from '@/components/UserAvatar.vue'

const { user } = sessionStore()

const props = defineProps({
	course: {
		type: Object,
		default: null,
	},
	to: {
		type: [Object, String],
		default: null,
	},
	external: {
		type: Boolean,
		default: false,
	},
})

const thumbnailTint = computed(() => courseTint(props.course.card_gradient))

const instructors = computed(() => (props.course.instructors || []).slice(0, 3))

const instructorNames = computed(() =>
	__('By {0}').format(
		joinLabels(
			(props.course.instructors || []).map((instructor) => instructor.full_name)
		)
	)
)

const progress = computed(() =>
	user && props.course.membership ? props.course.membership.progress || 0 : null
)

const hasRating = computed(() => Number(props.course.rating) > 0)

const hasCertificate = computed(() =>
	Boolean(props.course.enable_certification || props.course.paid_certificate)
)

const isDraft = computed(
	() => 'published' in props.course && !props.course.published
)

const priceLabel = computed(() =>
	props.course.paid_course ? props.course.price : __('Free')
)
</script>
<style>
/* Shared by other instructor avatar rows (BatchOverview, CourseOverview). */
.avatar-group {
	display: inline-flex;
	align-items: center;
}

.avatar-group .avatar {
	transition: margin 0.1s ease-in-out;
}

.avatar-group.overlap .avatar + .avatar {
	margin-inline-start: calc(-8px);
}
</style>
