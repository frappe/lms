<template>
	<div class="flex flex-col min-h-0 h-full">
		<!-- Setup phase -->
		<template v-if="phase === 'setup'">
			<div
				v-if="cameraError"
				class="bg-surface-red-1 text-ink-red-6 rounded-lg p-3 text-sm leading-5 mb-3"
			>
				{{ cameraError }}
			</div>

			<div
				class="relative rounded-xl overflow-hidden bg-surface-gray-3 flex-1 min-h-0"
			>
				<video
					ref="videoEl"
					autoplay
					muted
					playsinline
					class="absolute inset-0 w-full h-full object-cover"
				/>

				<!-- Status overlay -->
				<div
					v-if="setupStatus !== 'ready'"
					class="absolute bottom-0 inset-x-0 flex items-center justify-center gap-1.5 py-2 text-xs font-medium"
					:class="{
						'bg-black/50 text-white':
							setupStatus === 'loading' || setupStatus === 'detecting',
						'bg-surface-red-2/90 text-ink-red-6':
							setupStatus === 'no_face' || setupStatus === 'multiple_faces',
					}"
				>
					<span
						v-if="setupStatus === 'loading'"
						class="lucide-loader-2 size-3.5 animate-spin"
					/>
					<span
						v-else-if="setupStatus === 'no_face'"
						class="lucide-alert-circle size-3.5"
					/>
					<span
						v-else-if="setupStatus === 'multiple_faces'"
						class="lucide-users size-3.5"
					/>
					<span v-else class="lucide-scan-face size-3.5" />
					{{ setupStatusLabel }}
				</div>

				<!-- Ready indicator -->
				<div
					v-else
					class="absolute inset-0 ring-2 ring-inset ring-ink-green-5 rounded-xl pointer-events-none"
				>
					<div
						class="absolute top-2 end-2 flex items-center gap-1 bg-surface-green-1 text-ink-green-6 text-xs font-medium px-2 py-1 rounded-full"
					>
						<span class="lucide-check size-3" />
						{{ __('Ready') }}
					</div>
				</div>
			</div>
		</template>

		<!-- Monitoring phase: the count stays inline in the status bar, the camera
		     itself floats over the quiz so the student can see what is being
		     watched. Teleported to the body so no scroll container or stacking
		     context along the way can clip it. -->
		<template v-if="phase === 'monitoring'">
			<Teleport to="body">
				<div class="fixed bottom-4 end-4 z-50 flex flex-col items-end gap-2">
					<!-- Collapsed to nothing rather than hidden: detection reads frames
					     off this element, and a display:none video stops feeding them.
					     Minimising is meant to spare the student the distraction, not
					     to stop the proctoring they agreed to. -->
					<div
						class="overflow-hidden rounded-xl bg-surface-base shadow-lg transition-all"
						:class="
							minimized ? 'pointer-events-none size-0 opacity-0' : 'w-44 border'
						"
					>
						<div class="relative">
							<video
								ref="videoEl"
								autoplay
								muted
								playsinline
								class="block aspect-[4/3] w-full bg-surface-gray-3 object-cover"
							/>
							<button
								type="button"
								class="absolute end-1.5 top-1.5 rounded-md bg-black/50 p-1 text-white"
								:aria-label="__('Minimise camera')"
								@click="minimized = true"
							>
								<span class="lucide-minus size-3.5" aria-hidden="true" />
							</button>
						</div>
					</div>

					<button
						v-if="minimized"
						type="button"
						class="flex items-center gap-1.5 rounded-md border bg-surface-base px-2.5 py-1.5 text-xs font-medium text-ink-gray-7 shadow-lg"
						:aria-label="__('Show camera')"
						@click="minimized = false"
					>
						<span class="lucide-camera size-3.5" aria-hidden="true" />
						{{ __('Show camera') }}
					</button>
				</div>
			</Teleport>

			<div
				class="flex items-center gap-x-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
				:class="
					violationCount > 0
						? 'bg-surface-red-1 text-ink-red-6'
						: 'bg-surface-green-1 text-ink-green-6'
				"
			>
				<span class="lucide-camera size-4" />
				{{ violationCount }} / {{ maxViolations }}
				{{ maxViolations == 1 ? __('violation') : __('violations') }}
			</div>
		</template>
	</div>
</template>

<script setup>
import * as faceapi from 'face-api.js'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
	maxViolations: { type: Number, required: true },
	active: { type: Boolean, default: false },
	violationCount: { type: Number, default: 0 },
})

const emit = defineEmits([
	'camera-ready',
	'camera-lost',
	'camera-denied',
	'violation',
	'warning',
])

const videoEl = ref(null)

// Whether the floating preview is collapsed during the quiz. Purely visual —
// the stream and the detection loop keep running either way.
const minimized = ref(false)
const phase = ref('setup')
const setupStatus = ref('loading')
const cameraError = ref('')

let stream = null
let setupInterval = null
let monitorInterval = null
let focusBlurTimer = null
let noFaceStreak = 0
let multiFaceStreak = 0
// When each condition was first warned about, so the violation can be held back
// until it has actually persisted. 0 means "not currently warned".
let noFaceWarnedAt = 0
let multiFaceWarnedAt = 0
const STREAK_THRESHOLD = 3
// How long a warned condition has to persist before it counts as a violation.
const ESCALATION_GAP = 10_000
// Wide enough to recognise a face and read a room, small enough that forty of them
// still make a reasonable request.
const FRAME_WIDTH = 320
const FRAME_QUALITY = 0.6
let cameraReadyEmitted = false

const setupStatusLabel = computed(() => {
	const labels = {
		loading: __('Loading camera…'),
		detecting: __('Position your face in the frame'),
		no_face: __('No face detected — look at the camera'),
		multiple_faces: __('Multiple faces detected — only one person allowed'),
		ready: __('Ready'),
	}
	return labels[setupStatus.value] || ''
})

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(async () => {
	await startCamera()
	// Monitoring instance mounts with active=true — skip setup, go straight to monitoring
	if (props.active) {
		clearInterval(setupInterval)
		phase.value = 'monitoring'
		// Wait for the monitoring <video> element to mount, then re-attach the stream
		await nextTick()
		if (videoEl.value && stream) videoEl.value.srcObject = stream
		startMonitoring()
	}
})

onUnmounted(() => {
	stopAll()
})

// ─── Setup phase ─────────────────────────────────────────────────────────────

const startCamera = async () => {
	try {
		stream = await navigator.mediaDevices.getUserMedia({ video: true })
	} catch {
		cameraError.value = __(
			'Camera access was denied. Please allow camera access and reload.'
		)
		emit('camera-denied')
		return
	}

	if (videoEl.value) {
		videoEl.value.srcObject = stream
	}

	try {
		await faceapi.nets.tinyFaceDetector.loadFromUri(
			'/assets/lms/frontend/models'
		)
	} catch {
		cameraError.value = __(
			'Failed to load face detection models. Please reload.'
		)
		return
	}

	setupStatus.value = 'detecting'
	setupInterval = setInterval(runSetupDetection, 800)
}

const runSetupDetection = async () => {
	if (!videoEl.value || videoEl.value.readyState < 2) return
	const detections = await faceapi.detectAllFaces(
		videoEl.value,
		new faceapi.TinyFaceDetectorOptions()
	)
	if (detections.length === 1) {
		setupStatus.value = 'ready'
	} else if (detections.length === 0) {
		setupStatus.value = 'no_face'
	} else {
		setupStatus.value = 'multiple_faces'
	}
}

// Emit camera-ready when face detected, camera-lost when it disappears again
watch(setupStatus, (status, prev) => {
	if (status === 'ready' && !cameraReadyEmitted) {
		cameraReadyEmitted = true
		emit('camera-ready')
	} else if (status !== 'ready' && prev === 'ready') {
		cameraReadyEmitted = false
		emit('camera-lost')
	}
})

// ─── Switch to monitoring when quiz starts ────────────────────────────────────

watch(
	() => props.active,
	async (active) => {
		if (active) {
			clearInterval(setupInterval)
			phase.value = 'monitoring'
			await nextTick()
			if (videoEl.value && stream) videoEl.value.srcObject = stream
			startMonitoring()
		}
	}
)

// ─── Monitoring phase ─────────────────────────────────────────────────────────

const startMonitoring = () => {
	monitorInterval = setInterval(runMonitorDetection, 2000)
	document.addEventListener('visibilitychange', onVisibilityChange)
	window.addEventListener('blur', onWindowBlur)
	window.addEventListener('focus', onWindowFocus)
	const videoTrack = stream?.getVideoTracks?.()?.[0]
	if (videoTrack) videoTrack.addEventListener('ended', onCameraDisconnect)
}

const runMonitorDetection = async () => {
	if (!videoEl.value || videoEl.value.readyState < 2) return
	const detections = await faceapi.detectAllFaces(
		videoEl.value,
		new faceapi.TinyFaceDetectorOptions()
	)
	if (detections.length === 0) {
		multiFaceStreak = 0
		multiFaceWarnedAt = 0
		noFaceStreak++
		escalate('no_face')
	} else if (detections.length > 1) {
		noFaceStreak = 0
		noFaceWarnedAt = 0
		multiFaceStreak++
		escalate('multiple_faces')
	} else {
		noFaceStreak = 0
		multiFaceStreak = 0
		noFaceWarnedAt = 0
		multiFaceWarnedAt = 0
	}
}

/**
 * Warn first, and only call it a violation if nothing has changed ESCALATION_GAP
 * later. Looking away for a moment, or a detector that drops a frame, is not
 * what proctoring is for — the warning is the student's chance to correct it.
 *
 * While the condition persists the violation repeats on the same interval, so
 * walking away for a minute still costs more than glancing at the door.
 */
const escalate = (kind) => {
	const noFace = kind === 'no_face'
	const streak = noFace ? noFaceStreak : multiFaceStreak
	const warnedAt = noFace ? noFaceWarnedAt : multiFaceWarnedAt
	const now = Date.now()

	if (!warnedAt) {
		// A single missed frame is noise; wait for the condition to hold.
		if (streak < STREAK_THRESHOLD) return
		if (noFace) noFaceWarnedAt = now
		else multiFaceWarnedAt = now
		emit('warning', kind, captureFrame())
		return
	}

	if (now - warnedAt < ESCALATION_GAP) return
	if (noFace) noFaceWarnedAt = now
	else multiFaceWarnedAt = now
	emit('violation', kind, captureFrame())
}

/**
 * A still of what the camera saw as the event fired, small enough to travel with
 * the event payload and to sit in a table afterwards.
 *
 * Returns null rather than throwing when there is nothing to draw — a
 * disconnected camera leaves an element that will not paint, and the event it
 * raised still stands on its own. Only the picture is lost.
 */
const captureFrame = () => {
	const video = videoEl.value
	if (!video || video.readyState < 2 || !video.videoWidth) return null
	try {
		const canvas = document.createElement('canvas')
		canvas.width = FRAME_WIDTH
		canvas.height = Math.round(
			(video.videoHeight / video.videoWidth) * FRAME_WIDTH
		)
		canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
		return canvas.toDataURL('image/jpeg', FRAME_QUALITY)
	} catch {
		return null
	}
}

const onVisibilityChange = () => {
	// The element keeps its frames while the tab is hidden, so the still shows
	// what the camera saw at the moment they switched away.
	if (document.visibilityState === 'hidden')
		emit('violation', 'tab_switch', captureFrame())
}

const onWindowBlur = () => {
	// Tab switch is already handled by visibilitychange — skip to avoid duplicate events
	if (document.visibilityState === 'hidden') return
	focusBlurTimer = setTimeout(
		() => emit('violation', 'focus_loss', captureFrame()),
		10_000
	)
}

const onWindowFocus = () => {
	if (focusBlurTimer) {
		clearTimeout(focusBlurTimer)
		focusBlurTimer = null
	}
}

const onCameraDisconnect = () =>
	emit('violation', 'camera_disconnect', captureFrame())

// ─── Cleanup ──────────────────────────────────────────────────────────────────

const stopAll = () => {
	clearInterval(setupInterval)
	clearInterval(monitorInterval)
	clearTimeout(focusBlurTimer)
	document.removeEventListener('visibilitychange', onVisibilityChange)
	window.removeEventListener('blur', onWindowBlur)
	window.removeEventListener('focus', onWindowFocus)
	stream?.getTracks?.().forEach((t) => t.stop())
}
</script>
