<template>
	<div class="p-5">
		<div class="flex items-center gap-3 rounded-lg bg-surface-amber-2 p-3">
			<div class="grid size-7 shrink-0 place-items-center text-ink-amber-6">
				<span
					:class="notFound ? 'lucide-file-question' : 'lucide-lock-keyhole'"
					class="size-4"
					aria-hidden="true"
				/>
			</div>
			<div class="flex min-w-0 flex-1 flex-col">
				<span class="text-p-sm-medium text-ink-gray-8">
					{{ notFound ? __('Lesson not found') : __('This lesson is locked') }}
				</span>
				<span class="text-p-sm text-ink-gray-6">
					{{
						notFound
							? __('There is no lesson at this address in this course.')
							: __('Finish the lessons before it to unlock this one.')
					}}
				</span>
			</div>
			<template v-if="redirect">
				<span
					class="shrink-0 text-p-xs text-ink-gray-5 tabular-nums"
					aria-hidden="true"
				>
					{{ __('{0}s').format(secondsLeft) }}
				</span>
				<Button
					theme="gray"
					variant="subtle"
					class="border border-outline-gray-2 bg-surface-base hover:bg-surface-base hover:border-outline-gray-3 active:bg-surface-gray-2 focus-visible:bg-surface-base"
					:label="__('Go now')"
					@click="goNow()"
				/>
			</template>
		</div>
		<div class="sr-only" role="status">{{ announcement }}</div>
	</div>
</template>

<script setup>
import { Button } from 'frappe-ui'
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
	redirect: {
		type: Boolean,
		default: true,
	},
	seconds: {
		type: Number,
		default: 3,
	},
	// The gate answers a lesson number that resolves to nothing with the same
	// redirecting payload, and telling that student to finish the earlier lessons
	// to unlock this one would be a lie.
	notFound: {
		type: Boolean,
		default: false,
	},
})

const emit = defineEmits(['done'])

const secondsLeft = ref(props.seconds)
const announcement = ref('')
let timer = null
let announceTimer = null

const stop = () => {
	if (timer) {
		clearInterval(timer)
		timer = null
	}
	if (announceTimer) {
		clearTimeout(announceTimer)
		announceTimer = null
	}
}

// role="status" implies aria-atomic, so a per-second countdown queues one full
// polite announcement per tick and crowds out the sentence explaining the lock.
// The visible counter is hidden from AT and the reason is announced once.
//
// The region is rendered unconditionally, outside the redirect block, so it is
// already in the accessibility tree before it has content. Populating it in the
// same frame as its own insertion reads as initial content, which most screen
// readers do not announce at all, so the text lands a frame later.
const ANNOUNCE_DELAY = 100

const announce = () => {
	announcement.value = ''
	announceTimer = setTimeout(() => {
		announcement.value = props.notFound
			? __(
					'Lesson not found. Taking you to your current lesson in {0} seconds.'
			  ).format(props.seconds)
			: __(
					'This lesson is locked. Taking you to your current lesson in {0} seconds.'
			  ).format(props.seconds)
	}, ANNOUNCE_DELAY)
}

// The counter runs down rather than the page jumping on arrival, so the student
// reads why they were moved instead of landing on an unexplained lesson.
const start = () => {
	stop()
	secondsLeft.value = props.seconds
	announce()
	timer = setInterval(() => {
		secondsLeft.value -= 1
		if (secondsLeft.value > 0) return
		stop()
		emit('done')
	}, 1000)
}

// Skipping the wait must also kill the interval, or it fires again on a page the
// student has already left.
const goNow = () => {
	stop()
	emit('done')
}

watch(
	() => props.redirect,
	(redirect) => {
		if (redirect) start()
		else stop()
	},
	{ immediate: true }
)

onBeforeUnmount(stop)
</script>
