<template>
	<div v-if="lesson.data && course.data" class="h-screen text-base">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs class="h-7" :items="breadcrumbs" />
		</header>
		<div class="grid grid-cols-[70%,30%] h-full">
			<div v-if="lesson.data.no_preview" class="border-r-2 text-center pt-10">
				<p class="mb-4">
					{{
						__(
							'This lesson is not available for preview. Please enroll in the course to access it.'
						)
					}}
				</p>
				<router-link
					:to="{ name: 'CourseDetail', params: { courseName: courseName } }"
				>
					<Button variant="solid">
						{{ __('Start Learning') }}
					</Button>
				</router-link>
			</div>
			<div v-else class="border-r-2 container pt-5 pb-10">
				<div class="flex items-center justify-between">
					<div class="text-3xl font-semibold">
						{{ lesson.data.title }}
					</div>
					<div>
						<router-link
							v-if="lesson.data.prev"
							:to="{
								name: 'Lesson',
								params: {
									courseName: courseName,
									chapterNumber: lesson.data.prev.split('.')[0],
									lessonNumber: lesson.data.prev.split('.')[1],
								},
							}"
						>
							<Button class="mr-2">
								<ChevronLeft class="w-4 h-4 stroke-1" />
							</Button>
						</router-link>
						<router-link
							v-if="lesson.data.next"
							:to="{
								name: 'Lesson',
								params: {
									courseName: courseName,
									chapterNumber: lesson.data.next.split('.')[0],
									lessonNumber: lesson.data.next.split('.')[1],
								},
							}"
						>
							<Button>
								<ChevronRight class="w-4 h-4 stroke-1" />
							</Button>
						</router-link>
					</div>
				</div>

				<div class="flex items-center mt-2">
					<span
						class="mr-1"
						:class="{
							'avatar-group overlap': course.data.instructors.length > 1,
						}"
					>
						<UserAvatar
							v-for="instructor in course.data.instructors"
							:user="instructor"
						/>
					</span>
					<span v-if="course.data.instructors.length == 1">
						{{ course.data.instructors[0].full_name }}
					</span>
					<span v-if="course.data.instructors.length == 2">
						{{ course.data.instructors[0].first_name }} and
						{{ course.data.instructors[1].first_name }}
					</span>
					<span v-if="course.data.instructors.length > 2">
						{{ course.data.instructors[0].first_name }} and
						{{ course.data.instructors.length - 1 }} others
					</span>
				</div>
				<div class="lesson-content mt-6">
					<div v-if="lesson.data.youtube">
						<iframe
							class="youtube-video"
							:src="getYouTubeVideoSource(lesson.data.youtube)"
							width="100%"
							height="400"
							frameborder="0"
							allowfullscreen
						></iframe>
					</div>
					<div v-for="block in lesson.data.body.split('\n\n')">
						<div v-if="block.includes('{{ YouTubeVideo')">
							<iframe
								class="youtube-video"
								:src="getYouTubeVideoSource(block)"
								width="100%"
								height="400"
								frameborder="0"
								allowfullscreen
							></iframe>
						</div>
						<div v-else-if="block.includes('{{ Quiz')">
							<Quiz v-if="user.data" :quizName="getId(block)"></Quiz>
							<div v-else class="border rounded-md text-center py-20">
								<div>
									{{ __('Please login to access the quiz.') }}
								</div>
								<Button @click="redirectToLogin()" class="mt-2">
									<span>
										{{ __('Login') }}
									</span>
								</Button>
							</div>
						</div>
						<div v-else-if="block.includes('{{ Video')">
							<video controls width="100%" controlsList="nodownload">
								<source :src="getId(block)" type="video/mp4" />
							</video>
						</div>
						<div v-else-if="block.includes('{{ PDF')">
							<iframe
								:src="getPDFSource(block)"
								width="100%"
								height="400"
								frameborder="0"
								allowfullscreen
							></iframe>
						</div>
						<div v-else-if="block.includes('{{ Audio')">
							<audio width="100%" controls controlsList="nodownload">
								<source :src="getId(block)" type="audio/mp3" />
							</audio>
						</div>
						<div v-else-if="block.includes('{{ Embed')">
							<iframe
								width="100%"
								height="400"
								:src="getId(block)"
								frameborder="0"
								allowfullscreen
							>
							</iframe>
						</div>
						<div v-else v-html="markdown.render(block)"></div>
					</div>
					<div v-if="lesson.data.quiz_id">
						<Quiz v-if="user.data" :quizName="getId(block)"></Quiz>
						<div v-else class="border rounded-md text-center py-20">
							<div>
								{{ __('Please login to access the quiz.') }}
							</div>
							<Button @click="redirectToLogin()" class="mt-2">
								<span>
									{{ __('Login') }}
								</span>
							</Button>
						</div>
					</div>
				</div>
				<div class="mt-20">
					<Discussions
						v-if="allowDiscussions()"
						:title="'Questions'"
						:doctype="'Course Lesson'"
						:docname="lesson.data.name"
						:key="lesson.data.name"
					/>
				</div>
			</div>
			<div class="sticky top-10">
				<div class="bg-gray-50 p-5 border-b-2">
					<div class="text-lg font-semibold">
						{{ course.data.title }}
					</div>
					<div v-if="user && course.data.membership" class="text-sm mt-3">
						{{ Math.ceil(course.data.membership.progress) }}% completed
					</div>
					<div
						v-if="user && course.data.membership"
						class="w-full bg-gray-200 rounded-full h-1 my-2"
					>
						<div
							class="bg-gray-900 h-1 rounded-full"
							:style="{
								width: Math.ceil(course.data.membership.progress) + '%',
							}"
						></div>
					</div>
				</div>
				<CourseOutline :courseName="courseName" :key="chapterNumber" />
			</div>
		</div>
	</div>
</template>
<script setup>
import { createResource, Breadcrumbs, Button } from 'frappe-ui'
import { computed, watch, onBeforeMount, onUnmounted, inject } from 'vue'
import CourseOutline from '@/components/CourseOutline.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useRoute } from 'vue-router'
import MarkdownIt from 'markdown-it'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import Quiz from '@/components/Quiz.vue'
import Discussions from '@/components/Discussions.vue'

const user = inject('$user')
const route = useRoute()
const markdown = new MarkdownIt({
	html: true,
	linkify: true,
})

const props = defineProps({
	courseName: {
		type: String,
		required: true,
	},
	chapterNumber: {
		type: String,
		required: true,
	},
	lessonNumber: {
		type: String,
		required: true,
	},
})

const lesson = createResource({
	url: 'lms.lms.utils.get_lesson',
	cache: ['lesson', props.courseName, props.chapterNumber, props.lessonNumber],
	makeParams(values) {
		return {
			course: props.courseName,
			chapter: values ? values.chapter : props.chapterNumber,
			lesson: values ? values.lesson : props.lessonNumber,
		}
	},
	auto: true,
	onSuccess(data) {
		if (data.membership) {
			current_lesson.submit({
				name: data.membership.name,
				lesson_name: data.name,
			})
		}
	},
})

const current_lesson = createResource({
	url: 'frappe.client.set_value',
	makeParams(values) {
		return {
			doctype: 'LMS Enrollment',
			name: values.name,
			fieldname: 'current_lesson',
			value: values.lesson_name,
		}
	},
})

const course = createResource({
	url: 'lms.lms.utils.get_course_details',
	cache: ['course', props.courseName],
	params: {
		course: props.courseName,
	},
	auto: true,
})

const breadcrumbs = computed(() => {
	let items = [{ label: 'All Courses', route: { name: 'Courses' } }]
	items.push({
		label: course?.data?.title,
		route: { name: 'CourseDetail', params: { course: props.courseName } },
	})
	items.push({
		label: lesson?.data?.title,
		route: {
			name: 'Lesson',
			params: {
				course: props.courseName,
				chapterNumber: props.chapterNumber,
				lessonNumber: props.lessonNumber,
			},
		},
	})
	return items
})

onBeforeMount(() => {
	localStorage.setItem('sidebar_is_collapsed', true)
})

onUnmounted(() => {
	localStorage.setItem('sidebar_is_collapsed', false)
})

watch(
	[() => route.params.chapterNumber, () => route.params.lessonNumber],
	(
		[newChapterNumber, newLessonNumber],
		[oldChapterNumber, oldLessonNumber]
	) => {
		if (newChapterNumber && newLessonNumber) {
			lesson.submit({
				chapter: newChapterNumber,
				lesson: newLessonNumber,
			})
		}
	}
)

const getYouTubeVideoSource = (block) => {
	if (block.includes('{{')) {
		block = getId(block)
	}
	return `https://www.youtube.com/embed/${block}`
}

const getPDFSource = (block) => {
	return `${getId(block)}#toolbar=0`
}

const getId = (block) => {
	return block.match(/\(["']([^"']+?)["']\)/)[1]
}

const redirectToLogin = () => {
	window.location.href = `/login?redirect_to=/courses/${props.courseName}/learn/${route.params.chapterNumber}-${route.params.lessonNumber}`
}

const allowDiscussions = () => {
	return (
		course.data?.membership ||
		user.data?.is_moderator ||
		user.data?.is_instructor
	)
}

const hideLesson = () => {
	return false
}
</script>
<style>
.avatar-group {
	display: inline-flex;
	align-items: center;
}

.avatar-group .avatar {
	transition: margin 0.1s ease-in-out;
}

iframe {
	border: 1px solid #ddd;
	border-radius: 0.5rem;
	margin-bottom: 1rem;
}

.lesson-content p {
	margin-bottom: 1rem;
	line-height: 1.7;
}

.lesson-content li {
	line-height: 1.7;
}

.lesson-content ol {
	list-style: auto;
	margin: revert;
	padding: 1rem;
}

.lesson-content ul {
	list-style: auto;
	padding: 1rem;
	margin: revert;
}

.lesson-content img {
	border: 1px solid theme('colors.gray.200');
	border-radius: 0.5rem;
}

.lesson-content code {
	display: block;
	overflow-x: auto;
	padding: 1rem 1.25rem;
	background: #011627;
	color: #d6deeb;
	border-radius: 0.5rem;
	margin: 1rem 0;
}

.lesson-content a {
	color: theme('colors.gray.900');
	text-decoration: underline;
	font-weight: 500;
}
</style>
