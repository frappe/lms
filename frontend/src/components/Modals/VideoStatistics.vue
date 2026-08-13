<template>
	<Dialog v-model:open="show" size="4xl" :title="__('Video Statistics')">
		<template #default>
			<div class="text-base">
				<div class="flex items-center justify-between">
					<TabButtons
						v-if="tabs.length > 1"
						:options="tabs"
						v-model="currentTab"
						:aria-label="__('Select video')"
						class="w-fit"
					/>
				</div>
				<div
					v-if="currentTab"
					:class="{
						'mt-5': tabs.length > 1,
					}"
				>
					<div class="grid grid-cols-1 gap-5 sm:grid-cols-[55%,40%]">
						<div
							class="space-y-5 border rounded-md p-2 pt-4 max-h-[50vh] sm:max-h-[70vh] overflow-y-auto"
						>
							<div
								class="grid grid-cols-[60%,40%] sm:grid-cols-[70%,30%] text-sm text-ink-gray-5"
							>
								<div class="px-4">
									{{ __('Member') }}
								</div>
								<div class="text-center">
									{{ __('Watch Time (mins)') }}
								</div>
							</div>
							<div
								v-for="row in currentTabData"
								:key="row.name"
								class="hover:bg-surface-gray-2 cursor-pointer rounded-md"
							>
								<router-link
									class="block rounded-md py-1 px-2"
									:to="{
										name: 'Profile',
										params: { username: row.member_username },
									}"
								>
									<div
										class="grid grid-cols-[60%,40%] sm:grid-cols-[70%,30%] items-center"
									>
										<div class="flex items-center gap-x-3 min-w-0">
											<Avatar
												:image="row.member_image"
												:label="row.member_name"
												size="xl"
												aria-hidden="true"
												class="shrink-0"
											/>
											<div class="space-y-1 min-w-0">
												<div
													class="font-medium truncate underline underline-offset-2"
												>
													{{ row.member_name }}
												</div>
												<div class="text-sm text-ink-gray-6 truncate">
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
							<NumberChartGraph
								:title="__('Average Watch Time (mins)')"
								:value="averageWatchTime"
							/>
							<div v-if="isPlyrSource">
								<div
									class="video-player"
									:data-plyr-provider="provider"
									:src="safeUrl(currentTab)"
								></div>
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
import NumberChartGraph from '@/components/NumberChartGraph.vue'
import { safeUrl } from '@/utils/safeUrl'

/* Responsive layout notes (Tailwind classes live in the template):
   - The member list / chart+player split stacks below `sm`; only above `sm` is
     there room for two real panels side by side.
   - The label/value rows stay two columns at every width. They read fine as
     columns on a phone, and the visual column pairing is the only thing tying
     the "Watch Time (mins)" header to each number: a screen reader gets no
     association from a grid of divs, so hiding or stacking the header would
     strip the value's only label. Widening the value column below `sm` keeps
     the header from wrapping to three lines instead.
   - The member cell needs `min-w-0` + `truncate`: long emails have no break
     opportunity and otherwise overflow the column rather than shrink with it.
   - The member name is underlined at rest, not on hover. The whole row is a
     link to the profile, and a phone has no hover, so a hover-only cue leaves
     nothing on screen to say the row is tappable. `hover:bg-surface-gray-2`
     rather than `-gray-1` because `-gray-1` is within ~1.08:1 of the dialog
     panel in dark mode, i.e. no visible hover state there at all. */
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
	statistics.data?.forEach((item: { source: string }) => {
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
		label: __('Video {0}').format(index + 1),
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
