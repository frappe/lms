<template>
	<div class="p-5">
		<div
			class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5 text-ink-gray-9"
		>
			<NumberChartGraph
				:title="__('Enrolled')"
				:value="formatAmount(course.data?.enrollments)"
			/>
			<NumberChartGraph
				:title="__('Average Completion Rate')"
				:value="averageCompletionRate"
			/>
			<NumberChartGraph
				:title="__('Average Rating')"
				:value="course.data?.rating || 0"
			>
				<template #prefix>
					<LucideStar class="size-5 text-transparent fill-ink-amber-7" />
				</template>
			</NumberChartGraph>
			<NumberChartGraph :title="__('Lessons')" :value="course.data?.lessons" />
		</div>
		<div
			v-if="showStudentsEmptyState"
			class="flex min-h-[30vh] sm:min-h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center"
		>
			<span class="lucide-users size-7.5 text-ink-gray-5" />
			<div class="flex flex-col items-center gap-1">
				<span class="text-lg-medium text-ink-gray-8">
					{{ __('No students enrolled yet') }}
				</span>
				<span class="text-p-base text-ink-gray-6">
					{{ __('Enroll students to track their progress here') }}
				</span>
			</div>
		</div>
		<div
			v-else
			class="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5 items-start"
		>
			<div class="border rounded-6 py-3 px-4">
				<div class="flex items-center justify-between mb-3">
					<div class="text-lg-semibold text-ink-gray-9">
						{{ __('Students') }}
					</div>
					<div class="flex items-center gap-x-2">
						<FormControl
							v-model="searchFilter"
							:placeholder="__('Search')"
							:aria-label="__('Search students')"
							type="text"
						>
							<template #prefix>
								<span class="lucide-search size-4 text-ink-gray-5" />
							</template>
						</FormControl>
					</div>
				</div>
				<div class="sm:max-h-[63vh] sm:overflow-y-auto">
					<ResponsiveListView
						v-if="progressList.loading || progressList.data?.length"
						:columns="progressColumns"
						:rows="progressList.data || []"
						row-key="name"
						:options="studentListOptions"
					>
						<template #cell="{ column, row, value }">
							<span
								v-if="column.key === 'member_name'"
								class="flex items-center gap-2"
							>
								<Avatar
									:image="row.member_image as string"
									:label="String(value)"
									size="sm"
								/>
								<span class="min-w-0 truncate">{{ value }}</span>
							</span>
							<span
								v-else-if="column.key === 'progress'"
								class="flex items-center gap-2"
							>
								<ProgressBar
									:progress="Math.ceil(Number(value))"
									class="!mx-0 min-w-0 flex-1"
								/>
								<span class="text-xs shrink-0">
									{{ Math.ceil(Number(value)) }}%
								</span>
							</span>
							<span v-else-if="column.key === 'creation'">
								{{ dayjs(value as string).format('DD MMM YYYY') }}
							</span>
							<span v-else>{{ value }}</span>
						</template>
					</ResponsiveListView>
					<div v-else class="min-h-[200px]">
						<EmptyStateLayout
							name="Students"
							icon="lucide-users"
							:title="__('No students match your search')"
							:description="__('Try a different name')"
						/>
					</div>
					<div
						v-if="progressList.data && progressList.hasNextPage"
						class="flex justify-center my-3"
					>
						<Button @click="progressList.next()">
							{{ __('Load More') }}
						</Button>
					</div>
				</div>
			</div>
			<div class="space-y-5">
				<div
					v-if="chartDetails.data?.average_progress > 0"
					ref="progressSummary"
					class="border rounded-6 p-4"
				>
					<div class="text-ink-gray-5 mb-4">
						{{ __('Progress Summary') }}
					</div>
					<div
						class="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4 items-center justify-between text-ink-gray-9"
					>
						<ul class="flex flex-col space-y-4 flex-1 text-sm list-none">
							<li
								class="flex items-center text-ink-gray-7"
								v-for="row in chartDetails.data?.progress_distribution"
								:key="row.name"
							>
								<div
									class="size-2 rounded-4"
									:style="{ backgroundColor: progressColor(row.name) }"
								></div>
								<Tooltip :text="row.name.split('(')[1].replace(')', '')">
									<div class="ms-2">
										{{ row.name.split('(')[0] }}
									</div>
								</Tooltip>
								<Tooltip :text="String(row.value)">
									<div class="ms-auto">
										{{
											course.data?.enrollments
												? Math.round(
														(row.value / course.data.enrollments) * 100
												  )
												: 0
										}}%
									</div>
								</Tooltip>
							</li>
						</ul>
						<ProgressRing class="w-40 h-20" :slices="progressSlices" />
					</div>
				</div>
				<div
					v-if="lessonProgress.data?.length"
					class="border rounded-6 pt-4 px-4"
				>
					<div class="flex items-center justify-between mb-4">
						<div class="text-ink-gray-5">
							{{ __('Lesson Completion') }}
						</div>
						<Select
							:options="lessonProgressSortingOptions"
							@update:modelValue="
								(value: SelectOptionValue | null) =>
									value != null && updateLessonProgress(String(value))
							"
							:placeholder="__('Sort by')"
							class="!w-32"
						/>
					</div>
					<ul
						class="divide-y sm:max-h-[40vh] divide-outline-elevation-2 text-ink-gray-7 sm:overflow-y-auto list-none"
					>
						<li
							v-for="progress in lessonProgress.data"
							:key="`${progress.chapter_idx}-${progress.idx}`"
							class="flex justify-between text-sm py-2 my-1 text-ink-gray-9"
						>
							<div class="">
								<span class="me-3 text-xs">
									{{ progress.chapter_idx }}.{{ progress.idx }}
								</span>
								<span>
									{{ progress.title }}
								</span>
							</div>
							<Tooltip :text="String(progress.completion_count)">
								<div>
									{{
										course.data?.enrollments
											? Math.ceil(
													(progress.completion_count /
														course.data.enrollments) *
														100
											  )
											: 0
									}}%
								</div>
							</Tooltip>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
	<StudentCourseProgress
		v-if="showProgressModal"
		v-model="showProgressModal"
		:course="course"
		:student="currentStudent"
		:lessons="lessonProgress"
	/>
</template>
<script setup lang="ts">
import {
	Avatar,
	Button,
	createListResource,
	createResource,
	FormControl,
	Tooltip,
} from 'frappe-ui'
import type { SelectOptionValue } from 'frappe-ui'
import {
	registerChartModules,
	useChart,
	useChartTokens,
} from 'frappe-ui/charts'
import { PieChart } from 'echarts/charts'
import Select from '@/components/Controls/Select.vue'
import { computed, defineComponent, h, inject, ref, watch } from 'vue'
import type { PropType } from 'vue'
import type dayjsType from 'dayjs'
import { formatAmount } from '@/utils'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import NumberChartGraph from '@/components/NumberChartGraph.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
import StudentCourseProgress from '@/pages/Courses/StudentCourseProgress.vue'

import type {
	CourseDetails,
	ListColumn,
	ListRow,
	ListViewOptions,
	Resource,
} from '@/types'

const props = defineProps<{
	course: Resource<CourseDetails | null>
}>()

const dayjs = inject<typeof dayjsType>('$dayjs')!
const searchFilter = ref<string | null>(null)

const showProgressModal = ref<boolean>(false)
const currentStudent = ref<Record<string, unknown> | null>(null)
type Filters = {
	course: string | undefined
	member_name?: string[]
}

const chartDetails = createResource({
	url: 'lms.lms.api.get_course_progress_distribution',
	makeParams() {
		return {
			course: props.course.data?.name,
		}
	},
	auto: true,
})

const progressList = createListResource({
	doctype: 'LMS Enrollment',
	filters: {
		course: props.course.data?.name,
	},
	fields: [
		'name',
		'member',
		'member_name',
		'member_image',
		'member_username',
		'progress',
		'creation',
	],
	pageLength: 100,
	auto: true,
	// Also how CourseEnrollmentForm reaches this list through
	// getCachedListResource after enrolling someone — it is a route of its own
	// now, so it has no way in through props.
	cache: ['courseProgress', props.course.data?.name],
})

const lessonProgress = createResource({
	url: 'lms.lms.api.get_lesson_completion_stats',
	params: {
		course: props.course.data?.name,
	},
	auto: true,
})

const updateLessonProgress = (value: string) => {
	if (value == 'completion_rate') {
		lessonProgress.data?.sort((a: any, b: any) => {
			const rateA = a.completion_count / (props.course.data?.enrollments || 1)
			const rateB = b.completion_count / (props.course.data?.enrollments || 1)
			return rateB - rateA
		})
	} else if (value == 'index') {
		lessonProgress.data?.sort((a: any, b: any) => {
			return a.chapter_idx - b.chapter_idx || a.idx - b.idx
		})
	}
}

watch([searchFilter], () => {
	let filters: Filters = {
		course: props.course.data?.name,
	}

	if (searchFilter.value) {
		filters.member_name = ['like', `%${searchFilter.value}%`]
	}

	progressList.update({
		filters: filters,
	})
	progressList.reload()
})

const averageCompletionRate = computed(() => {
	let value = Math.ceil(chartDetails.data?.average_progress) || 0
	return value + '%'
})

const showStudentsEmptyState = computed(
	() =>
		!progressList.loading && !progressList.data?.length && !searchFilter.value
)

type ProgressRow = { name: string; value: number }
type ProgressSlice = ProgressRow & { itemStyle: { color: string } }

const PROGRESS_CATEGORICAL_SLOT = { red: 8, amber: 6, blue: 0, green: 2 }

registerChartModules([PieChart])

const progressSummary = ref<HTMLElement>()
const { tokens: chartTokens } = useChartTokens(progressSummary)

const progressHue = (name: string): keyof typeof PROGRESS_CATEGORICAL_SLOT => {
	if (name.startsWith('Just')) return 'red'
	if (name.startsWith('In')) return 'amber'
	if (name.startsWith('Adv')) return 'blue'
	return 'green'
}

const progressColor = (name: string) => {
	const slot = PROGRESS_CATEGORICAL_SLOT[progressHue(name)]
	return chartTokens.value.categorical[slot]
}

const progressSlices = computed<ProgressSlice[]>(() => {
	const rows = (chartDetails.data?.progress_distribution || []) as ProgressRow[]
	return rows.map((row) => ({
		...row,
		itemStyle: { color: progressColor(row.name) },
	}))
})

const ProgressRing = defineComponent({
	props: {
		slices: { type: Array as PropType<ProgressSlice[]>, required: true },
	},
	setup(ringProps) {
		const plot = ref<HTMLElement>()
		useChart({
			container: plot,
			option: () => ({
				series: [
					{
						type: 'pie',
						radius: ['50%', '70%'],
						center: ['50%', '50%'],
						label: { show: false },
						labelLine: { show: false },
						emphasis: { label: { show: false }, scale: false },
						data: ringProps.slices,
					},
				],
			}),
		})
		return () => h('div', { ref: plot })
	},
})

const progressColumns = computed<ListColumn[]>(() => {
	return [
		{
			label: __('Name'),
			key: 'member_name',
			width: '40%',
		},
		{
			label: __('Progress'),
			key: 'progress',
			width: '30%',
		},
		{
			label: __('Enrolled On'),
			key: 'creation',
			align: 'left',
		},
	]
})

const studentListOptions: ListViewOptions = {
	selectable: false,
	showTooltip: false,
	onRowClick: (row: ListRow) => {
		currentStudent.value = row
		showProgressModal.value = true
	},
}

const lessonProgressSortingOptions = [
	{
		label: __('Lesson Index'),
		value: 'index',
		onClick() {
			updateLessonProgress('index')
		},
	},
	{
		label: __('Completion Rate'),
		value: 'completion_rate',
		onClick() {
			updateLessonProgress('completion_rate')
		},
	},
]
</script>
