<template>
	<div class="min-h-screen bg-white">
		<!-- Header Breadcrumb -->
		<header class="bg-surface-white px-5 pt-4">
			<CourseBreadcrumb :items="breadcrumbs" />
		</header>

		<div class="flex">
			<!-- Left Sidebar -->
			<div
				class="w-80 flex-shrink-0 border-r bg-white p-5 sticky top-0 h-screen overflow-y-auto"
			>
				<!-- Course Title with Collapse -->
				<div class="flex items-center justify-between mb-2">
					<h1 class="text-lg font-semibold text-ink-gray-9">
						{{ course.title }}
					</h1>
					<button
						@click="sidebarCollapsed = !sidebarCollapsed"
						class="p-1 hover:bg-gray-100 rounded transition-colors"
					>
						<ChevronUp
							:class="[
								'h-4 w-4 transition-transform',
								sidebarCollapsed ? 'rotate-180' : '',
							]"
						/>
					</button>
				</div>

				<div v-show="!sidebarCollapsed">
					<!-- Instructor -->
					<div class="flex items-center text-sm text-ink-gray-5 mb-4">
						<div class="flex -space-x-2 mr-2">
							<img
								v-for="instructor in course.instructors"
								:key="instructor.name"
								:src="instructor.avatar"
								:alt="instructor.name"
								class="w-6 h-6 rounded-full border-2 border-white"
							/>
						</div>
						<span
							>{{ course.instructors.map((i) => i.name).join(', ') }}, and
							others</span
						>
					</div>

					<!-- Stats -->
					<div class="flex items-center space-x-4 text-sm text-ink-gray-5 mb-1">
						<span class="flex items-center">
							<FolderOpen class="h-4 w-4 mr-1" />
							{{ course.modules }} Module
						</span>
					</div>
					<div class="flex items-center text-sm text-ink-gray-5 mb-4">
						<FileText class="h-4 w-4 mr-1" />
						{{ course.materials }} Materials
					</div>

					<!-- Progress -->
					<div class="mb-6">
						<div class="flex justify-between text-sm mb-1">
							<span class="text-ink-gray-5">Course progress</span>
							<span class="font-medium text-ink-gray-9"
								>{{ course.progress }}%</span
							>
						</div>
						<div class="h-2 bg-gray-200 rounded-full overflow-hidden">
							<div
								class="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all"
								:style="{ width: course.progress + '%' }"
							></div>
						</div>
					</div>

					<!-- Course Outline -->
					<div class="space-y-1 mb-6">
						<!-- Regular Chapters -->
						<div v-for="(chapter, chapterIndex) in outline" :key="chapter.name">
							<button
								@click="toggleChapter(chapterIndex)"
								class="flex items-center justify-between w-full py-2 hover:bg-gray-50 transition-colors text-left"
							>
								<div class="flex items-center">
									<ChevronDown
										:class="[
											'h-4 w-4 text-ink-gray-5 mr-2 transition-transform duration-200',
											expandedChapters[chapterIndex] ? '' : '-rotate-90',
										]"
									/>
									<span class="text-sm text-ink-gray-9">{{
										chapter.title
									}}</span>
								</div>
								<span class="text-xs text-teal-600 flex items-center">
									<FileText class="h-3 w-3 mr-1" />
									{{ chapter.materials }} Materials
								</span>
							</button>
							<div
								v-show="expandedChapters[chapterIndex]"
								class="pl-6 space-y-1.5"
							>
								<div
									v-for="lesson in chapter.lessons"
									:key="lesson.name"
									class="flex items-center text-sm text-ink-gray-7 py-1"
								>
									<FileText class="h-4 w-4 mr-2 text-ink-gray-5" />
									<span>{{ lesson.title }}</span>
									<Check
										v-if="lesson.completed"
										class="h-4 w-4 text-teal-500 ml-auto"
									/>
								</div>
							</div>
						</div>

						<!-- Quiz Section -->
						<div>
							<button
								@click="quizExpanded = !quizExpanded"
								class="flex items-center justify-between w-full py-2 hover:bg-gray-50 transition-colors text-left"
							>
								<div class="flex items-center">
									<ChevronDown
										:class="[
											'h-4 w-4 text-ink-gray-5 mr-2 transition-transform duration-200',
											quizExpanded ? '' : '-rotate-90',
										]"
									/>
									<span class="text-sm text-teal-600 font-medium">Quiz</span>
								</div>
							</button>
							<div v-show="quizExpanded" class="pl-6 space-y-1.5">
								<div
									v-for="quiz in quizzes"
									:key="quiz.name"
									class="flex items-center text-sm text-ink-gray-7 py-1 cursor-pointer"
									:class="{ 'text-teal-600': currentQuiz === quiz.name }"
									@click="selectQuiz(quiz)"
								>
									<FileText class="h-4 w-4 mr-2" />
									<span>{{ quiz.title }}</span>
									<Check
										v-if="quiz.completed"
										class="h-4 w-4 text-teal-500 ml-auto"
									/>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Navigation Buttons -->
				<div class="flex space-x-3 mt-auto">
					<Button variant="outline" class="flex-1">
						{{ __('Previous') }}
					</Button>
					<Button
						variant="solid"
						class="flex-1 !bg-teal-500 hover:!bg-teal-600"
					>
						{{ __('Next') }}
					</Button>
				</div>
			</div>

			<!-- Right Content Area -->
			<div class="flex-1 p-6 overflow-y-auto">
				<!-- Quiz Header -->
				<div class="flex items-start justify-between mb-6">
					<div>
						<h1 class="text-2xl font-semibold text-ink-gray-9 mb-2">
							{{ currentQuizData.title }}
						</h1>
						<div class="flex items-center space-x-4 text-sm text-ink-gray-5">
							<span>{{ currentQuizData.questions }} Questions</span>
							<span>•</span>
							<span
								>Passing score
								<span class="font-medium text-ink-gray-9"
									>{{ currentQuizData.passingScore }}%</span
								></span
							>
						</div>
					</div>
					<div class="text-right">
						<div class="flex items-center text-ink-gray-5 mb-1">
							<Clock class="h-4 w-4 mr-1.5" />
							<span class="text-lg font-medium text-ink-gray-9">{{
								currentQuizData.duration
							}}</span>
						</div>
						<div class="text-sm text-ink-gray-5">
							Attempts
							<span class="font-medium text-ink-gray-9"
								>{{ currentQuizData.attempts }} of
								{{ currentQuizData.maxAttempts }}</span
							>
						</div>
					</div>
				</div>

				<!-- Start Quiz Button -->
				<div class="mb-10">
					<Button
						variant="solid"
						size="md"
						class="!bg-teal-500 hover:!bg-teal-600"
					>
						{{ __('Start Quiz') }}
					</Button>
				</div>

				<!-- Notes Section -->
				<div class="border-t pt-6">
					<h2 class="text-lg font-semibold text-ink-gray-9 mb-4">
						{{ __('Notes') }}
					</h2>

					<div class="border rounded-lg p-4 mb-6">
						<textarea
							v-model="noteText"
							placeholder="Write notes for quick revision"
							class="w-full min-h-[80px] resize-none border-0 focus:ring-0 text-sm text-ink-gray-7 placeholder:text-ink-gray-4"
						></textarea>
						<div class="flex items-center justify-between border-t pt-3 mt-3">
							<div class="flex space-x-2">
								<button class="p-1.5 hover:bg-gray-100 rounded">
									<Bold class="h-4 w-4 text-ink-gray-5" />
								</button>
								<button class="p-1.5 hover:bg-gray-100 rounded">
									<Italic class="h-4 w-4 text-ink-gray-5" />
								</button>
								<button class="p-1.5 hover:bg-gray-100 rounded">
									<Underline class="h-4 w-4 text-ink-gray-5" />
								</button>
								<button class="p-1.5 hover:bg-gray-100 rounded">
									<Link class="h-4 w-4 text-ink-gray-5" />
								</button>
							</div>
							<Button
								variant="solid"
								size="sm"
								class="!bg-teal-500 hover:!bg-teal-600"
							>
								{{ __('Save Notes') }}
							</Button>
						</div>
					</div>

					<!-- Saved Notes -->
					<div>
						<h3 class="text-sm font-medium text-ink-gray-9 mb-4">
							{{ __('Saved Notes') }}
						</h3>
						<div class="space-y-4">
							<div
								v-for="note in savedNotes"
								:key="note.id"
								class="border-l-4 border-yellow-400 bg-yellow-50 p-4 rounded-r-lg"
							>
								<div class="flex items-center justify-between mb-3">
									<span class="text-sm text-ink-gray-500">{{ note.date }}</span>
									<div class="flex space-x-1">
										<button class="p-1.5 hover:bg-yellow-100 rounded">
											<Pencil class="h-4 w-4 text-ink-gray-400" />
										</button>
										<button class="p-1.5 hover:bg-yellow-100 rounded">
											<Trash2 class="h-4 w-4 text-red-400" />
										</button>
									</div>
								</div>
								<ol
									class="list-decimal list-inside space-y-2 text-sm text-ink-gray-700"
								>
									<li
										v-for="(item, index) in note.items"
										:key="index"
										class="leading-relaxed"
									>
										{{ item }}
									</li>
								</ol>
							</div>
						</div>
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
	ChevronUp,
	ChevronDown,
	Check,
	Clock,
	FileText,
	FolderOpen,
	Bold,
	Italic,
	Underline,
	Link,
	Pencil,
	Trash2,
} from 'lucide-vue-next'
import CourseBreadcrumb from '@/components/CourseBreadcrumb.vue'

const noteText = ref('')
const currentQuiz = ref('quiz-1')
const sidebarCollapsed = ref(false)
const quizExpanded = ref(true)
const expandedChapters = ref({})

// Dummy course data
const course = ref({
	title: 'K1-2. Pengenalan Kebijakan Pelaporan Keberlanjutan',
	instructors: [
		{
			name: 'Aggraeni Purwanti',
			avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
		},
		{
			name: 'Rizka Putri',
			avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
		},
	],
	modules: 4,
	materials: 16,
	progress: 50,
})

// Dummy outline data
const outline = ref([
	{
		name: 'chapter-1',
		title: 'Kerangka Acuan Utama',
		materials: 4,
		lessons: [],
	},
	{
		name: 'chapter-2',
		title: 'Material Pembelajaran A',
		materials: 4,
		lessons: [],
	},
	{
		name: 'chapter-3',
		title: 'Material Pembelajaran B',
		materials: 4,
		lessons: [],
	},
	{
		name: 'chapter-4',
		title: 'Material Pembelajaran C',
		materials: 4,
		lessons: [],
	},
])

// Dummy quizzes
const quizzes = ref([
	{ name: 'quiz-1', title: 'Quiz 1', completed: true },
	{ name: 'quiz-2', title: 'Quiz 2', completed: false },
])

// Dummy current quiz data
const currentQuizData = ref({
	title: 'Quiz 1',
	questions: 10,
	passingScore: 70,
	duration: '30:00',
	attempts: 0,
	maxAttempts: 30,
})

// Dummy saved notes
const savedNotes = ref([
	{
		id: 1,
		date: 'December 12, 2025 • 10:00 PM',
		items: [
			'Memahami konsep dasar emisi gas rumah kaca (GRK) serta peran pelaporan metrik iklim dalam menilai kinerja keberlanjutan, baik untuk operasi entitas sendiri maupun program kebijakan publik.',
			'Menjelaskan metodologi pengukuran dan pelaporan emisi GRK berdasarkan standar internasional seperti Greenhouse Gas Protocol dan IPSASB, termasuk pendekatan location-based dan market-based dalam perhitungan Scope 2 emissions.',
		],
	},
	{
		id: 2,
		date: 'December 11, 2025 • 11:00 PM',
		items: [
			'Melakukan penilaian karbon internal (internal carbon pricing/assessment) sebagai alat strategis untuk mendukung pengambilan keputusan investasi, kebijakan, dan perencanaan fiskal yang sejalan dengan target net-zero emissions.',
		],
	},
])

// Dummy breadcrumbs
const breadcrumbs = ref([
	{ label: 'Course', route: { name: 'Courses' } },
	{
		label: 'K1-2. Pengenalan Kebijakan Pelaporan Keberlanjutan',
		route: { name: 'CourseDetail' },
	},
	{ label: 'Quiz 1', route: { name: 'QuizPage' } },
])

const toggleChapter = (index) => {
	expandedChapters.value[index] = !expandedChapters.value[index]
}

const selectQuiz = (quiz) => {
	currentQuiz.value = quiz.name
}
</script>

<style scoped>
textarea:focus {
	outline: none;
}
</style>
