<template>
	<div class="p-5">
		<div class="grid grid-cols-3 gap-5 mb-5">
			<NumberChartGraph :title="__('Enrolled')" :value="memberCount || 0" />
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
		</div>
		<div class="grid grid-cols-[2fr_1fr] gap-5 items-start">
			<div class="border rounded-md py-3 px-4">
				<div class="flex items-center justify-between mb-4">
					<div class="text-lg font-semibold">
						{{ __('Students') }}
					</div>
					<div class="flex items-center space-x-2">
						<FormControl
							v-model="searchFilter"
							:placeholder="__('Search by Member')"
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
							class="mb-2 grid items-center space-x-4 rounded bg-surface-white p-2"
						>
							<ListHeaderItem
								:item="item"
								v-for="item in progressColumns"
								:key="item.key"
							>
							</ListHeaderItem>
						</ListHeader>
						<ListRows v-for="row in progressList.data" class="max-h-[500px]">
							<router-link
								:to="{
									name: 'Profile',
									params: { username: row.member_username },
								}"
							>
								<ListRow :row="row">
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
													class="!mx-0 !mr-4"
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
											<div v-else>
												{{ row[column.key].toString() }}
											</div>
										</ListRowItem>
									</template>
								</ListRow>
							</router-link>
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
			<div class="border rounded-md p-4">
				<div class="text-ink-gray-5 mb-4">
					{{ __('Progress Summary') }}
				</div>
				<div class="grid grid-cols-[2fr_1fr] items-center justify-between">
					<div class="flex flex-col space-y-3 flex-1 text-xs">
						<div
							class="flex items-center"
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
												: 'green'
										][400],
								}"
							></div>
							<div class="ml-2">
								{{ row.name }}
							</div>
							<div class="ml-auto">
								{{ Math.round((row.value / course.data?.enrollments) * 100) }}%
							</div>
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
									legend: {
										show: false,
									},
									data: chartDetails.data?.progress_distribution || [],
								},
							],
							showInlineLabels: false,
						}"
					/>
				</div>
			</div>
		</div>
	</div>
	<CourseEnrollmentModal
		v-if="showEnrollmentModal"
		v-model="showEnrollmentModal"
		:course="course"
	/>
</template>
<script setup lang="ts">
import {
	Avatar,
	Button,
	createListResource,
	createResource,
	dayjs,
	ECharts,
	FormControl,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
} from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { Plus, Star } from 'lucide-vue-next'
import colors from '@/utils/frappe-ui-colors.json'
import CourseEnrollmentModal from '@/pages/Courses/CourseEnrollmentModal.vue'
import NumberChartGraph from '@/components/NumberChartGraph.vue'
import ProgressBar from '@/components/ProgressBar.vue'

const props = defineProps<{
	course: any
}>()

const showEnrollmentModal = ref(false)
const searchFilter = ref<string | null>(null)
const memberCount = ref<number>(props.course.data?.enrollments || 0)
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
})

watch([searchFilter], () => {
	let filterApplied = false
	let filters: Filters = {
		course: props.course.data?.name,
	}

	if (searchFilter.value) {
		filters.member_name = ['like', `%${searchFilter.value}%`]
		filterApplied = true
	}

	progressList.update({
		filters: filters,
	})
	progressList.reload(
		{},
		{
			onSuccess(data: any[]) {
				memberCount.value = filterApplied
					? data.length
					: props.course.data?.enrollments || 0
			},
		}
	)
})

const averageCompletionRate = computed(() => {
	let value = Math.ceil(chartDetails.data?.average_progress) || 0
	return value + '%'
})

const progressColors = computed(() => {
	let colorList = []
	colorList.push(colors[theme.value]['red'][400])
	colorList.push(colors[theme.value]['amber'][400])
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
			label: __('Start Date'),
			key: 'creation',
			align: 'right',
		},
	]
})
</script>
