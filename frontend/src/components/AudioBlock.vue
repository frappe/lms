<template>
	<div class="audio-root">
		<audio
			ref="audio"
			controlsList="nodownload"
			@play="isPlaying = true"
			@pause="isPlaying = false"
			@ended="isPlaying = false"
			@loadedmetadata="duration = audio.duration"
			@timeupdate="currentTime = audio.currentTime"
		>
			<source :src="safeUrl(encodeLink(file))" :type="audioMime(file)" />
		</audio>
		<div
			data-testid="audio-player"
			class="flex h-11 w-full max-w-lg items-center gap-x-2.5 overflow-hidden rounded-7 bg-surface-gray-2 pe-1.5 ps-1"
		>
			<Button
				variant="outline"
				size="lg"
				class="shrink-0"
				:label="isPlaying ? __('Pause') : __('Play')"
				@click="togglePlay"
			>
				<template #icon>
					<span
						:class="isPlaying ? 'lucide-pause' : 'lucide-play'"
						class="size-4 text-ink-gray-9"
						aria-hidden="true"
					/>
				</template>
			</Button>
			<span class="audio-elapsed shrink-0 text-xs tabular-nums text-ink-gray-7">
				{{ formatTime(currentTime) }}
			</span>
			<input
				type="range"
				min="0"
				:max="duration || 0"
				step="0.1"
				:value="currentTime"
				:aria-label="__('Seek')"
				:aria-valuetext="`${formatTime(currentTime)} / ${formatTime(duration)}`"
				:style="{ '--played': `${played}%` }"
				class="audio-seek min-w-0 flex-1"
				@input="seek"
			/>
			<span class="shrink-0 text-xs tabular-nums text-ink-gray-7">
				{{ formatTime(duration) }}
			</span>
			<Button
				variant="ghost"
				size="sm"
				class="w-14 shrink-0 justify-center tabular-nums"
				:aria-label="__('Playback speed {0}x').format(rate)"
				@click="cycleRate"
			>
				{{ rate }}x
			</Button>
			<!-- A narrow player drops these so the seek bar keeps its room; a phone has its own volume. -->
			<Button
				variant="ghost"
				size="sm"
				class="audio-mute shrink-0"
				:label="isMuted ? __('Unmute') : __('Mute')"
				@click="toggleMute"
			>
				<template #icon>
					<span
						:class="isMuted ? 'lucide-volume-x' : 'lucide-volume-2'"
						class="size-4 text-ink-gray-7"
						aria-hidden="true"
					/>
				</template>
			</Button>
		</div>
	</div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Button } from 'frappe-ui'
import { safeUrl } from '@/utils/safeUrl'
import { audioMime, encodeLink } from '@/utils/audio'

const RATES = [1, 1.25, 1.5, 2]

// This block's own element: a lesson can hold several audio blocks.
const audio = ref(null)
const isPlaying = ref(false)
const isMuted = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const rate = ref(1)

defineProps({
	file: {
		type: String,
		required: true,
	},
})

const played = computed(() =>
	duration.value ? (currentTime.value / duration.value) * 100 : 0
)

const togglePlay = () => {
	if (audio.value.paused) audio.value.play()
	else audio.value.pause()
}

const seek = (event) => {
	audio.value.currentTime = Number(event.target.value)
	currentTime.value = audio.value.currentTime
}

const cycleRate = () => {
	rate.value = RATES[(RATES.indexOf(rate.value) + 1) % RATES.length]
	audio.value.playbackRate = rate.value
}

const toggleMute = () => {
	audio.value.muted = !audio.value.muted
	isMuted.value = audio.value.muted
}

const formatTime = (time) => {
	if (!Number.isFinite(time)) time = 0
	const minutes = Math.floor(time / 60)
	const seconds = Math.floor(time % 60)
	return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}
</script>

<style scoped>
/* Sized by the space it is given, not the screen: a lesson column or an assignment card can be narrow on a wide screen. */
.audio-root {
	container-type: inline-size;
}

@container (max-width: 380px) {
	.audio-elapsed,
	.audio-mute {
		display: none;
	}
}

/* The played part is drawn in the track itself, so it needs no second element. */
.audio-seek {
	-webkit-appearance: none;
	appearance: none;
	height: 4px;
	border-radius: 2px;
	background: linear-gradient(
		to right,
		var(--ink-gray-9) var(--played),
		var(--surface-gray-4) var(--played)
	);
	cursor: pointer;
}

.audio-seek::-webkit-slider-thumb {
	-webkit-appearance: none;
	width: 12px;
	height: 12px;
	border-radius: 999px;
	background: var(--ink-gray-9);
}

.audio-seek::-moz-range-thumb {
	width: 12px;
	height: 12px;
	border: 0;
	border-radius: 999px;
	background: var(--ink-gray-9);
}
</style>
