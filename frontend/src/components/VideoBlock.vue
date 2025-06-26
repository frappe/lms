<template>
	<div>
		<div v-if="quizzes.length && !showQuiz && readOnly" class="leading-5">
			{{
				__('This video contains {0} {1}:').format(
					quizzes.length,
					quizzes.length == 1 ? 'quiz' : 'quizzes'
				)
			}}

			<div v-for="(quiz, index) in quizzes" class="pl-3 mt-1">
				<span>
					{{ index + 1 }}. <span class="font-semibold"> {{ quiz.quiz }} </span>
				</span>
				{{ __('at {0} minutes').format(formatTimestamp(quiz.time)) }}
			</div>
		</div>
		<div
			v-if="!showQuiz"
			ref="videoContainer"
			class="video-block relative group"
		>
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
				<Button variant="ghost" class="hover:bg-transparent">
					<template #icon>
						<Play
							v-if="!playing"
							@click="playVideo"
							class="size-4 text-ink-gray-9"
						/>
						<Pause v-else @click="pauseVideo" class="size-5 text-ink-white" />
					</template>
				</Button>

				<div class="relative flex items-center w-full flex-1">
					<input
						type="range"
						min="0"
						:max="duration"
						step="0.1"
						v-model="currentTime"
						@input="changeCurrentTime"
						class="duration-slider h-1"
					/>
					<!-- QUIZ MARKERS -->
					<div class="absolute top-0 left-0 w-full h-full pointer-events-none">
						<div
							v-for="(quiz, index) in quizzes"
							:key="index"
							:style="getQuizMarkerStyle(quiz.time)"
							class="absolute top-0 h-full w-2 bg-surface-amber-3"
						></div>
					</div>
				</div>

				<span class="text-sm font-medium">
					{{ formatSeconds(currentTime) }} / {{ formatSeconds(duration) }}
				</span>
				<Button
					variant="ghost"
					@click="toggleMute"
					class="hover:bg-transparent"
				>
					<template #icon>
						<Volume2 v-if="!muted" class="size-5 text-ink-white" />
						<VolumeX v-else class="size-5 text-ink-white" />
					</template>
				</Button>
				<Button
					variant="ghost"
					@click="toggleFullscreen"
					class="hover:bg-transparent"
				>
					<template #icon>
						<Maximize class="size-5 text-ink-white" />
					</template>
				</Button>
			</div>
		</div>
		<Quiz
			v-if="showQuiz"
			:quizName="currentQuiz"
			:inVideo="true"
			:backToVideo="resumeVideo"
		/>
		<div v-if="!readOnly" @click="showQuizModal = true">
			<Button>
				{{ __('Add Quiz to Video') }}
			</Button>
		</div>
	</div>
	<QuizInVideo
		v-model="showQuizModal"
		:quizzes="quizzes"
		:saveQuizzes="saveQuizzes"
		:duration="duration"
	/>
	<Dialog
		v-model="showQuizLoader"
		:options="{
			size: 'sm',
		}"
	>
		<template #body>
			<div class="flex flex-col space-y-2 p-5 text-base leading-5">
				<span class="font-semibold">
					{{ __('Time for a Quiz') }}
				</span>
				<span>
					{{
						__(
							'Complete the upcoming quiz to continue watching the video. The quiz will open in {0} {1}.'
						).format(quizLoadTimer, quizLoadTimer === 1 ? 'second' : 'seconds')
					}}
				</span>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { Pause, Maximize, Volume2, VolumeX } from 'lucide-vue-next'
import { Button, Dialog } from 'frappe-ui'
import { formatSeconds, formatTimestamp } from '@/utils'
import Play from '@/components/Icons/Play.vue'
import QuizInVideo from '@/components/Modals/QuizInVideo.vue'

const videoRef = ref(null)
const videoContainer = ref(null)
let playing = ref(false)
let currentTime = ref(0)
let duration = ref(0)
let muted = ref(false)
const showQuizModal = ref(false)
const showQuiz = ref(false)
const showQuizLoader = ref(false)
const quizLoadTimer = ref(0)
const currentQuiz = ref(null)
const nextQuiz = ref({})

const props = defineProps({
	file: {
		type: String,
		required: true,
	},
	type: {
		type: String,
		default: 'video/mp4',
	},
	readOnly: {
		type: String,
		default: true,
	},
	quizzes: {
		type: Array,
		default: () => [],
	},
	saveQuizzes: {
		type: Function,
	},
})

onMounted(() => {
	updateCurrentTime()
	updateNextQuiz()
})

const updateCurrentTime = () => {
	setTimeout(() => {
		videoRef.value.onloadedmetadata = () => {
			duration.value = videoRef.value.duration
		}
		videoRef.value.ontimeupdate = () => {
			currentTime.value = videoRef.value?.currentTime || currentTime.value
			if (currentTime.value >= nextQuiz.value.time) {
				videoRef.value.pause()
				playing.value = false
				videoRef.value.onTimeupdate = null
				currentQuiz.value = nextQuiz.value.quiz
				quizLoadTimer.value = 7
			}
		}
	}, 0)
}

watch(quizLoadTimer, () => {
	if (quizLoadTimer.value > 0) {
		showQuizLoader.value = true
		setTimeout(() => {
			quizLoadTimer.value -= 1
		}, 1000)
	} else {
		showQuizLoader.value = false
		showQuiz.value = true
	}
})

const resumeVideo = (restart = false) => {
	showQuiz.value = false
	currentQuiz.value = null
	updateCurrentTime()
	setTimeout(() => {
		videoRef.value.currentTime = restart ? 0 : currentTime.value
		videoRef.value.play()
		playing.value = true
		updateNextQuiz()
	}, 0)
}

const updateNextQuiz = () => {
	if (!props.quizzes.length) return

	props.quizzes.forEach((quiz) => {
		if (typeof quiz.time == 'string' && quiz.time.includes(':')) {
			let time = quiz.time.split(':')
			let timeInSeconds = parseInt(time[0]) * 60 + parseInt(time[1])
			quiz.time = timeInSeconds
		}
	})

	props.quizzes.sort((a, b) => a.time - b.time)

	const nextQuizIndex = props.quizzes.findIndex(
		(quiz) => quiz.time > currentTime.value
	)
	if (nextQuizIndex !== -1) {
		nextQuiz.value = props.quizzes[nextQuizIndex]
	} else {
		nextQuiz.value = {}
	}
}

const fileURL = computed(() => {
	return props.file
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
	updateNextQuiz()
}

const toggleFullscreen = () => {
	if (document.fullscreenElement) {
		document.exitFullscreen()
	} else {
		videoContainer.value.requestFullscreen()
	}
}

const getQuizMarkerStyle = (time) => {
	const percentage = ((time - 5) / Math.ceil(duration.value)) * 100
	return {
		left: `${percentage}%`,
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
	-webkit-appearance: none;
	appearance: none;
	border-radius: 10px;
	background-color: theme('colors.gray.600');
	cursor: pointer;
}

.duration-slider::-webkit-slider-thumb {
	width: 2px;
	border-radius: 50%;
	-webkit-appearance: none;
	background-color: theme('colors.white');
}

@media screen and (-webkit-min-device-pixel-ratio: 0) {
	input[type='range'] {
		overflow: hidden;
		width: 100%;
		-webkit-appearance: none;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		cursor: pointer;
		box-shadow: -500px 0 0 500px theme('colors.white');
	}
}
</style>
