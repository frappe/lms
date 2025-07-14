<template>
	<div>
		<!-- <audio width="100%" controls controlsList="nodownload" class="mb-4">
			<source :src="encodeURI(file)" type="audio/mp3" />
		</audio> -->
		<audio @ended="handleAudioEnd" controlsList="nodownload" class="mb-4">
			<source :src="encodeURI(file)" type="audio/mp3" />
		</audio>
		<div class="flex items-center space-x-2 shadow rounded-lg p-1 w-1/2">
			<Button variant="ghost" @click="togglePlay">
				<template #icon>
					<Play v-if="!isPlaying" class="w-4 h-4 text-ink-gray-9" />
					<Pause v-else class="w-4 h-4 text-ink-gray-9" />
				</template>
			</Button>
			<input
				type="range"
				min="0"
				:max="duration"
				step="0.1"
				v-model="currentTime"
				@input="changeCurrentTime"
				class="duration-slider w-full h-1"
			/>
			<span class="text-xs text-ink-gray-9 font-medium">
				{{ formatTime(currentTime) }} / {{ formatTime(duration) }}
			</span>
			<Button variant="ghost" @click="toggleMute">
				<template #icon>
					<Volume2 v-if="!isMuted" class="w-4 h-4 text-ink-gray-9" />
					<VolumeX v-else class="w-4 h-4 text-ink-gray-9" />
				</template>
			</Button>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { Play, Pause, Volume2, VolumeX } from 'lucide-vue-next'
import { Button } from 'frappe-ui'

const isPlaying = ref(false)
const audio = ref(null)
let isMuted = ref(false)
let currentTime = ref(0)
let duration = ref(0)

const props = defineProps({
	file: {
		type: String,
		required: true,
	},
})

onMounted(() => {
	setTimeout(() => {
		audio.value = document.querySelector('audio')
		audio.value.onloadedmetadata = () => {
			duration.value = audio.value.duration
		}
		audio.value.ontimeupdate = () => {
			currentTime.value = audio.value.currentTime
		}
	}, 0)
})

const togglePlay = () => {
	if (audio.value.paused) {
		audio.value.play()
		isPlaying.value = true
	} else {
		audio.value.pause()
		isPlaying.value = false
	}
}

const toggleMute = () => {
	audio.value.muted = !audio.value.muted
	isMuted.value = audio.value.muted
}

const changeCurrentTime = () => {
	audio.value.currentTime = currentTime.value
}

const handleAudioEnd = () => {
	isPlaying.value = false
}

const formatTime = (time) => {
	const minutes = Math.floor(time / 60)
	const seconds = Math.floor(time % 60)
	return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}

watch(isPlaying, (newVal) => {
	if (newVal) {
		audio.value.play()
	} else {
		audio.value.pause()
	}
})
</script>
<style>
.duration-slider {
	flex: 1;
	-webkit-appearance: none;
	appearance: none;
	background-color: theme('colors.gray.400');
	cursor: pointer;
}

.duration-slider::-webkit-slider-thumb {
	height: 10px;
	width: 10px;
	-webkit-appearance: none;
	background-color: theme('colors.gray.900');
}

@media screen and (-webkit-min-device-pixel-ratio: 0) {
	input[type='range'] {
		overflow: hidden;
		width: 150px;
		-webkit-appearance: none;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		cursor: pointer;
		box-shadow: -150px 0 0 150px theme('colors.gray.900');
	}
}
</style>
