<template>
	<div
		v-if="course.title"
		class="flex flex-col h-full rounded-md overflow-auto text-ink-gray-9"
		style="min-height: 350px"
	>
		<div
			class="w-[100%] h-[168px] bg-cover bg-center bg-no-repeat"
			:style="
				course.image
					? { backgroundImage: `url('${encodeURI(course.image)}')` }
					: {
							backgroundImage: getGradientColor(),
							backgroundBlendMode: 'screen',
					  }
			"
		>
			<!-- <div class="flex items-center flex-wrap relative top-4 px-2 w-fit">
				<div
					v-if="course.featured"
					class="flex items-center space-x-1 text-xs text-ink-amber-3 bg-surface-white border border-outline-amber-1 px-2 py-0.5 rounded-md mr-1 mb-1"
				>
					<Star class="size-3 stroke-2" />
					<span>
						{{ __('Featured') }}
					</span>
				</div>
				<div
					v-if="course.tags"
					v-for="tag in course.tags?.split(', ')"
					class="text-xs border bg-surface-white text-ink-gray-9 px-2 py-0.5 rounded-md mb-1 mr-1"
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
						? 'text-xl'
						: 'text-2xl'
				"
			>
				{{ course.title }}
			</div>
		</div>
		<div class="flex flex-col flex-auto p-4 border-x-2 border-b-2 rounded-b-md">
			<div class="flex items-center justify-between mb-2">
				<div v-if="course.lessons">
					<Tooltip :text="__('Lessons')">
						<span class="flex items-center">
							<BookOpen class="h-4 w-4 stroke-1.5 mr-1" />
							{{ course.lessons }}
						</span>
					</Tooltip>
				</div>

				<div v-if="course.enrollments">
					<Tooltip :text="__('Enrolled Students')">
						<span class="flex items-center">
							<Users class="h-4 w-4 stroke-1.5 mr-1" />
							{{ course.enrollments }}
						</span>
					</Tooltip>
				</div>

				<div v-if="course.rating">
					<Tooltip :text="__('Average Rating')">
						<span class="flex items-center">
							<Star class="h-4 w-4 stroke-1.5 mr-1" />
							{{ course.rating }}
						</span>
					</Tooltip>
				</div>

				<Tooltip v-if="course.featured" :text="__('Featured')">
					<Award class="size-4 stroke-2 text-ink-amber-3" />
				</Tooltip>
			</div>

			<div
				v-if="course.image"
				class="font-semibold leading-6"
				:class="course.title.length > 32 ? 'text-lg' : 'text-xl'"
			>
				{{ course.title }}
			</div>

			<div class="short-introduction text-sm">
				{{ course.short_introduction }}
			</div>

			<ProgressBar
				v-if="user && course.membership"
				:progress="course.membership.progress"
			/>

			<div v-if="user && course.membership" class="text-sm mt-2 mb-4">
				{{ Math.ceil(course.membership.progress) }}% {{ __('completed') }}
			</div>

			<div class="flex items-center justify-between mt-auto">
				<div class="flex avatar-group overlap">
					<div
						class="h-6 mr-1"
						:class="{ 'avatar-group overlap': course.instructors.length > 1 }"
					>
						<UserAvatar
							v-for="instructor in course.instructors"
							:user="instructor"
						/>
					</div>
					<CourseInstructors :instructors="course.instructors" />
				</div>

				<div v-if="course.paid_course" class="font-semibold">
					{{ course.price }}
				</div>

				<Tooltip
					v-if="course.paid_certificate || course.enable_certification"
					:text="__('Get Certified')"
				>
					<GraduationCap class="size-5 stroke-1.5 text-ink-gray-7" />
				</Tooltip>
			</div>
		</div>
	</div>
</template>
<script setup>
import { Award, BookOpen, GraduationCap, Star, Users } from 'lucide-vue-next'
import UserAvatar from '@/components/UserAvatar.vue'
import { sessionStore } from '@/stores/session'
import { Tooltip } from 'frappe-ui'
import { theme } from '@/utils/theme'
import CourseInstructors from '@/components/CourseInstructors.vue'
import ProgressBar from '@/components/ProgressBar.vue'

const { user } = sessionStore()

const props = defineProps({
	course: {
		type: Object,
		default: null,
	},
})

const getGradientColor = () => {
	let color = props.course.card_gradient?.toLowerCase() || 'blue'
	let colorMap = theme.backgroundColor[color]
	return `linear-gradient(to top right, black, ${colorMap[400]})`
	/* return `bg-gradient-to-br from-${color}-100 via-${color}-200 to-${color}-400` */
	/* return `linear-gradient(to bottom right, ${colorMap[100]}, ${colorMap[400]})` */
	/* return `radial-gradient(ellipse at 80% 20%, black 20%, ${colorMap[500]} 100%)` */
	/* return `radial-gradient(ellipse at 30% 70%, black 50%, ${colorMap[500]} 100%)` */
	/* return `radial-gradient(ellipse at 80% 20%, ${colorMap[100]} 0%, ${colorMap[300]} 50%, ${colorMap[500]} 100%)` */
	/* return `conic-gradient(from 180deg at 50% 50%, ${colorMap[100]} 0%, ${colorMap[200]} 50%, ${colorMap[400]} 100%)` */
	/* return `linear-gradient(135deg, ${colorMap[100]}, ${colorMap[300]}), linear-gradient(120deg, rgba(255,255,255,0.4) 0%, transparent 60%) ` */
	/* return `radial-gradient(circle at 20% 30%, ${colorMap[100]} 0%, transparent 40%),
		radial-gradient(circle at 80% 40%, ${colorMap[200]} 0%, transparent 50%),
		linear-gradient(135deg, ${colorMap[300]} 0%, ${colorMap[400]} 100%);` */
}
</script>
<style>
.course-card-pills {
	background: #ffffff;
	margin-left: 0;
	margin-right: 0.5rem;
	padding: 3.5px 8px;
	font-size: 11px;
	text-align: center;
	letter-spacing: 0.011em;
	text-transform: uppercase;
	font-weight: 600;
	width: fit-content;
}

.avatar-group {
	display: inline-flex;
	align-items: center;
}

.avatar-group .avatar {
	transition: margin 0.1s ease-in-out;
}

.avatar-group.overlap .avatar + .avatar {
	margin-left: calc(-8px);
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
