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

		<div class="space-y-2">
			<div
				class="flex items-center text-sm font-medium space-x-2 cursor-pointer"
				@click="openHelpDialog('quiz')"
			>
				<span>
					{{ __('How to add a Quiz?') }}
				</span>
				<Info class="w-3 h-3 text-ink-gray-7" />
			</div>
			<div class="text-xs text-ink-gray-5 mb-1 leading-5">
				{{
					__(
						'Click on the add icon in the editor and select Quiz from the menu. It opens up a dialog, where you can either select a quiz from the list or create a new quiz. When you select the Create New option it redirects you to the quiz creation page.'
					)
				}}
			</div>
		</div>

		<div class="space-y-2">
			<div
				class="flex text-sm font-medium space-x-2 cursor-pointer"
				@click="openHelpDialog('upload')"
			>
				<span class="leading-5">
					{{ __(contentMap['upload']) }}
				</span>
				<Info class="w-3 h-3 text-ink-gray-7" />
			</div>
			<div class="text-xs text-ink-gray-5 mb-1 leading-5">
				{{
					__(
						'To upload Image, Video, Audio or PDF from your system, click on the add icon and select upload from the menu. Then choose the file you want to add to the lesson and it gets added to your lesson.'
					)
				}}
			</div>
		</div>

		<div class="space-y-2">
			<div
				class="flex items-center text-sm font-medium space-x-2 cursor-pointer"
				@click="openHelpDialog('youtube')"
			>
				<span>
					{{ __(contentMap['youtube']) }}
				</span>
				<Info class="w-3 h-3 text-ink-gray-7" />
			</div>
			<div class="text-xs text-ink-gray-5 mb-1 leading-5">
				{{
					__(
						'Copy the URL of the video from YouTube and paste it in the editor.'
					)
				}}
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
	quiz: 'How to add a Quiz?',
	upload: 'How to upload content from your system?',
	youtube: 'How to add a YouTube Video?',
}

const openHelpDialog = (contentType) => {
	type.value = contentType
	title.value = contentMap[contentType]
	showExplanation.value = true
}
</script>
