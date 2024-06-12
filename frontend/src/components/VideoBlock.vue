<template>
	<div ref="videoContainer" class="video-block group relative">
		<video @ended="videoEnded" class="rounded-lg">
			<source :src="file" type="video/mp4" />
		</video>
		<div
			class="flex items-center space-x-4 bg-gray-200 rounded-2xl p-0.5 absolute bottom-3 w-[98%] invisible group-hover:visible left-0 right-0 mx-auto"
		>
			<Button variant="ghost">
				<template #icon>
					<Play
						v-if="!playing"
						@click="playVideo"
						class="w-4 h-4 fill-gray-900"
					/>
					<Pause v-else @click="pauseVideo" class="w-4 h-4 fill-gray-900" />
				</template>
			</Button>
			<span class="text-xs font-medium">
				{{ formatTime(currentTime) }} / {{ formatTime(duration) }}
			</span>
			<input
				type="range"
				min="0"
				:max="duration"
				step="0.1"
				v-model="currentTime"
				@input="changeTime"
				class="duration-slider"
			/>
			<Button variant="ghost" @click="toggleMute">
				<template #icon>
					<Volume2 v-if="!muted" class="w-4 h-4 fill-gray-900" />
					<VolumeX v-else class="w-4 h-4 fill-gray-900" />
				</template>
			</Button>
			<Button variant="ghost" @click="toggleFullscreen">
				<template #icon>
					<Maximize class="w-4 h-4 fill-gray-900" />
				</template>
			</Button>
		</div>
	</div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import { Play, Pause, Maximize, Volume2, VolumeX } from 'lucide-vue-next'
import { Button } from 'frappe-ui'

const videoRef = ref(null)
const videoContainer = ref(null)
let playing = ref(false)
let currentTime = ref(0)
let duration = ref(0)
let muted = ref(false)

const props = defineProps({
	file: {
		type: String,
		required: true,
	},
})

onMounted(() => {
	setTimeout(() => {
		videoRef.value = document.querySelector('video')
		videoRef.value.onloadedmetadata = loadedMetaData
		videoRef.value.ontimeupdate = updateTime
	}, 0)
})

const playVideo = () => {
	videoRef.value.play()
	playing.value = true
}

const pauseVideo = () => {
	videoRef.value.pause()
	playing.value = false
}

const videoEnded = () => {
	playing.value = false
}

const toggleMute = () => {
	videoRef.value.muted = !videoRef.value.muted
	muted.value = videoRef.value.muted
}

const changeTime = () => {
	videoRef.value.currentTime = currentTime.value
}

const loadedMetaData = () => {
	duration.value = videoRef.value.duration
}

const updateTime = () => {
	currentTime.value = videoRef.value.currentTime
}

const formatTime = (time) => {
	const minutes = Math.floor(time / 60)
	const seconds = Math.floor(time % 60)
	return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}

const toggleFullscreen = () => {
	if (document.fullscreenElement) {
		document.exitFullscreen()
	} else {
		videoContainer.value.requestFullscreen()
	}
}
</script>

<style scoped>
.video-block {
	width: 100%;
	max-width: 900px;
	margin: 0 auto;
}

.video-block video {
	width: 100%;
	height: auto;
}

.duration-slider {
	flex: 1;
	height: 0.25rem;
	-webkit-appearance: none;
	appearance: none;
	background-color: theme('colors.gray.400');
}
</style>
