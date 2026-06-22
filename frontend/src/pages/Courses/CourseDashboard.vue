<template>
	<div class="p-5">
		<div class="grid grid-cols-4 gap-5 mb-5 text-ink-gray-9">
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
					<Star class="size-5 text-transparent fill-amber-500" />
				</template>
			</NumberChartGraph>
			<NumberChartGraph :title="__('Lessons')" :value="course.data?.lessons" />
		</div>
		<div class="grid grid-cols-[2fr_1fr] gap-5 items-start">
			<div class="border rounded-lg py-3 px-4">
				<div class="flex items-center justify-between mb-3">
					<div class="text-lg text-ink-gray-9 font-semibold">
						{{ __('Students') }}
					</div>
					<div class="flex items-center gap-x-2">
						<FormControl
							v-model="searchFilter"
							:placeholder="__('Search by name')"
							type="text"
						/>
						<Button @click="showEnrollmentModal = true">
							<template #prefix>
								<Plus class="size-4 stroke-1.5" />
							</template>
							{{ __('Enroll') }}
						</Button>
					</div>
				</div>
				<div
					v-if="progressList.loading || progressList.data?.length"
					class="max-h-[63vh] overflow-y-auto"
				>
					<ListView
						:columns="progressColumns"
						:rows="progressList.data"
						rowKey="name"
						:options="{
							selectable: false,
							showTooltip: false,
						}"
					>
						<ListHeader
							class="mb-2 grid items-center gap-x-4 rounded bg-surface-white border-b rounded-none p-2"
						>
							<ListHeaderItem
								:item="item"
								v-for="item in progressColumns"
								:key="item.key"
							>
							</ListHeaderItem>
						</ListHeader>
						<ListRows v-for="row in progressList.data" class="max-h-[500px]">
							<ListRow
								:row="row"
								@click="
									() => {
										showProgressModal = true
										currentStudent = row
									}
								"
								class="cursor-pointer"
							>
								<template #default="{ column, item }">
									<ListRowItem
										:item="row[column.key]"
										:align="column.align"
										class="w-full"
									>
										<template #prefix>
											<div v-if="column.key == 'member_name'">
												<Avatar
													class="flex items-center"
													:image="row['member_image']"
													:label="item"
													size="sm"
												/>
											</div>
											<ProgressBar
												v-else-if="column.key == 'progress'"
												:progress="Math.ceil(row[column.key])"
												class="!mx-0 !me-4"
											/>
										</template>
										<div v-if="column.key == 'creation'">
											{{ dayjs(row[column.key]).format('DD MMM YYYY') }}
										</div>
										<div
											v-else-if="column.key == 'progress'"
											class="text-xs !mx-0 w-5"
										>
											{{ Math.ceil(row[column.key]) }}%
										</div>
										<div
											v-else-if="column.key == 'actions'"
											class="flex justify-end w-full"
										>
											<Button
												theme="red"
												variant="ghost"
												:label="__('Remove')"
												@click.stop="confirmRemove(row)"
											>
												<template #prefix>
													<Trash2 class="size-4 stroke-1.5" />
												</template>
											</Button>
										</div>
										<div v-else>
											{{ row[column.key].toString() }}
										</div>
									</ListRowItem>
								</template>
							</ListRow>
						</ListRows>
					</ListView>
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
					class="border rounded-lg p-4"
				>
					<div class="text-ink-gray-5 mb-4">
						{{ __('Progress Summary') }}
					</div>
					<div
						class="grid grid-cols-[2fr_1fr] items-center justify-between text-ink-gray-9"
					>
						<div class="flex flex-col space-y-4 flex-1 text-sm">
							<div
								class="flex items-center text-ink-gray-7"
								v-for="row in chartDetails.data?.progress_distribution"
							>
								<div
									class="size-2 rounded"
									:style="{
										backgroundColor:
											colors[theme][
												row.name.startsWith('Just')
													? 'red'
													: row.name.startsWith('In')
													? 'amber'
													: row.name.startsWith('Adv')
													? 'blue'
													: 'green'
											][400],
									}"
								></div>
								<Tooltip :text="row.name.split('(')[1].replace(')', '')">
									<div class="ms-2">
										{{ row.name.split('(')[0] }}
									</div>
								</Tooltip>
								<Tooltip :text="String(row.value)">
									<div class="ms-auto">
										{{
											Math.round((row.value / course.data?.enrollments) * 100)
										}}%
									</div>
								</Tooltip>
							</div>
						</div>
						<ECharts
							class="w-40 h-20"
							:options="{
								color: progressColors,
								series: [
									{
										type: 'pie',
										radius: ['50%', '70%'],
										center: ['50%', '50%'],
										label: {
											show: false,
										},
										labelLine: {
											show: false,
										},
										emphasis: {
											label: {
												show: false,
											},
											scale: false,
										},
										data: chartDetails.data?.progress_distribution || [],
									},
								],
								showInlineLabels: false,
							}"
						/>
					</div>
				</div>
				<div
					v-if="lessonProgress.data?.length"
					class="border rounded-lg pt-4 px-4"
				>
					<div class="flex items-center justify-between mb-4">
						<div class="text-ink-gray-5">
							{{ __('Lesson Completion') }}
						</div>
						<Select
							:options="lessonProgressSortingOptions"
							@update:modelValue="
								(value: SelectOptionValue | undefined) =>
									updateLessonProgress(String(value))
							"
							:placeholder="__('Sort by')"
							class="!w-32"
						/>
					</div>
					<div
						class="divide-y max-h-[40vh] divide-outline-gray-modals text-ink-gray-7 overflow-y-auto"
					>
						<div
							v-for="progress in lessonProgress.data"
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
										Math.ceil(
											(progress.completion_count / course.data?.enrollments) *
												100
										)
									}}%
								</div>
							</Tooltip>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
	<CourseEnrollmentModal
		v-if="showEnrollmentModal"
		v-model="showEnrollmentModal"
		:course="course"
		:students="progressList"
	/>
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
	ECharts,
	FormControl,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	Tooltip,
	call,
	toast,
} from 'frappe-ui'
import type { SelectOptionValue } from 'frappe-ui'
import Select from '@/components/Controls/Select.vue'
import { computed, inject, ref, watch } from 'vue'
import type dayjsType from 'dayjs'
import { Plus, Star, Trash2 } from 'lucide-vue-next'
import { createDialog } from '@/utils/dialogs'
import { formatAmount } from '@/utils'
import colors from '@/utils/frappe-ui-colors.json'
import CourseEnrollmentModal from '@/pages/Courses/CourseEnrollmentModal.vue'
import NumberChartGraph from '@/components/NumberChartGraph.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import StudentCourseProgress from '@/pages/Courses/StudentCourseProgress.vue'

import type { CourseDetails, Resource } from '@/types/api'

const props = defineProps<{
	course: Resource<CourseDetails | null>
}>()

const __ = ((window as any).__ as ((text: string) => string)) || ((text: string) => text)
const dayjs = inject<typeof dayjsType>('$dayjs')!
const showEnrollmentModal = ref<boolean>(false)
const searchFilter = ref<string | null>(null)
const showProgressModal = ref<boolean>(false)
const currentStudent = ref<Record<string, unknown> | null>(null)
const theme = ref<'darkMode' | 'lightMode'>(
	localStorage.getItem('theme') == 'dark' ? 'darkMode' : 'lightMode'
)
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

watch(
	() => progressList.data,
	(newData, oldData) => {
		if (oldData) {
			props.course.reload()
			chartDetails.reload()
			lessonProgress.reload()
		}
	}
)

const averageCompletionRate = computed(() => {
	let value = Math.ceil(chartDetails.data?.average_progress) || 0
	return value + '%'
})

const progressColors = computed(() => {
	let colorList = []
	colorList.push(colors[theme.value]['red'][400])
	colorList.push(colors[theme.value]['amber'][400])
	colorList.push(colors[theme.value]['blue'][400])
	colorList.push(colors[theme.value]['green'][400])
	return colorList
})

const progressColumns = computed(() => {
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
			align: 'right',
		},
		{
			label: '',
			key: 'actions',
			align: 'right',
			width: '10%',
		},
	]
})

// Remove a wrongly-enrolled learner from THIS course only (keeps their other
// courses and their user account). Backed by the moderator-only whitelisted
// method ecological_society.students.remove_member_from_course.
const confirmRemove = (row: Record<string, any>) => {
	createDialog({
		title: __('Remove Learner from Course'),
		message: __(
			'Remove {0} from this course? This deletes their enrollment, progress, quiz submissions and certificates for this course only. Other courses and their account are kept.'
		).format(row.member_name || row.member),
		actions: [
			{
				label: __('Remove'),
				theme: 'red',
				variant: 'solid',
				onClick(close: () => void) {
					call('ecological_society.students.remove_member_from_course', {
						course: props.course.data?.name,
						member: row.member,
					})
						.then(() => {
							progressList.reload()
							toast.success(
								__('{0} removed from the course.').format(
									row.member_name || row.member
								)
							)
						})
						.catch((err: any) => {
							toast.error(__(err.messages?.[0] || err))
							console.error(err)
						})
					close()
				},
			},
		],
	})
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
