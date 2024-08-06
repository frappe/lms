<template>
	<div class="mt-20 mb-10">
		<div class="flex items-center font-semibold text-2xl mb-8">
			{{ __('Related Courses') }}
		</div>
		<div class="scroll-container">
			<router-link
				v-for="course in courses"
				:key="course.id"
				:to="courseLink(course)"
				class="course-card-link"
			>
				<div v-if="course.title" class="course-card">
					<div
						class="course-image"
						:class="{ 'default-image': !course.image }"
						:style="{
							backgroundImage: 'url(\'' + encodeURI(course.image) + '\')',
						}"
					>
						<div class="flex relative top-4 left-4 w-fit flex-wrap">
							<Badge
								v-if="course.featured"
								variant="subtle"
								theme="green"
								size="md"
								class="mr-2"
							>
								{{ __('Featured') }}
							</Badge>
							<Badge
								variant="outline"
								theme="gray"
								size="md"
								class="mr-2"
								v-for="tag in course.tags"
								:key="tag"
							>
								{{ tag }}
							</Badge>
						</div>
						<div v-if="!course.image" class="image-placeholder">
							{{ course.title[0] }}
						</div>
					</div>
					<div class="course-details">
						<div class="flex items-center justify-between mb-2">
							<div v-if="course.lesson_count">
								<Tooltip :text="__('Lessons')">
									<span class="flex items-center">
										<BookOpen class="h-4 w-4 stroke-1.5 text-gray-700 mr-1" />
										{{ course.lesson_count }}
									</span>
								</Tooltip>
							</div>
							<div v-if="course.enrollment_count">
								<Tooltip :text="__('Enrolled Students')">
									<span class="flex items-center">
										<Users class="h-4 w-4 stroke-1.5 text-gray-700 mr-1" />
										{{ course.enrollment_count }}
									</span>
								</Tooltip>
							</div>
							<div v-if="course.avg_rating">
								<Tooltip :text="__('Average Rating')">
									<span class="flex items-center">
										<Star class="h-4 w-4 stroke-1.5 text-gray-700 mr-1" />
										{{ course.avg_rating }}
									</span>
								</Tooltip>
							</div>
							<div v-if="course.status != 'Approved'">
								<Badge
									variant="solid"
									:theme="course.status === 'Under Review' ? 'orange' : 'blue'"
									size="sm"
								>
									{{ course.status }}
								</Badge>
							</div>
						</div>
						<div class="text-xl font-semibold leading-6 mt-2">
							{{ course.title }}
						</div>
						<div class="short-introduction mt-1">
							{{ course.short_introduction }}
						</div>
						<div class="flex items-center justify-between mt-4">
							<div class="flex avatar-group overlap">
								<div
									class="h-6 mr-1"
									:class="{
										'avatar-group overlap': course.instructors.length > 1,
									}"
								>
									<UserAvatar
										v-for="instructor in course.instructors"
										:key="instructor.id"
										:user="instructor"
									/>
								</div>
								<CourseInstructors :instructors="course.instructors" />
							</div>
							<div class="font-semibold">
								{{ course.price }}
							</div>
						</div>
					</div>
				</div>
			</router-link>
		</div>
	</div>
</template>

<script setup>
import { BookOpen, Users, Star } from 'lucide-vue-next'
import UserAvatar from '@/components/UserAvatar.vue'
import { Badge, Tooltip } from 'frappe-ui'
import CourseInstructors from '@/components/CourseInstructors.vue'

const props = defineProps({
	courses: {
		type: Array,
		default: null,
	},
})

const courseLink = (course) => {
	if (course.membership && course.current_lesson) {
		const [chapterNumber, lessonNumber] = course.current_lesson.split('-')
		return {
			name: 'Lesson',
			params: {
				courseName: course.name,
				chapterNumber,
				lessonNumber,
			},
		}
	} else if (course.membership) {
		return {
			name: 'Lesson',
			params: {
				courseName: course.name,
				chapterNumber: 1,
				lessonNumber: 1,
			},
		}
	} else {
		return {
			name: 'CourseDetail',
			params: {
				courseName: course.name,
			},
		}
	}
}
</script>

<style>
.scroll-container {
	display: flex;
	overflow-x: auto;
	scroll-snap-type: x mandatory;
	gap: 16px;
	padding: 5px 0;
}

.scroll-container::-webkit-scrollbar {
	height: 6px;
	background-color: #f1f1f1;
}

.scroll-container::-webkit-scrollbar-thumb {
	background-color: #888;
	border-radius: 3px;
}

.scroll-container::-webkit-scrollbar-thumb:hover {
	background-color: #555;
}

.course-card-link {
	text-decoration: none;
	flex: 0 0 300px;
}

.course-card {
	display: flex;
	flex-direction: column;
	border-radius: 8px;
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	overflow: hidden;
	background: white;
}

.course-image {
	height: 150px;
	background-size: cover;
	background-position: center;
}

.course-details {
	padding: 16px;
	display: flex;
	flex-direction: column;
	flex-grow: 1;
}

.image-placeholder {
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100%;
	font-size: 24px;
	color: #fff;
	background: #ccc;
}

@media (max-width: 600px) {
	.course-card {
		flex: 0 0 80%;
	}
}
</style>
