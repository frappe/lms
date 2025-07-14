<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Course Progress Summary'),
			size: '5xl',
		}"
	>
		<template #body-content>
			<div class="flex justify-between space-x-10 text-base mt-10">
				<div class="w-full">
					<div class="flex items-center justify-between space-x-5 mb-4">
						<!-- <div class="text-xl font-semibold text-ink-gray-6">
							{{ __('{0} Members').format(memberCount) }}
						</div> -->
						<FormControl
							v-model="searchFilter"
							:placeholder="__('Search by Member Name')"
							type="text"
							class="w-full"
						/>
					</div>
					<div class="max-h-[70vh] overflow-y-auto">
						<ListView
							v-if="progressList.loading || progressList.data?.length"
							:columns="progressColumns"
							:rows="progressList.data"
							rowKey="name"
							:options="{
								selectable: false,
								showTooltip: false,
							}"
						>
							<ListHeader
								class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
							>
								<ListHeaderItem
									:item="item"
									v-for="item in progressColumns"
									:key="item.key"
								>
									<template #prefix="{ item }">
										<FeatherIcon
											:name="item.icon?.toString()"
											class="h-4 w-4"
										/>
									</template>
								</ListHeaderItem>
							</ListHeader>
							<ListRows v-for="row in progressList.data">
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
												</template>
												<div>
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
							class="flex justify-center my-5"
						>
							<Button @click="progressList.next()">
								{{ __('Load More') }}
							</Button>
						</div>
					</div>
				</div>
				<div class="mb-4 self-start w-full space-y-5">
					<div class="flex items-center space-x-4">
						<NumberChart
							class="border rounded-md w-full"
							:config="{
								title: __('Enrollments'),
								value: memberCount || 0,
							}"
						/>
						<NumberChart
							class="border rounded-md w-full"
							:config="{
								title: __('Average Progress %'),
								value: chartDetails.data?.average_progress || 0,
							}"
						/>
					</div>
					<DonutChart
						:config="{
							data: chartDetails.data?.progress_distribution || [],
							title: __('Progress Distribution'),
							categoryColumn: 'category',
							valueColumn: 'count',
							colors: [
								theme.colors.red['400'],
								theme.colors.amber['400'],
								theme.colors.pink['400'],
								theme.colors.blue['400'],
								theme.colors.green['400'],
							],
						}"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Avatar,
	Button,
	createListResource,
	createResource,
	Dialog,
	DonutChart,
	FeatherIcon,
	FormControl,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	NumberChart,
} from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { theme } from '@/utils/theme'

const show = defineModel<boolean | undefined>()
const searchFilter = ref<string | null>(null)

const props = defineProps<{
	courseName?: string
	enrollments?: number
}>()

const memberCount = ref<number>(props.enrollments || 0)

const chartDetails = createResource({
	url: 'lms.lms.api.get_course_progress_distribution',
	params: {
		course: props.courseName,
	},
	auto: true,
})

const progressList = createListResource({
	doctype: 'LMS Enrollment',
	filters: {
		course: props.courseName,
	},
	fields: [
		'name',
		'member',
		'member_name',
		'member_image',
		'member_username',
		'progress',
	],
	pageLength: 50,
	auto: true,
})

watch([searchFilter], () => {
	let filterApplied = false
	type Filters = {
		course: string | undefined
		member_name?: string[]
	}
	let filters: Filters = {
		course: props.courseName,
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
				memberCount.value = filterApplied ? data.length : props.enrollments || 0
			},
		}
	)
})

const progressColumns = computed(() => {
	return [
		{
			label: __('Member'),
			key: 'member_name',
			width: '60%',
			icon: 'user',
		},
		{
			label: __('Progress'),
			key: 'progress',
			width: '30%',
			align: 'right',
			icon: 'trending-up',
		},
	]
})
</script>
