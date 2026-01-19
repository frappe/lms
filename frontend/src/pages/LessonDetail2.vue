<template>
	<div v-if="course" class="min-h-screen bg-white">
		<!-- Header Breadcrumb -->
		<header class="bg-surface-white px-5 pt-4">
			<CourseBreadcrumb :items="breadcrumbs" />
		</header>

		<div class="flex">
			<!-- Left Sidebar -->
			<div
				class="w-80 flex-shrink-0 border-r bg-white p-5 sticky top-0 h-screen overflow-y-auto"
			>
				<!-- Course Title -->
				<h1 class="text-lg font-semibold text-ink-gray-9 mb-2">
					{{ course.title }}
				</h1>

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
					<span>{{ course.instructors.map((i) => i.name).join(' and ') }}</span>
				</div>

				<!-- Stats -->
				<div class="flex items-center space-x-4 text-sm text-ink-gray-5 mb-4">
					<span class="flex items-center">
						<FolderOpen class="h-4 w-4 mr-1" />
						{{ course.modules }} Module
					</span>
					<span class="flex items-center">
						<FileText class="h-4 w-4 mr-1" />
						{{ course.materials }} Materials
					</span>
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
				<div class="border rounded-lg overflow-hidden mb-6">
					<div
						v-for="(chapter, chapterIndex) in outline"
						:key="chapter.name"
						class="border-b last:border-b-0"
					>
						<button
							@click="toggleChapter(chapterIndex)"
							class="flex items-center justify-between w-full p-3 hover:bg-gray-50 transition-colors text-left"
						>
							<div class="flex items-center">
								<ChevronUp
									:class="[
										'h-4 w-4 text-ink-gray-5 mr-2 transition-transform duration-200',
										expandedChapters[chapterIndex] ? '' : 'rotate-180',
									]"
								/>
								<span class="font-medium text-teal-600 text-sm">{{
									chapter.title
								}}</span>
							</div>
							<span class="text-xs text-ink-gray-5 flex items-center">
								<FileText class="h-3 w-3 mr-1" />
								{{ chapter.lessons.length }} Materials
							</span>
						</button>
						<div v-show="expandedChapters[chapterIndex]" class="bg-gray-50/50">
							<div
								v-for="(lesson, lessonIndex) in chapter.lessons"
								:key="lesson.name"
								class="flex items-center px-3 py-2 pl-9 text-sm border-t border-gray-100 cursor-pointer hover:bg-gray-100/50"
								:class="{ 'bg-teal-50': currentLesson === lesson.name }"
								@click="selectLesson(lesson)"
							>
								<FileText class="h-4 w-4 mr-2 text-ink-gray-5" />
								<span class="flex-1 text-ink-gray-7">{{ lesson.title }}</span>
								<Check v-if="lesson.completed" class="h-4 w-4 text-teal-500" />
							</div>
						</div>
					</div>
				</div>

				<!-- Navigation Buttons -->
				<div class="flex space-x-3">
					<Button variant="outline" class="flex-1" @click="goToPrevious">
						{{ __('Previous') }}
					</Button>
					<Button
						variant="solid"
						class="flex-1 !bg-teal-500 hover:!bg-teal-600"
						@click="goToNext"
					>
						{{ __('Next') }}
					</Button>
				</div>
			</div>

			<!-- Right Content Area -->
			<div class="flex-1 p-6 overflow-y-auto">
				<!-- Current Lesson Title -->
				<div class="text-sm text-ink-gray-5 mb-4">
					{{ currentLessonData.title }}
				</div>

				<!-- About Material -->
				<section class="mb-8">
					<h2 class="text-xl font-semibold text-ink-gray-9 mb-4">
						{{ __('About Material') }}
					</h2>
					<p class="text-ink-gray-7 leading-relaxed">
						{{ currentLessonData.description }}
					</p>
				</section>

				<!-- Video/Slide Embed -->
				<div class="mb-8 rounded-lg overflow-hidden border bg-gray-900">
					<img
						:src="currentLessonData.thumbnail"
						alt="Lesson content"
						class="w-full h-auto object-cover"
					/>
				</div>

				<!-- Material Title Sections -->
				<section class="mb-8">
					<h2 class="text-lg font-semibold text-ink-gray-9 mb-3">
						{{ __('Material Title') }}
					</h2>
					<ol
						class="list-decimal list-inside space-y-1 text-sm text-ink-gray-7"
					>
						<li v-for="(topic, index) in currentLessonData.topics" :key="index">
							{{ topic }}
						</li>
					</ol>
				</section>

				<section class="mb-8">
					<h2 class="text-lg font-semibold text-ink-gray-9 mb-3">
						{{ __('Material Title') }}
					</h2>
					<ol
						class="list-decimal list-inside space-y-2 text-sm text-ink-gray-7"
					>
						<li
							v-for="(outcome, index) in currentLessonData.outcomes"
							:key="index"
							class="leading-relaxed"
						>
							{{ outcome }}
						</li>
					</ol>
				</section>

				<!-- Notes/Discussion Tabs -->
				<div class="border-t pt-6">
					<div class="border-b mb-6">
						<nav class="flex space-x-6">
							<button
								@click="activeTab = 'notes'"
								:class="[
									'py-2 border-b-2 font-medium text-sm transition-colors',
									activeTab === 'notes'
										? 'border-teal-500 text-ink-gray-9'
										: 'border-transparent text-ink-gray-5 hover:text-ink-gray-7',
								]"
							>
								{{ __('Notes') }}
							</button>
							<button
								@click="activeTab = 'discussion'"
								:class="[
									'py-2 border-b-2 font-medium text-sm transition-colors',
									activeTab === 'discussion'
										? 'border-teal-500 text-ink-gray-9'
										: 'border-transparent text-ink-gray-5 hover:text-ink-gray-7',
								]"
							>
								{{ __('Discussion') }} (3)
							</button>
						</nav>
					</div>

					<!-- Notes Tab -->
					<div v-show="activeTab === 'notes'" class="space-y-6">
						<div class="border rounded-lg p-4">
							<textarea
								v-model="noteText"
								placeholder="Write notes for quick revision"
								class="w-full min-h-[100px] resize-none border-0 focus:ring-0 text-sm text-ink-gray-7 placeholder:text-ink-gray-4"
							></textarea>
							<div class="flex items-center justify-between border-t pt-3 mt-3">
								<div class="flex space-x-2">
									<button class="p-1 hover:bg-gray-100 rounded">
										<Bold class="h-4 w-4 text-ink-gray-5" />
									</button>
									<button class="p-1 hover:bg-gray-100 rounded">
										<Italic class="h-4 w-4 text-ink-gray-5" />
									</button>
									<button class="p-1 hover:bg-gray-100 rounded">
										<Underline class="h-4 w-4 text-ink-gray-5" />
									</button>
									<button class="p-1 hover:bg-gray-100 rounded">
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
									<div class="flex items-center justify-between mb-2">
										<span class="text-sm text-ink-gray-5">{{ note.date }}</span>
										<div class="flex space-x-2">
											<button class="p-1 hover:bg-yellow-100 rounded">
												<Pencil class="h-4 w-4 text-ink-gray-5" />
											</button>
											<button class="p-1 hover:bg-yellow-100 rounded">
												<Trash2 class="h-4 w-4 text-red-400" />
											</button>
										</div>
									</div>
									<ol
										class="list-decimal list-inside space-y-1 text-sm text-ink-gray-7"
									>
										<li v-for="(item, index) in note.items" :key="index">
											{{ item }}
										</li>
									</ol>
								</div>
							</div>
						</div>
					</div>

					<!-- Discussion Tab -->
					<div v-show="activeTab === 'discussion'">
						<p class="text-ink-gray-5 text-sm">
							Discussion content coming soon...
						</p>
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
	Check,
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

const activeTab = ref('notes')
const noteText = ref('')
const currentLesson = ref('lesson-1')
const expandedChapters = ref({ 0: true })

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
		lessons: [
			{
				name: 'lesson-1',
				title: 'Macam-macam pelaporan berkelanjutan',
				completed: true,
			},
			{
				name: 'lesson-2',
				title: 'Macam-macam pelaporan berkelanjutan',
				completed: false,
			},
			{
				name: 'lesson-3',
				title: 'Macam-macam pelaporan berkelanjutan',
				completed: false,
			},
			{
				name: 'lesson-4',
				title: 'Macam-macam pelaporan berkelanjutan',
				completed: false,
			},
		],
	},
	{
		name: 'chapter-2',
		title: 'Material Pembelajaran A',
		lessons: [
			{ name: 'lesson-5', title: 'Material A - Lesson 1', completed: false },
			{ name: 'lesson-6', title: 'Material A - Lesson 2', completed: false },
		],
	},
	{
		name: 'chapter-3',
		title: 'Material Pembelajaran B',
		lessons: [
			{ name: 'lesson-7', title: 'Material B - Lesson 1', completed: false },
		],
	},
	{
		name: 'chapter-4',
		title: 'Material Pembelajaran C',
		lessons: [
			{ name: 'lesson-8', title: 'Material C - Lesson 1', completed: false },
		],
	},
	{
		name: 'chapter-5',
		title: 'Quiz',
		lessons: [],
	},
])

// Dummy current lesson data
const currentLessonData = ref({
	title: 'Macam-macam pelaporan berkelanjutan',
	description:
		'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu f',
	thumbnail:
		'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=800&h=400&fit=crop',
	topics: [
		'Penetapan Target Iklim (GHG dan Non?GHG)',
		'Pemantauan dan Reviu Target',
		'Evaluasi Capaian Target',
		'Peer Metrics dan Benchmarking',
	],
	outcomes: [
		'Memahami konsep dasar emisi gas rumah kaca (GRK) serta peran pelaporan metrik iklim dalam menilai kinerja keberlanjutan, baik untuk operasi entitas sendiri maupun program kebijakan publik.',
		'Menjelaskan metodologi pengukuran dan pelaporan emisi GRK berdasarkan standar internasional seperti Greenhouse Gas Protocol dan IPSASB, termasuk pendekatan location-based dan market-based dalam perhitungan Scope 2 emissions.',
		'Mengklasifikasikan dan menginterpretasikan emisi berdasarkan cakupan internasional (Scope 1, Scope 2, dan Scope 3) serta memahami prinsip materialitas dalam pengungkapan data emisi.',
		'Menganalisis risiko dan peluang iklim (fisik dan transisi) serta keterkaitannya dengan target pengurangan emisi dan strategi adaptasi sektor publik dan swasta.',
		'Melakukan penilaian karbon internal (internal carbon pricing/assessment) sebagai alat strategis untuk mendukung pengambilan keputusan investasi, kebijakan, dan perencanaan fiskal yang sejalan dengan target net-zero emissions.',
		'Mengevaluasi kemajuan terhadap target iklim melalui pemantauan, reviu capaian, dan penggunaan metrik yang selaras dengan standar global seperti UNFCCC, sehingga memungkinkan benchmarking dan peer metrics dengan entitas sejenis.',
	],
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
	{ label: 'Macam-macam pelaporan berkelanjutan', route: { name: 'Lesson' } },
])

const toggleChapter = (index) => {
	expandedChapters.value[index] = !expandedChapters.value[index]
}

const selectLesson = (lesson) => {
	currentLesson.value = lesson.name
}

const goToPrevious = () => {
	console.log('Go to previous lesson')
}

const goToNext = () => {
	console.log('Go to next lesson')
}
</script>

<style scoped>
textarea:focus {
	outline: none;
}
</style>
