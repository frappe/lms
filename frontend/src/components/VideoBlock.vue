<template>
	<div ref="videoContainer" class="video-block relative group">
		<video
			@timeupdate="updateTime"
			@ended="videoEnded"
			@click="togglePlay"
			oncontextmenu="return false"
			class="rounded-md border border-gray-100 cursor-pointer"
			ref="videoRef"
		>
			<source :src="fileURL" :type="type" />
		</video>
		<div
			v-if="!playing"
			class="absolute inset-0 flex items-center justify-center cursor-pointer"
			@click="playVideo"
		>
			<div
				class="rounded-full p-4 pl-4.5"
				style="
					background: radial-gradient(
						circle,
						rgba(0, 0, 0, 0.3) 0%,
						rgba(0, 0, 0, 0.4) 50%
					);
				"
			>
				<Play />
			</div>
		</div>
		<div
			class="flex items-center space-x-2 py-2 px-1 text-ink-white bg-gradient-to-b from-transparent to-black/75 absolute bottom-0 left-0 right-0 mx-auto rounded-md"
			:class="{
				'invisible group-hover:visible': playing,
			}"
		>
			<Button variant="ghost">
				<template #icon>
					<Play
						v-if="!playing"
						@click="playVideo"
						class="size-4 text-ink-gray-9"
					/>
					<Pause v-else @click="pauseVideo" class="size-5 text-ink-white" />
				</template>
			</Button>
			<Button variant="ghost" @click="toggleMute">
				<template #icon>
					<Volume2 v-if="!muted" class="size-5 text-ink-white" />
					<VolumeX v-else class="size-5 text-ink-white" />
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
			<span class="text-sm font-semibold">
				{{ formatTime(currentTime) }} / {{ formatTime(duration) }}
			</span>
			<Button variant="ghost" @click="toggleFullscreen">
				<template #icon>
					<Maximize class="size-5 text-ink-white" />
				</template>
			</Button>
		</div>
	</div>
</template>
<script setup>
import { ref, onMounted, computed } from 'vue'
import { Pause, Maximize, Volume2, VolumeX } from 'lucide-vue-next'
import { Button } from 'frappe-ui'
import Play from '@/components/Icons/Play.vue'

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
	type: {
		type: String,
		default: 'video/mp4',
	},
})

onMounted(() => {
	setTimeout(() => {
		videoRef.value.onloadedmetadata = () => {
			duration.value = videoRef.value.duration
		}
		videoRef.value.ontimeupdate = () => {
			currentTime.value = videoRef.value.currentTime
		}
	}, 0)
})

const fileURL = computed(() => {
	if (isYoutube) {
		let url = props.file
		if (url.includes('watch?v=')) {
			url = url.replace('watch?v=', 'embed/')
		}
		return `${url}?autoplay=0&controls=0&disablekb=1&playsinline=1&cc_load_policy=1&cc_lang_pref=auto`
	}
	return props.file
})

const isYoutube = computed(() => {
	return props.type == 'video/youtube'
})

const playVideo = () => {
	videoRef.value.play()
	playing.value = true
}

const pauseVideo = () => {
	videoRef.value.pause()
	playing.value = false
}

const togglePlay = () => {
	if (playing.value) {
		pauseVideo()
	} else {
		playVideo()
	}
}

const videoEnded = () => {
	playing.value = false
}

const toggleMute = () => {
	videoRef.value.muted = !videoRef.value.muted
	muted.value = videoRef.value.muted
}

const changeCurrentTime = () => {
	videoRef.value.currentTime = currentTime.value
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
	margin: 0 auto;
}

.video-block video {
	width: 100%;
	height: auto;
}

iframe {
	width: 100%;
	min-height: 500px;
}

.duration-slider {
	flex: 1;
	-webkit-appearance: none;
	appearance: none;
	border-radius: 10px;
	background-color: theme('colors.gray.100');
	cursor: pointer;
}

.duration-slider::-webkit-slider-thumb {
	width: 2px;
	border-radius: 50%;
	-webkit-appearance: none;
	background-color: theme('colors.gray.500');
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
		box-shadow: -500px 0 0 500px theme('colors.gray.600');
	}
}
</style>
