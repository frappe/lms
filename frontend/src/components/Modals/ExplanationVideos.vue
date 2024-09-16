<template>
	<Dialog
		v-model="show"
		:options="{
			size: '4xl',
		}"
	>
		<template #body>
			<div class="p-4">
				<VideoBlock :file="file" />
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog } from 'frappe-ui'
import { computed } from 'vue'
import VideoBlock from '@/components/VideoBlock.vue'

const show = defineModel()

const props = defineProps({
	type: {
		type: [String, null],
		required: true,
	},
})

const file = computed(() => {
	if (props.type == 'youtube') return '/Youtube.mp4'
	if (props.type == 'quiz') return '/Quiz.mp4'
	if (props.type == 'upload') return '/Upload.mp4'
})
</script>
