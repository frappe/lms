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
				<div class="flex items-center justify-between">
					<TabButtons
						v-if="tabs.length > 1"
						:buttons="tabs"
						v-model="currentTab"
						class="w-fit"
					/>
					<!-- <FormControl
						v-model="searchText"
						:placeholder="__('Search by Member')"
						class="mt-2 mr-5 w-[25%]"
					/> -->
				</div>
				<div v-if="currentTab" class="mt-4">
					<div class="grid grid-cols-[55%,40%] gap-5">
						<div
							class="space-y-5 border rounded-md p-2 pt-4 h-[70vh] overflow-y-auto"
						>
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
											{{ formatTimestamp(row.watch_time) }}
										</div>
									</div>
								</router-link>
							</div>
						</div>
						<div class="space-y-5">
							<NumberChart
								class="border rounded-md"
								:config="{
									title: __('Average Watch Time'),
									value: averageWatchTime,
								}"
							/>
							<div v-if="isPlyrSource">
								<div class="video-player" :src="currentTab"></div>
							</div>
							<VideoBlock v-else :file="currentTab" />
						</div>
					</div>
				</div>
				<div v-else class="text-sm text-ink-gray-5">
					{{ __('No statistics available for this video.') }}
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
	FormControl,
	NumberChart,
	TabButtons,
} from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { enablePlyr, formatTimestamp } from '@/utils'
import VideoBlock from '@/components/VideoBlock.vue'

const show = defineModel<boolean | undefined>()
const currentTab = ref<string>('')
const searchText = ref<string>('')
type Filters = {
	lesson: string | undefined
	member_name?: string[]
}

const props = defineProps<{
	lessonName?: string
	lessonTitle?: string
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
	cache: ['videoStatistics', props.lessonName],
	onSuccess() {
		currentTab.value = Object.keys(statisticsData.value)[0]
	},
})

watch(
	() => props.lessonName,
	() => {
		if (props.lessonName) {
			statistics.filters.lesson = props.lessonName
			statistics.reload()
		}
	}
)

watch(searchText, () => {
	let filterApplied = false
	let filters: Filters = {
		lesson: props.lessonName,
	}

	if (searchText.value) {
		filters.member_name = ['like', `%${searchText.value}%`]
		filterApplied = true
	}

	statistics.update({
		filters: filters,
	})

	statistics.reload({})
})

watch(show, () => {
	if (show.value) {
		enablePlyr()
	}
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

	return formatTimestamp(totalWatchTime / currentTabData.value.length)
})

const currentTabData = computed(() => {
	return statisticsData.value[currentTab.value] || []
})

const isPlyrSource = computed(() => {
	return (
		currentTab.value.includes('youtube') || currentTab.value.includes('vimeo')
	)
})

const provider = computed(() => {
	if (currentTab.value.includes('youtube')) {
		return 'youtube'
	} else if (currentTab.value.includes('vimeo')) {
		return 'vimeo'
	}
	return ''
})

const embedURL = computed(() => {
	if (isPlyrSource.value) {
		return currentTab.value.replace('watch?v=', 'embed/')
	}
	return ''
})

const tabs = computed(() => {
	return Object.keys(statisticsData.value).map((source, index) => ({
		label: __(`Video ${index + 1}`),
		value: source,
	}))
})
</script>
<style>
.plyr__volume input[type='range'] {
	display: none;
}

.plyr__control--overlaid {
	background: radial-gradient(
		circle,
		rgba(0, 0, 0, 0.4) 0%,
		rgba(0, 0, 0, 0.5) 50%
	);
}

.plyr__control:hover {
	background: none;
}

.plyr--video {
	border: 1px solid theme('colors.gray.200');
	border-radius: 8px;
}

:root {
	--plyr-range-fill-background: white;
	--plyr-video-control-background-hover: transparent;
}
</style>
