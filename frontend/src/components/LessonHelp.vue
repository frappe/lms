<template>
	<div class="space-y-5 text-ink-gray-9">
		<div class="space-y-2">
			<div class="flex items-center text-sm font-medium space-x-2">
				<span>
					{{ __('What does include in preview mean?') }}
				</span>
			</div>
			<div class="text-xs text-ink-gray-5 mb-1 leading-5">
				{{
					__(
						'If Include in Preview is enabled for a lesson then the lesson will also be accessible to non logged in users.'
					)
				}}
			</div>
		</div>

		<div class="space-y-2" v-for="(item, key) in contentMap" :key="key">
			<div
				class="flex items-center text-sm font-medium space-x-2 cursor-pointer"
				@click="openHelpDialog(key)"
			>
				<span>
					{{ __(item.title) }}
				</span>
				<Info class="w-3 h-3 text-ink-gray-7" />
			</div>
			<div class="text-xs text-ink-gray-5 mb-1 leading-5">
				{{ __(item.description) }}
			</div>
		</div>
	</div>
	<ExplanationVideos v-model="showExplanation" :title="title" :type="type" />
</template>
<script setup>
import { Info } from 'lucide-vue-next'
import { ref } from 'vue'
import ExplanationVideos from '@/components/Modals/ExplanationVideos.vue'

const showExplanation = ref(false)
const type = ref(null)
const title = ref(null)
const contentMap = {
	quiz: {
		title: 'How to add a Quiz?',
		description:
			'Click on the add icon in the editor and select Quiz from the menu. It opens up a dialog, where you can either select a quiz from the list or create a new quiz. When you select the Create New option it redirects you to the quiz creation page.',
	},
	upload: {
		title: 'How to upload content from your system?',
		description:
			'To upload Image, Video, Audio or PDF from your system, click on the add icon and select upload from the menu. Then choose the file you want to add to the lesson and it gets added to your lesson.',
	},
	youtube: {
		title: 'How to add a YouTube Video?',
		description:
			'Copy the URL of the video from YouTube and paste it in the editor.',
	},
	remove: {
		title: 'How to remove an embed?',
		description:
			'To remove an embed like YouTube or Vimeo, put your cursor on the line below the embed, then drag your mouse cursor upwards to select the embed. Once the embed is selected press BackSpace.',
	},
}

const openHelpDialog = (contentType) => {
	type.value = contentType
	title.value = contentMap[contentType].title
	showExplanation.value = true
}
</script>
