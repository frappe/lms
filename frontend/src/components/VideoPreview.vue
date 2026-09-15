<template>
	<div
		v-if="hasPreview"
		class="aspect-[750/422] w-full overflow-hidden rounded-t-md bg-black"
	>
		<iframe
			v-if="videoPreview.type === 'youtube'"
			:src="safeUrl(videoPreview.src)"
			:title="__('Video preview')"
			class="size-full"
			allowfullscreen
		/>
		<video
			v-else-if="videoPreview.type === 'file' && !videoError"
			:src="safeUrl(videoPreview.src)"
			controls
			class="size-full object-contain"
			@error="videoError = true"
		/>
		<img
			v-else-if="fallbackImage"
			:src="safeUrl(fallbackImage)"
			:alt="__('Video preview')"
			class="size-full object-cover"
		/>
	</div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getVideoPreview } from '@/utils/video'
import { safeUrl } from '@/utils/safeUrl'

// Shared display for a course/batch preview video. A video_link can be a
// YouTube link (render an embed iframe, NOT a <video>, which is what made batch
// cards fail), an uploaded file path (<video>), or unplayable (fall back to the
// poster image). Used by CourseCardOverlay and BatchOverlay.
const props = defineProps<{
	videoLink?: string | null
	fallbackImage?: string | null
}>()

const videoPreview = computed(() => getVideoPreview(props.videoLink))

// Reset the in-browser playback error whenever the source changes.
const videoError = ref(false)

// The preview box keeps a fixed 750/422 ratio (same as the thumbnail fields), so
// a portrait source letterboxes instead of stretching the card. Render nothing
// at all when there is no playable source and no poster to fall back to.
const hasPreview = computed(() => {
	if (videoPreview.value.type === 'youtube') return true
	if (videoPreview.value.type !== 'file') return false
	return !videoError.value || !!props.fallbackImage
})

watch(
	() => props.videoLink,
	() => {
		videoError.value = false
	}
)
</script>
