<template>
	<div>
		<audio width="100%" controls controlsList="nodownload" class="mb-4">
			<source :src="encodeURI(file)" type="audio/mp3" />
		</audio>
		<audio width="100%" controlsList="nodownload" class="mb-4">
			<source :src="encodeURI(file)" type="audio/mp3" />
		</audio>
		<div class="flex items-center space-x-4 p-2 shadow rounded-2xl">
			<Button variant="ghost" @click="togglePlay">
				<template #icon>
					<Play v-if="!isPlaying" class="w-4 h-4 fill-gray-900" />
					<Pause v-else class="w-4 h-4 fill-gray-900" />
				</template>
			</Button>

			<input
				type="range"
				min="0"
				:max="duration"
				step="0.1"
				v-model="currentTime"
				@input="changeCurrentTime"
				class="duration-slider"
			/>
			<span class="text-xs text-gray-900 font-medium"
				>{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span
			>
			<Button variant="ghost" @click="toggleMute">
				<template #icon>
					<Volume2 v-if="!isMuted" class="w-4 h-4 fill-gray-900" />
					<VolumeX v-else class="w-4 h-4 fill-gray-900" />
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
let volume = ref(1)
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
		console.log(audio.value)
		audio.value.onloadedmetadata = () => {
			console.log(audio.value.duration)
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
	height: 0.25rem;
	-webkit-appearance: none;
	appearance: none;
	background-color: theme('colors.gray.400');
}

.duration-slider::-moz-range-track {
	background: theme('colors.gray.900');
}
</style>
