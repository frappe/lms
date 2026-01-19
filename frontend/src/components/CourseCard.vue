<template>
	<div v-if="course.title" class="flex flex-col h-full rounded-xl overflow-auto text-ink-gray-9"
		style="min-height: 300px">
		<div class="w-[100%] h-[140px] bg-cover bg-center bg-no-repeat border-t border-x rounded-t-xl relative" :style="course.image
			? { backgroundImage: `url('${encodeURI(course.image)}')` }
			: {
				backgroundImage: getGradientColor(),
				backgroundBlendMode: 'screen',
			}">
			<Tooltip v-if="course.paid_certificate || course.enable_certification" :text="__('Get Certified')">
				<div
					class="table w-auto bg-primary-100 text-primary-500 text-xs rounded px-2 py-1 absolute top-3 left-3">
					Certification
				</div>
			</Tooltip>
			<div v-if="!course.image"
				class="flex items-center justify-center flex-1 font-extrabold my-auto px-5 text-center leading-6 h-full text-lg text-gray-900"
				:style="{ color: colorMap[900] }">
				{{ course.title }}
			</div>
		</div>
		<div class="flex flex-col flex-auto p-4 border-x-2 border-b-2 rounded-b-xl">

			<div v-if="course.image" class="font-semibold leading-6 text-lg text-gray-900">
				{{ course.title }}
			</div>

			<div class="flex flex-col items-start mb-4">
				<div v-if="course.lessons != undefined">
					<Tooltip :text="__('Lessons')">
						<div class="flex items-center space-x-1">
							<BookIcon class="h-4 w-4 stroke-1.5" />
							<span class="text-md font-medium">{{ course.lessons }}</span>
							<span class="text-sm text-gray-600">lessons</span>
						</div>
					</Tooltip>
				</div>

				<div v-if="course.enrollments != undefined">
					<Tooltip :text="__('Enrolled Students')">
						<div class="flex items-center space-x-1">
							<PeopleIcon class="h-4 w-4 stroke-1.5" />
							<span class="text-md font-medium">{{ formatAmount(course.enrollments) }}</span>
							<span class="text-sm text-gray-600">Enrolled Students</span>
						</div>
					</Tooltip>
				</div>

				<div v-if="course.rating != undefined">
					<Tooltip :text="__('Average Rating')">
						<div class="flex items-center space-x-1">
							<StarIcon class="h-4 w-4 stroke-1.5" />
							<span class="text-md font-medium">{{ course.rating }}</span>
							<span class="text-sm text-gray-600">({{ course.review_total }} reviews)</span>
						</div>
					</Tooltip>
				</div>

				<Tooltip v-if="course.featured" :text="__('Featured')">
					<Award class="size-4 stroke-2 text-ink-amber-3" />
				</Tooltip>
			</div>

			<!-- <div class="short-introduction text-sm">
				{{ course.short_introduction }}
			</div> -->

			<div class="flex items-center justify-between mb-4">
				<div class="flex avatar-group overlap">
					<div class="h-6 mr-1" :class="{ 'avatar-group overlap': course.instructors.length > 1 }">
						<UserAvatar v-for="instructor in course.instructors" :user="instructor" size="xl" />
					</div>
					<CourseInstructors :instructors="course.instructors" />
				</div>
			</div>

			<!-- <div class="flex items-center space-x-2">
				<div v-if="course.paid_course" class="font-semibold">
						{{ course.price }}
					</div>
			</div> -->

			<div class="mb-4" v-if="user && course.membership">
				<div class="flex items-center justify-between text-sm mb-1">
					<span class="text-md text-gray-600">Course progress</span>
					<span class="text-md text-gray-600">{{ Math.ceil(course.membership.progress) }}%</span>
				</div>

				<ProgressBar :progress="course.membership.progress" />
			</div>

			<button
				class="border border-primary-500 text-primary-500 hover:bg-primary-500 hover:text-white px-4 py-3 rounded-md font-semibold text-sm"
				v-if="user && !course.enrollments">
				Enroll Course
			</button>
			<button
				class="border border-primary-500 text-primary-500 hover:bg-primary-500 hover:text-white px-4 py-3 rounded-md font-semibold text-sm"
				v-else-if="user && course.enrollments">
				Continue Learning
			</button>
			<button
				class="border border-primary-500 text-primary-500 hover:bg-primary-500 hover:text-white px-4 py-3 rounded-md font-semibold text-sm"
				v-else>
				View Course
			</button>

		</div>
	</div>
</template>
<script setup>
import { Award, } from 'lucide-vue-next'
import BookIcon from '@/components/Icons/BookIcon.vue'
import PeopleIcon from '@/components/Icons/PeopleIcon.vue'
import StarIcon from '@/components/Icons/StarIcon.vue'
import { sessionStore } from '@/stores/session'
import { Tooltip } from 'frappe-ui'
import { theme } from '@/utils/theme'
import { formatAmount } from '@/utils'
import CourseInstructors from '@/components/CourseInstructors.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import { computed } from 'vue'

const { user } = sessionStore()

const props = defineProps({
	course: {
		type: Object,
		default: null,
	},
})

const colorMap = computed(() => {
	let color = props.course.card_gradient?.toLowerCase() || 'blue'
	let colorMap = theme.backgroundColor[color]
	return colorMap
})

const getGradientColor = () => {
	return `linear-gradient(to top right, ${colorMap.value[100]}, ${colorMap.value[400]})`
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

.avatar-group.overlap .avatar+.avatar {
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
