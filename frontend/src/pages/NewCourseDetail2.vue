<template>
	<div v-if="course.data">
		<header
			class="sticky top-0 z-10 flex items-center justify-between bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<CourseBreadcrumb :items="breadcrumbs" />
		</header>

		<div class="flex flex-col lg:flex-row gap-6 p-5">
			<!-- Left Sidebar -->
			<div class="lg:w-80 flex-shrink-0">
				<div class="bg-white rounded-lg border overflow-hidden sticky top-20">
					<!-- Course Image -->
					<div class="relative">
						<div
							class="aspect-video bg-cover bg-center"
							:class="{ 'default-image': !course.data.image }"
							:style="{
								backgroundImage:
									'url(\'' + encodeURI(course.data.image) + '\')',
							}"
						></div>
						<Badge
							v-if="course.data.enable_certification"
							theme="green"
							size="lg"
							class="absolute top-3 left-3 bg-teal-500 text-white font-medium"
						>
							{{ __('Certification') }}
						</Badge>
					</div>

					<!-- Course Info -->
					<div class="p-4 space-y-4">
						<!-- Title -->
						<h1 class="text-lg font-semibold text-ink-gray-9 leading-tight">
							{{ course.data.title }}
						</h1>

						<!-- Stats -->
						<div class="space-y-2 text-sm text-ink-gray-7">
							<div class="flex items-center">
								<BookOpen class="h-4 w-4 mr-2 stroke-1.5" />
								<span>{{ course.data.lessons }} {{ __('lessons') }}</span>
							</div>
							<div class="flex items-center">
								<Users class="h-4 w-4 mr-2 stroke-1.5" />
								<span
									>{{ formatAmount(course.data.enrollments) }}
									{{ __('Enrolled Students') }}</span
								>
							</div>
							<div
								v-if="parseInt(course.data.rating) > 0"
								class="flex items-center"
							>
								<Star class="h-4 w-4 mr-2 fill-yellow-500 text-transparent" />
								<span
									>{{ course.data.rating }}
									<span class="text-ink-gray-5"
										>({{
											course.data.ratings_count || '451.444'
										}}
										reviews)</span
									>
								</span>
							</div>
						</div>

						<!-- Instructor -->
						<div class="flex items-center space-x-3">
							<div class="flex -space-x-2">
								<UserAvatar
									v-for="instructor in course.data.instructors?.slice(0, 2)"
									:key="instructor.name"
									:user="instructor"
									class="h-8 w-8 rounded-full border-2 border-white"
								/>
							</div>
							<div class="text-sm">
								<div class="text-ink-gray-5">{{ __('Lecture') }}</div>
								<div class="font-medium text-ink-gray-9">
									<CourseInstructors :instructors="course.data.instructors" />
								</div>
							</div>
						</div>

						<!-- Progress -->
						<div v-if="course.data.membership" class="space-y-2">
							<div class="flex justify-between text-sm">
								<span class="text-ink-gray-7">{{ __('Course progress') }}</span>
								<span class="font-medium text-ink-gray-9"
									>{{ course.data.membership.progress || 0 }}%</span
								>
							</div>
							<div class="h-2 bg-gray-200 rounded-full overflow-hidden">
								<div
									class="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all duration-300"
									:style="{
										width: (course.data.membership.progress || 0) + '%',
									}"
								></div>
							</div>
						</div>

						<!-- Actions -->
						<div v-if="!readOnlyMode" class="space-y-2 pt-2">
							<div v-if="course.data.membership" class="space-y-2">
								<router-link
									:to="{
										name: 'Lesson',
										params: {
											courseName: course.data.name,
											chapterNumber: course.data.current_lesson
												? course.data.current_lesson.split('-')[0]
												: 1,
											lessonNumber: course.data.current_lesson
												? course.data.current_lesson.split('-')[1]
												: 1,
										},
									}"
								>
									<Button
										variant="solid"
										size="md"
										class="w-full !bg-teal-500 hover:!bg-teal-600"
									>
										<template #prefix>
											<BookText class="size-4 stroke-1.5" />
										</template>
										<span>{{ __('Continue Learning') }}</span>
									</Button>
								</router-link>
								<CertificationLinks
									:courseName="course.data.name"
									class="w-full"
								/>
							</div>

							<router-link
								v-else-if="course.data.paid_course"
								:to="{
									name: 'Billing',
									params: {
										type: 'course',
										name: course.data.name,
									},
								}"
							>
								<Button
									variant="solid"
									size="md"
									class="w-full !bg-teal-500 hover:!bg-teal-600"
								>
									<template #prefix>
										<CreditCard class="size-4 stroke-1.5" />
									</template>
									<span>{{ __('Buy this course') }}</span>
								</Button>
							</router-link>

							<Badge
								v-else-if="course.data.disable_self_learning"
								theme="blue"
								size="lg"
							>
								{{ __('Contact the Administrator to enroll for this course.') }}
							</Badge>

							<Button
								v-else-if="!user.data?.is_moderator && !is_instructor()"
								@click="enrollStudent()"
								variant="solid"
								class="w-full !bg-teal-500 hover:!bg-teal-600"
								size="md"
							>
								<template #prefix>
									<BookText class="size-4 stroke-1.5" />
								</template>
								<span>{{ __('Start Learning') }}</span>
							</Button>
						</div>
					</div>
				</div>
			</div>

			<!-- Right Content Area -->
			<div class="flex-1 min-w-0">
				<!-- Tabs -->
				<div class="border-b mb-6">
					<nav class="flex space-x-8">
						<button
							@click="activeTab = 'overview'"
							:class="[
								'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
								activeTab === 'overview'
									? 'border-teal-500 text-teal-600'
									: 'border-transparent text-ink-gray-5 hover:text-ink-gray-7',
							]"
						>
							{{ __('Overview') }}
						</button>
						<button
							@click="activeTab = 'review'"
							:class="[
								'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
								activeTab === 'review'
									? 'border-teal-500 text-teal-600'
									: 'border-transparent text-ink-gray-5 hover:text-ink-gray-7',
							]"
						>
							{{ __('Review') }}
						</button>
					</nav>
				</div>

				<!-- Overview Tab Content -->
				<div v-show="activeTab === 'overview'" class="space-y-8">
					<!-- About Course -->
					<section>
						<h2 class="text-xl font-semibold text-ink-gray-9 mb-4">
							{{ __('Tentang Kursus') }}
						</h2>
						<div class="text-ink-gray-7 leading-relaxed space-y-4">
							<p>{{ course.data.short_introduction }}</p>
							<div
								v-if="course.data.description"
								v-html="course.data.description"
								class="ProseMirror prose prose-sm max-w-none !whitespace-normal"
							></div>
						</div>
					</section>

					<!-- Learning Topics -->
					<section v-if="course.data.topics?.length">
						<h2 class="text-xl font-semibold text-ink-gray-9 mb-4">
							{{ __('Topik Pembelajaran') }}
						</h2>
						<ol class="list-decimal list-inside space-y-2 text-ink-gray-7">
							<li v-for="(topic, index) in course.data.topics" :key="index">
								{{ topic }}
							</li>
						</ol>
					</section>

					<!-- Learning Outcomes -->
					<section v-if="course.data.outcomes?.length">
						<h2 class="text-xl font-semibold text-ink-gray-9 mb-4">
							{{ __('Capaian Pembelajaran') }}
						</h2>
						<ol class="list-decimal list-inside space-y-3 text-ink-gray-7">
							<li
								v-for="(outcome, index) in course.data.outcomes"
								:key="index"
								class="leading-relaxed"
							>
								{{ outcome }}
							</li>
						</ol>
					</section>

					<!-- Course Outline -->
					<section>
						<div class="flex items-center justify-between mb-4">
							<h2 class="text-xl font-semibold text-ink-gray-9">
								{{ __('Course Outline') }}
							</h2>
							<div class="flex items-center space-x-4 text-sm text-ink-gray-5">
								<span class="flex items-center">
									<FolderOpen class="h-4 w-4 mr-1.5" />
									{{ moduleCount }} {{ __('Module') }}
								</span>
								<span class="flex items-center">
									<FileText class="h-4 w-4 mr-1.5" />
									{{ materialCount }} {{ __('Materials') }}
								</span>
							</div>
						</div>
						<CourseOutline2
							:courseName="course.data.name"
							:getProgress="course.data.membership ? true : false"
						/>
					</section>
				</div>

				<!-- Review Tab Content -->
				<div v-show="activeTab === 'review'" class="space-y-8">
					<!-- Course Rating Section -->
					<section>
						<h2 class="text-xl font-semibold text-ink-gray-9 mb-6">
							{{ __('Course Rating') }}
						</h2>
						<div class="flex flex-col md:flex-row gap-8">
							<!-- Overall Rating -->
							<div
								class="flex-shrink-0 border rounded-lg p-6 text-center min-w-[160px]"
							>
								<div class="text-5xl font-bold text-ink-gray-9">4.5</div>
								<div class="flex justify-center mt-2 space-x-0.5">
									<Star
										v-for="i in 4"
										:key="i"
										class="h-4 w-4 fill-yellow-400 text-yellow-400"
									/>
									<Star class="h-4 w-4 fill-yellow-400/50 text-yellow-400" />
								</div>
								<div class="text-sm text-ink-gray-5 mt-2">
									{{ __('Course Rating') }}
								</div>
								<div class="text-xs text-ink-gray-5">(451.444 reviews)</div>
							</div>

							<!-- Rating Breakdown -->
							<div class="flex-1 space-y-3">
								<div
									v-for="rating in ratingBreakdown"
									:key="rating.stars"
									class="flex items-center gap-3"
								>
									<div class="flex items-center space-x-0.5 flex-shrink-0">
										<Star
											v-for="i in rating.stars"
											:key="i"
											class="h-3.5 w-3.5 fill-yellow-400 text-yellow-400"
										/>
										<Star
											v-for="i in 5 - rating.stars"
											:key="'empty-' + i"
											class="h-3.5 w-3.5 fill-gray-200 text-gray-200"
										/>
									</div>
									<span class="text-sm text-ink-gray-7 w-20 flex-shrink-0"
										>{{ rating.stars }} Star Rating</span
									>
									<div
										class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden"
									>
										<div
											class="h-full rounded-full transition-all"
											:class="rating.color"
											:style="{ width: rating.percentage + '%' }"
										></div>
									</div>
								</div>
							</div>
						</div>
					</section>

					<!-- Students Review Section -->
					<section>
						<div class="flex items-center justify-between mb-6">
							<h2 class="text-xl font-semibold text-ink-gray-9">
								{{ __('Students Review') }}
							</h2>
							<select
								class="border rounded-lg px-3 py-2 text-sm text-ink-gray-7 bg-white"
							>
								<option>5 Star Rating</option>
								<option>4 Star Rating</option>
								<option>3 Star Rating</option>
								<option>2 Star Rating</option>
								<option>1 Star Rating</option>
								<option>All Ratings</option>
							</select>
						</div>

						<div class="space-y-6">
							<div
								v-for="review in dummyReviews"
								:key="review.id"
								class="pb-6 border-b last:border-b-0"
							>
								<div class="flex items-start gap-4">
									<img
										:src="review.avatar"
										:alt="review.name"
										class="w-10 h-10 rounded-full object-cover flex-shrink-0"
									/>
									<div class="flex-1">
										<div class="flex items-center gap-2 mb-1">
											<span class="font-medium text-ink-gray-9">{{
												review.name
											}}</span>
											<span class="text-ink-gray-5">•</span>
											<span class="text-sm text-ink-gray-5">{{
												review.time
											}}</span>
										</div>
										<div class="flex space-x-0.5 mb-2">
											<Star
												v-for="i in 5"
												:key="i"
												class="h-3.5 w-3.5 fill-yellow-400 text-yellow-400"
											/>
										</div>
										<p class="text-sm text-ink-gray-7 leading-relaxed">
											{{ review.comment }}
										</p>
									</div>
								</div>
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import {
	createResource,
	Badge,
	Button,
	call,
	toast,
	usePageMeta,
} from 'frappe-ui'
import { computed, inject, ref, watch } from 'vue'
import {
	BookOpen,
	BookText,
	CreditCard,
	FileText,
	FolderOpen,
	Star,
	Users,
} from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import { useRouter } from 'vue-router'
import { formatAmount } from '@/utils/'
import { capture } from '@/telemetry'
import CourseOutline2 from '@/components/CourseOutline2.vue'
import CourseReviews from '@/components/CourseReviews.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import CourseInstructors from '@/components/CourseInstructors.vue'
import CertificationLinks from '@/components/CertificationLinks.vue'
import CourseBreadcrumb from '@/components/CourseBreadcrumb.vue'

const { brand } = sessionStore()
const router = useRouter()
const user = inject('$user')
const readOnlyMode = window.read_only_mode
const activeTab = ref('overview')

// Dummy data for reviews tab
const ratingBreakdown = ref([
	{ stars: 5, percentage: 85, color: 'bg-orange-400' },
	{ stars: 4, percentage: 55, color: 'bg-orange-400' },
	{ stars: 3, percentage: 25, color: 'bg-orange-400' },
	{ stars: 2, percentage: 10, color: 'bg-orange-400' },
	{ stars: 1, percentage: 5, color: 'bg-orange-400' },
])

const dummyReviews = ref([
	{
		id: 1,
		name: 'Guy Hawkins',
		avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
		time: '1 week ago',
		rating: 5,
		comment:
			'Materinya sangat jelas dan terstruktur. Penjelasan tentang konsep keberlanjutan membuat saya lebih memahami bagaimana perusahaan seharusnya melaporkan dampaknya. Course ini benar-benar membuka wawasan.',
	},
	{
		id: 2,
		name: 'Dianne Russell',
		avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
		time: '51 mins ago',
		rating: 5,
		comment:
			'Materinya sangat jelas dan terstruktur. Penjelasan tentang konsep keberlanjutan membuat saya lebih memahami bagaimana perusahaan seharusnya melaporkan dampaknya. Course ini benar-benar membuka wawasan.',
	},
	{
		id: 3,
		name: 'Bessie Cooper',
		avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
		time: '6 hours ago',
		rating: 5,
		comment:
			'Materinya sangat jelas dan terstruktur. Penjelasan tentang konsep keberlanjutan membuat saya lebih memahami bagaimana perusahaan seharusnya melaporkan dampaknya. Course ini benar-benar membuka wawasan.',
	},
	{
		id: 4,
		name: 'Eleanor Pena',
		avatar: 'https://randomuser.me/api/portraits/women/65.jpg',
		time: '1 days ago',
		rating: 5,
		comment:
			'Materinya sangat jelas dan terstruktur. Penjelasan tentang konsep keberlanjutan membuat saya lebih memahami bagaimana perusahaan seharusnya melaporkan dampaknya. Course ini benar-benar membuka wawasan.',
	},
	{
		id: 5,
		name: 'Ralph Edwards',
		avatar: 'https://randomuser.me/api/portraits/men/46.jpg',
		time: '2 days ago',
		rating: 5,
		comment:
			'GREAT Course! Instructor was very descriptive and professional. I learned a TON that is going to apply immediately to real life work. Thanks so much, cant wait for the next one!',
	},
	{
		id: 6,
		name: 'Arlene McCoy',
		avatar: 'https://randomuser.me/api/portraits/women/90.jpg',
		time: '1 week ago',
		rating: 5,
		comment:
			'Materinya sangat jelas dan terstruktur. Penjelasan tentang konsep keberlanjutan membuat saya lebih memahami bagaimana perusahaan seharusnya melaporkan dampaknya. Course ini benar-benar membuka wawasan.',
	},
])

const props = defineProps({
	courseName: {
		type: String,
		required: true,
	},
})

const course = createResource({
	url: 'lms.lms.utils.get_course_details',
	cache: ['course', props.courseName],
	makeParams() {
		return {
			course: props.courseName,
		}
	},
	auto: true,
})

watch(
	() => props.courseName,
	() => {
		course.reload()
	},
)

watch(course, () => {
	if (
		!isInstructor() &&
		!user.data?.is_moderator &&
		!course.data?.published &&
		!course.data?.upcoming
	) {
		router.push({
			name: 'Courses',
		})
	}
})

const isInstructor = () => {
	let user_is_instructor = false
	course.data?.instructors?.forEach((instructor) => {
		if (!user_is_instructor && instructor.name == user.data?.name) {
			user_is_instructor = true
		}
	})
	return user_is_instructor
}

const is_instructor = isInstructor

function enrollStudent() {
	if (!user.data) {
		toast.success(__('You need to login first to enroll for this course'))
		setTimeout(() => {
			window.location.href = `/login?redirect-to=${window.location.pathname}`
		}, 500)
	} else {
		call('lms.lms.doctype.lms_enrollment.lms_enrollment.create_membership', {
			course: course.data.name,
		})
			.then(() => {
				capture('enrolled_in_course', {
					course: course.data.name,
				})
				toast.success(__('You have been enrolled in this course'))
				setTimeout(() => {
					router.push({
						name: 'Lesson',
						params: {
							courseName: course.data.name,
							chapterNumber: 1,
							lessonNumber: 1,
						},
					})
				}, 1000)
			})
			.catch((err) => {
				toast.warning(__(err.messages?.[0] || err))
				console.error(err)
			})
	}
}

const moduleCount = computed(() => {
	return course.data?.chapters?.length || 4
})

const materialCount = computed(() => {
	let count = 0
	course.data?.chapters?.forEach((chapter) => {
		count += chapter.lessons?.length || 0
	})
	return count || 16
})

const breadcrumbs = computed(() => {
	let items = [{ label: 'Course', route: { name: 'Courses' } }]
	items.push({
		label: course?.data?.title,
		route: { name: 'CourseDetail', params: { courseName: course?.data?.name } },
	})
	return items
})

usePageMeta(() => {
	return {
		title: course?.data?.title,
		icon: brand.favicon,
	}
})
</script>

<style scoped>
.default-image {
	background: linear-gradient(
		135deg,
		rgb(var(--primary-400)) 0%,
		rgb(var(--secondary-500)) 100%
	);
}
</style>
