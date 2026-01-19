<template>
	<div class="min-h-screen bg-gray-50">
		<!-- Header Breadcrumb -->
		<header class="bg-surface-white px-5 pt-4 pb-2">
			<CourseBreadcrumb :items="breadcrumbs" />
		</header>

		<div class="px-5 py-4">
			<!-- Batch Header Card -->
			<div class="bg-white rounded-lg border p-5 mb-6">
				<div class="flex items-start justify-between">
					<div>
						<h1 class="text-xl font-semibold text-ink-gray-9 mb-1">
							{{ batch.title }}
						</h1>
						<p class="text-sm text-ink-gray-5 mb-3">
							{{ batch.description }}
						</p>
						<div class="space-y-1.5 text-sm text-ink-gray-5">
							<div class="flex items-center">
								<Calendar class="h-4 w-4 mr-2" />
								<span>{{ batch.dateRange }} • {{ batch.mode }}</span>
							</div>
							<div class="flex items-center">
								<Clock class="h-4 w-4 mr-2" />
								<span>{{ batch.timeRange }}</span>
							</div>
						</div>
					</div>

					<!-- Give Feedback Button -->
					<Button
						variant="outline"
						class="!border-teal-500 !text-teal-500 hover:!bg-teal-50"
					>
						{{ __('Give Feedback') }}
					</Button>
				</div>
			</div>

			<!-- Tabs -->
			<div class="border-b mb-6 bg-white -mx-5 px-5">
				<nav class="flex space-x-8">
					<button
						v-for="tab in tabs"
						:key="tab.value"
						@click="activeTab = tab.value"
						:class="[
							'py-3 border-b-2 font-medium text-sm transition-colors',
							activeTab === tab.value
								? 'border-teal-500 text-ink-gray-9'
								: 'border-transparent text-ink-gray-5 hover:text-ink-gray-7',
						]"
					>
						{{ tab.label }}
					</button>
				</nav>
			</div>

			<!-- Dashboard Tab Content -->
			<div v-show="activeTab === 'dashboard'" class="space-y-10">
				<!-- Upcoming Evaluations -->
				<section>
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-lg font-semibold text-ink-gray-9">
							{{ __('Upcoming Evaluations') }}
						</h2>
						<Button variant="solid" class="!bg-teal-500 hover:!bg-teal-600">
							{{ __('Schedule Evaluation') }}
						</Button>
					</div>

					<div class="space-y-3">
						<div
							v-for="(evaluation, index) in upcomingEvaluations"
							:key="index"
							class="bg-white border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
						>
							<div>
								<h3 class="font-medium text-ink-gray-9 mb-1">
									{{ evaluation.title }}
								</h3>
								<div class="flex items-center text-sm text-ink-gray-5">
									<Calendar class="h-4 w-4 mr-2" />
									<span>{{ evaluation.date }}</span>
								</div>
							</div>
							<ChevronRight class="h-5 w-5 text-ink-gray-4" />
						</div>
					</div>
				</section>

				<!-- Assessments -->
				<section>
					<h2 class="text-lg font-semibold text-ink-gray-9 mb-4">
						{{ __('Assessments') }}
					</h2>
					<div class="space-y-3">
						<div
							v-for="(quiz, index) in assessments"
							:key="index"
							class="bg-white border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
						>
							<div>
								<h3 class="font-medium text-ink-gray-9 mb-1">
									{{ quiz.title }}
								</h3>
								<div class="flex items-center text-sm text-ink-gray-5">
									<span>Quiz</span>
									<span class="mx-2">•</span>
									<span
										class="px-2 py-0.5 rounded text-xs font-medium"
										:class="{
											'bg-red-50 text-red-600': quiz.status === 'Not Attempted',
											'bg-orange-50 text-orange-600':
												quiz.status === 'In Progress',
											'bg-green-50 text-green-600': quiz.status === 'Completed',
										}"
									>
										{{ quiz.status }}
									</span>
								</div>
							</div>
							<ChevronRight class="h-5 w-5 text-ink-gray-4" />
						</div>
					</div>
				</section>
			</div>

			<!-- Courses Tab Content -->
			<div v-show="activeTab === 'courses'" class="space-y-6">
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					<div
						v-for="course in courses"
						:key="course.id"
						class="bg-white rounded-lg border overflow-hidden"
					>
						<div class="relative">
							<img
								:src="course.image"
								:alt="course.title"
								class="w-full h-40 object-cover"
							/>
							<span
								v-if="course.hasCertification"
								class="absolute top-3 left-3 bg-teal-500 text-white text-xs font-medium px-2.5 py-1 rounded"
							>
								Certification
							</span>
						</div>
						<div class="p-4">
							<h3 class="font-semibold text-ink-gray-9 mb-2 line-clamp-2">
								{{ course.title }}
							</h3>
							<div class="text-sm text-ink-gray-5 mb-3">
								<span>{{ course.lessons }} lessons</span>
							</div>
							<div class="mb-3">
								<div class="flex justify-between text-sm mb-1">
									<span class="text-ink-gray-5">Progress</span>
									<span class="font-medium text-ink-gray-9"
										>{{ course.progress }}%</span
									>
								</div>
								<div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
									<div
										class="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full"
										:style="{ width: course.progress + '%' }"
									></div>
								</div>
							</div>
							<Button
								variant="outline"
								class="w-full !border-teal-500 !text-teal-500 hover:!bg-teal-50"
							>
								{{ __('Continue') }}
							</Button>
						</div>
					</div>
				</div>
			</div>

			<!-- Classes Tab Content -->
			<div v-show="activeTab === 'classes'" class="space-y-6">
				<h2 class="text-lg font-semibold text-ink-gray-9">
					{{ __('Live Class') }}
				</h2>
				<div class="space-y-4">
					<div
						v-for="(cls, index) in classes"
						:key="index"
						class="bg-white border rounded-lg p-5"
					>
						<div
							class="flex flex-col md:flex-row md:items-center justify-between gap-4"
						>
							<div class="flex-1">
								<div class="flex items-center mb-2">
									<h3 class="font-semibold text-ink-gray-9 mr-3">
										{{ cls.title }}
									</h3>
									<span
										v-if="cls.isLive"
										class="px-2 py-0.5 rounded bg-red-50 text-red-600 text-xs font-bold uppercase flex items-center"
									>
										<span
											class="w-1.5 h-1.5 rounded-full bg-red-600 mr-1"
										></span>
										LIVE
									</span>
								</div>
								<div class="space-y-1.5 text-sm text-ink-gray-5">
									<div class="flex items-center">
										<Calendar class="h-4 w-4 mr-2" />
										<span>{{ cls.date }} • {{ cls.type }}</span>
									</div>
									<div class="flex items-center">
										<Clock class="h-4 w-4 mr-2" />
										<span>{{ cls.time }}</span>
									</div>
									<div class="flex items-center text-teal-600">
										<Link class="h-4 w-4 mr-2" />
										<a
											:href="cls.link"
											target="_blank"
											class="hover:underline flex items-center"
										>
											{{ cls.link }}
											<Copy class="h-3 w-3 ml-2 text-ink-gray-4" />
										</a>
									</div>
								</div>
							</div>
							<div>
								<Button
									:variant="cls.isLive ? 'solid' : 'outline'"
									:disabled="!cls.isLive"
									:class="cls.isLive ? '!bg-teal-500 hover:!bg-teal-600' : ''"
								>
									{{ __('Join Live Class') }}
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Announcement Tab Content -->
			<div v-show="activeTab === 'announcement'" class="space-y-6">
				<div class="flex items-center justify-between mb-2">
					<h2 class="text-lg font-semibold text-ink-gray-9">
						{{ __('Announcement') }}
					</h2>
					<button class="text-teal-600 text-sm font-medium hover:underline">
						{{ __('Mark all as Read') }}
					</button>
				</div>
				<div class="space-y-4">
					<div
						v-for="(announcement, index) in announcements"
						:key="index"
						class="bg-gray-50 border rounded-lg p-5"
					>
						<div class="flex items-start">
							<div class="bg-teal-500 rounded-full p-2 mr-4 flex-shrink-0">
								<img
									src="https://api.iconify.design/lucide:user.svg?color=white"
									class="w-5 h-5"
								/>
							</div>
							<div>
								<h3 class="font-semibold text-ink-gray-9 mb-2">
									{{ announcement.title }}
								</h3>
								<p class="text-sm text-ink-gray-7 leading-relaxed mb-3">
									{{ announcement.content }}
								</p>
								<div class="text-xs text-ink-gray-5">
									{{ announcement.time }}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Discussion Tab Content -->
			<div v-show="activeTab === 'discussion'" class="space-y-6">
				<h2 class="text-lg font-semibold text-ink-gray-9">
					{{ __('Discussion') }}
				</h2>

				<!-- Discussion Thread -->
				<div class="space-y-6 mb-20">
					<div
						v-for="comment in discussions"
						:key="comment.id"
						class="flex gap-4"
					>
						<img
							:src="comment.user.avatar"
							:alt="comment.user.name"
							class="w-10 h-10 rounded-full object-cover"
						/>
						<div class="flex-1">
							<div class="flex items-center mb-1">
								<span class="font-semibold text-ink-gray-9 mr-2">{{
									comment.user.name
								}}</span>
								<span
									v-if="comment.user.role"
									class="px-1.5 py-0.5 bg-teal-50 text-teal-600 text-xs rounded mr-2"
									>{{ comment.user.role }}</span
								>
								<span class="text-xs text-ink-gray-5">{{ comment.time }}</span>
							</div>
							<p class="text-sm text-ink-gray-7 mb-2">{{ comment.text }}</p>
							<button
								class="flex items-center text-xs text-ink-gray-5 hover:text-teal-600 font-medium"
							>
								<MessageSquare class="h-3 w-3 mr-1" />
								REPLY
							</button>

							<!-- Replies -->
							<div
								v-if="comment.replies && comment.replies.length"
								class="mt-4 space-y-4 pl-4 border-l-2"
							>
								<div
									v-for="reply in comment.replies"
									:key="reply.id"
									class="flex gap-4"
								>
									<img
										:src="reply.user.avatar"
										:alt="reply.user.name"
										class="w-8 h-8 rounded-full object-cover"
									/>
									<div class="flex-1">
										<div class="flex items-center mb-1">
											<span class="font-medium text-ink-gray-9 mr-2">{{
												reply.user.name
											}}</span>
											<span
												v-if="reply.user.role"
												class="px-1.5 py-0.5 bg-teal-50 text-teal-600 text-xs rounded mr-2"
												>{{ reply.user.role }}</span
											>
											<span class="text-xs text-ink-gray-5">{{
												reply.time
											}}</span>
										</div>
										<p class="text-sm text-ink-gray-7 mb-2">{{ reply.text }}</p>
										<button
											class="flex items-center text-xs text-ink-gray-5 hover:text-teal-600 font-medium"
										>
											<MessageSquare class="h-3 w-3 mr-1" />
											REPLY
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Post Thread Input -->
				<div class="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
					<div class="max-w-7xl mx-auto flex gap-3">
						<div class="relative flex-1">
							<MessageSquare
								class="absolute left-3 top-3 h-5 w-5 text-ink-gray-4"
							/>
							<input
								type="text"
								placeholder="Write a Thread"
								class="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
							/>
						</div>
						<Button
							variant="solid"
							class="!bg-teal-500 hover:!bg-teal-600 px-6"
						>
							{{ __('Post Thread') }}
						</Button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref } from 'vue'
import { Button } from 'frappe-ui'
import {
	Calendar,
	Clock,
	SearchX,
	ChevronRight,
	Link,
	Copy,
	MessageSquare,
} from 'lucide-vue-next'
import CourseBreadcrumb from '@/components/CourseBreadcrumb.vue'

const activeTab = ref('dashboard')

// Tabs
const tabs = ref([
	{ label: 'Dashboard', value: 'dashboard' },
	{ label: 'Courses', value: 'courses' },
	{ label: 'Classes', value: 'classes' },
	{ label: 'Announcement', value: 'announcement' },
	{ label: 'Discussion', value: 'discussion' },
])

// Dummy batch data
const batch = ref({
	title: 'Intensive Learning Intermediate (Batch 1)',
	description: 'This batch for intermediate level',
	dateRange: '01 Oct 2025 - 25 Dec 2025',
	mode: 'Online',
	timeRange: '12:00 AM - 10:00 PM',
})

// Dummy upcoming evaluations
const upcomingEvaluations = ref([
	{
		title: 'K1-2. Pengenalan Kebijakan Pelaporan Keberlanjutan',
		date: '12 Dec 2025',
	},
	{
		title: 'K1-2. Pengenalan Kebijakan Pelaporan Keberlanjutan',
		date: '12 Dec 2025',
	},
])

// Dummy assessments
const assessments = ref([
	{ title: 'Quiz 1', status: 'Not Attempted' },
	{ title: 'Quiz 2', status: 'In Progress' },
	{ title: 'Quiz 3', status: 'Completed' },
])

// Dummy classes
const classes = ref([
	{
		title: 'K1-2. Pengenalan Kebijakan Pelaporan Keberlanjutan',
		date: '01 Oct 2025',
		type: 'Online',
		time: '12:00 AM - 10:00 PM',
		link: 'https://https://meet.google.com/dummy-link-cesgs',
		isLive: true,
	},
	{
		title: 'K1-2. Pengenalan Kebijakan Pelaporan Keberlanjutan',
		date: '01 Oct 2025',
		type: 'Online',
		time: '12:00 AM - 10:00 PM',
		link: 'https://https://meet.google.com/dummy-link-cesgs',
		isLive: false,
	},
])

// Dummy announcements
const announcements = ref([
	{
		title: 'Important Platform Update',
		content:
			"We've introduced several improvements to enhance your overall learning experience. These updates focus on performance, usability, and content accessibility. We encourage you to explore the platform and take advantage of the latest enhancements to support your learning journey.",
		time: 'Just now',
	},
	{
		title: 'New Course Materials Available',
		content:
			"We've added new materials to support your learning journey. These updates include additional lessons, improved explanations, and supporting resources designed to help you better understand the topic. Please review the newly available modules to stay aligned with your learning plan and ensure you don't miss any important content.",
		time: '5 mins ago',
	},
])

// Dummy discussions
const discussions = ref([
	{
		id: 1,
		user: {
			name: 'Ronald Richards',
			avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
		},
		time: '1 week ago',
		text: 'Maecenas risus tortor, tincidunt nec purus eu, gravida suscipit tortor.',
		replies: [
			{
				id: 2,
				user: {
					name: 'Kristin Watson',
					role: 'Admin',
					avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
				},
				time: '1 week ago',
				text: 'Nulla pellentesque leo vitae lorem hendrerit, sit amet elementum ipsum rutrum. Morbi ultricies volutpat orci quis fringilla. Suspendisse faucibus augue quis dictum egestas.',
			},
			{
				id: 3,
				user: {
					name: 'Cody Fisher',
					avatar: 'https://randomuser.me/api/portraits/men/45.jpg',
				},
				time: '1 week ago',
				text: 'Thank You so much sir, you’re a great mentor. 🔥🔥🔥',
			},
		],
	},
	{
		id: 4,
		user: {
			name: 'Theresa Webb',
			avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
		},
		time: '3 weeks ago',
		text: 'Now i know that i will spent that 5 minutes of my life with pure pleasure',
		replies: [],
	},
])

// Dummy courses for Courses tab
const courses = ref([
	{
		id: 1,
		title: 'K1-1. Konsep Dasar Perubahan Iklim dan Keberlanjutan',
		image:
			'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=600&h=400&fit=crop',
		hasCertification: true,
		lessons: 16,
		progress: 50,
	},
	{
		id: 2,
		title: 'K1-2. Pengenalan Kebijakan Pelaporan Keberlanjutan',
		image:
			'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=600&h=400&fit=crop',
		hasCertification: true,
		lessons: 12,
		progress: 25,
	},
	{
		id: 3,
		title: 'K1-3. Standar Pelaporan Internasional',
		image:
			'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=600&h=400&fit=crop',
		hasCertification: false,
		lessons: 10,
		progress: 0,
	},
])

// Dummy breadcrumbs
const breadcrumbs = ref([
	{ label: 'Batches', route: { name: 'Batches' } },
	{
		label: 'Intensive Learning Intermediate (Batch 1)',
		route: { name: 'BatchDetail' },
	},
])
</script>

<style scoped>
.line-clamp-2 {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
</style>
