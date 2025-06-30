<template>
	<Dialog
		v-model="show"
		:options="{
			size: '4xl',
			title: __('Video Statistics for {0}').format(lessonTitle),
		}"
	>
		<template #body-content>
			<div class="text-base">
				<TabButtons :buttons="tabs" v-model="currentTab" class="w-fit" />
				<div v-if="currentTab" class="mt-8">
					<div class="grid grid-cols-[55%,40%] gap-5">
						<div class="space-y-5 border rounded-md p-2 pt-4">
							<div class="grid grid-cols-[70%,30%] text-sm text-ink-gray-5">
								<div class="px-4">
									{{ __('Member') }}
								</div>
								<div class="text-center">
									{{ __('Watch Time') }}
								</div>
							</div>
							<div
								v-for="row in currentTabData"
								class="hover:bg-surface-gray-1 cursor-pointer rounded-md py-1 px-2"
							>
								<router-link
									:to="{
										name: 'Profile',
										params: { username: row.member_username },
									}"
								>
									<div class="grid grid-cols-[70%,30%] items-center">
										<div class="flex items-center space-x-2">
											<Avatar
												:image="row.member_image"
												:label="row.member_name"
												size="xl"
											/>
											<div class="space-y-1">
												<div class="font-medium">
													{{ row.member_name }}
												</div>
												<div class="text-sm text-ink-gray-6">
													{{ row.member }}
												</div>
											</div>
										</div>
										<div class="text-center text-sm">
											{{ row.watch_time }}
										</div>
									</div>
								</router-link>
							</div>
						</div>
						<div class="space-y-5">
							<NumberChart
								class="border rounded-md"
								:config="{
									title: __('Average Watch Time (seconds)'),
									value: averageWatchTime,
								}"
							/>
							<VideoBlock :file="currentTab" />
						</div>
					</div>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Avatar,
	createListResource,
	Dialog,
	NumberChart,
	TabButtons,
} from 'frappe-ui'
import { computed, ref } from 'vue'
import VideoBlock from '@/components/VideoBlock.vue'

const show = defineModel<boolean | undefined>()
const currentTab = ref<string>('')

const props = defineProps<{
	lessonName: string
	lessonTitle: string
}>()

const statistics = createListResource({
	doctype: 'LMS Video Watch Duration',
	filters: {
		lesson: props.lessonName,
	},
	fields: [
		'name',
		'member',
		'member_name',
		'member_image',
		'member_username',
		'source',
		'watch_time',
	],
	auto: true,
	cache: ['videoStatistics', props.lessonName],
	onSuccess() {
		currentTab.value = Object.keys(statisticsData.value)[0]
	},
})

const statisticsData = computed(() => {
	const grouped = <Record<string, any[]>>{}
	statistics.data.forEach((item: { source: string }) => {
		if (!grouped[item.source]) {
			grouped[item.source] = []
		}
		grouped[item.source].push(item)
	})
	return grouped
})

const averageWatchTime = computed(() => {
	let totalWatchTime = 0

	currentTabData.value.forEach((item: { watch_time: string }) => {
		totalWatchTime += parseFloat(item.watch_time)
	})

	return totalWatchTime / currentTabData.value.length
})

const currentTabData = computed(() => {
	return statisticsData.value[currentTab.value] || []
})

const tabs = computed(() => {
	return Object.keys(statisticsData.value).map((source, index) => ({
		label: __(`Video ${index + 1}`),
		value: source,
	}))
})
</script>
