<template>
	<div
		v-if="course.title"
		class="relative isolate flex flex-col h-full rounded-5 overflow-auto text-ink-gray-9 bg-surface-elevation-1"
		style="min-height: 350px"
	>
		<div
			class="w-[100%] h-[168px] bg-cover bg-center bg-no-repeat border-t border-x rounded-t-5"
			:style="
				course.image
					? { backgroundImage: `url('${encodeURI(course.image)}')` }
					: {
							backgroundImage: gradientColor,
							backgroundBlendMode: 'screen',
					  }
			"
		>
			<!-- <div class="flex items-center flex-wrap relative top-4 px-2 w-fit">
				<div
					v-if="course.featured"
					class="flex items-center gap-x-1 text-xs text-ink-amber-5 bg-surface-base border border-outline-amber-1 px-2 py-0.5 rounded-5 me-1 mb-1"
				>
					<LucideStar class="size-3 stroke-2" />
					<span>
						{{ __('Featured') }}
					</span>
				</div>
				<div
					v-if="course.tags"
					v-for="tag in course.tags?.split(', ')"
					class="text-xs border bg-surface-base text-ink-gray-9 px-2 py-0.5 rounded-5 mb-1 me-1"
				>
					{{ tag }}
				</div>
			</div> -->
			<div
				v-if="!course.image"
				class="flex items-center justify-center text-white flex-1 font-extrabold my-auto px-5 text-center leading-6 h-full"
				:class="
					course.title.length > 32
						? 'text-lg'
						: course.title.length > 20
						? 'text-2xl'
						: 'text-3xl'
				"
			>
				<CardLink :to="to" :external="external">{{ course.title }}</CardLink>
			</div>
		</div>
		<div class="flex flex-col flex-auto p-4 border-x-2 border-b-2 rounded-b-5">
			<div class="flex items-center justify-between mb-2">
				<div v-if="course.lessons">
					<Tooltip :text="__('Lessons')">
						<span class="relative z-10 flex items-center">
							<span class="lucide-book-open size-4 me-1" aria-hidden="true" />
							<span aria-hidden="true">{{ course.lessons }}</span>
							<span class="sr-only">{{ lessonCount }}</span>
						</span>
					</Tooltip>
				</div>

				<div v-if="course.enrollments">
					<Tooltip :text="__('Enrolled Students')">
						<span class="relative z-10 flex items-center">
							<span class="lucide-users size-4 me-1" aria-hidden="true" />
							<span aria-hidden="true">
								{{ formatAmount(course.enrollments) }}
							</span>
							<span class="sr-only">
								{{
									__('{0} enrolled').format(formatAmount(course.enrollments))
								}}
							</span>
						</span>
					</Tooltip>
				</div>

				<div v-if="course.rating">
					<Tooltip :text="__('Average Rating')">
						<span class="relative z-10 flex items-center">
							<LucideStar
								class="size-4 me-1 text-transparent fill-ink-amber-7"
								aria-hidden="true"
							/>
							<span aria-hidden="true">{{ formatRating(course.rating) }}</span>
							<span class="sr-only">
								{{
									__('Rated {0} out of 5').format(formatRating(course.rating))
								}}
							</span>
						</span>
					</Tooltip>
				</div>

				<Tooltip v-if="course.featured" :text="__('Featured')">
					<span class="relative z-10 flex">
						<span
							class="lucide-award size-4 text-ink-amber-5"
							aria-hidden="true"
						/>
						<span class="sr-only">{{ __('Featured') }}</span>
					</span>
				</Tooltip>
			</div>

			<div
				v-if="course.image"
				class="font-semibold leading-6"
				:class="course.title.length > 32 ? 'text-lg' : 'text-2xl'"
			>
				<CardLink :to="to" :external="external">{{ course.title }}</CardLink>
			</div>

			<div class="short-introduction text-sm">
				{{ course.short_introduction }}
			</div>

			<ProgressBar
				v-if="user && course.membership"
				:progress="course.membership.progress"
				:label="__('Course progress')"
			/>

			<div v-if="user && course.membership" class="text-sm mt-2 mb-4">
				{{ Math.ceil(course.membership.progress) }}% {{ __('completed') }}
			</div>

			<div class="flex items-center justify-between mt-auto">
				<div class="flex avatar-group overlap">
					<div
						class="relative z-10 h-6 me-1"
						:class="{ 'avatar-group overlap': course.instructors.length > 1 }"
					>
						<UserAvatar
							v-for="instructor in course.instructors"
							:key="instructor.username || instructor.name"
							:user="instructor"
						/>
					</div>
					<CourseInstructors :instructors="course.instructors" />
				</div>

				<div class="flex items-center gap-x-2">
					<div v-if="course.paid_course" class="font-semibold">
						{{ course.price }}
					</div>

					<Tooltip
						v-if="course.paid_certificate || course.enable_certification"
						:text="__('Get Certified')"
					>
						<span class="relative z-10 flex">
							<span
								class="lucide-graduation-cap size-5 text-ink-gray-7"
								aria-hidden="true"
							/>
							<span class="sr-only">{{ __('Get Certified') }}</span>
						</span>
					</Tooltip>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { sessionStore } from '@/stores/session'
import { Tooltip } from 'frappe-ui'
import { formatAmount, formatRating } from '@/utils'
import { computed, watch } from 'vue'
import CardLink from '@/components/CardLink.vue'
import CourseInstructors from '@/components/CourseInstructors.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ProgressBar from '@/components/ProgressBar.vue'

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

const lessonCount = computed(() =>
	props.course.lessons == 1
		? __('1 lesson')
		: __('{0} lessons').format(props.course.lessons)
)

const gradientColor = computed(() => {
	let color = props.course.card_gradient?.toLowerCase() || 'blue'
	// token-exempt: card art stays dark in both themes.
	return `linear-gradient(to top right, black, var(--${color}-400))`
})
</script>
<style>
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

.short-introduction {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	text-overflow: ellipsis;
	width: 100%;
	overflow: hidden;
	margin: 0.25rem 0 1.25rem;
	line-height: 1.5;
}
</style>
