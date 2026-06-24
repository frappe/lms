<template>
	<div class="space-y-1.5">
		<FormLabel v-if="label" :label="__(label)" :required="required" />
		<div class="flex items-start gap-4">
			<div
				class="relative aspect-[750/422] w-56 shrink-0 grid place-items-center overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-gray-2"
			>
				<iframe
					v-if="preview.type === 'youtube'"
					:src="preview.src"
					class="size-full"
					frameborder="0"
					allow="accelerometer; encrypted-media; picture-in-picture"
					allowfullscreen
				/>
				<video
					v-else-if="isUploadedVideo && !videoError"
					:src="preview.src"
					controls
					class="size-full bg-black object-contain"
					@error="videoError = true"
				/>
				<div
					v-else-if="isUploadedVideo && videoError"
					class="flex flex-col items-center gap-1 px-3 text-center"
				>
					<span class="lucide-circle-check size-5 text-ink-green-600" />
					<span class="text-xs text-ink-gray-5">
						{{ __("Saved — this format can't be previewed here.") }}
					</span>
				</div>
				<span v-else class="lucide-video size-6 text-ink-gray-4" />
				<button
					v-if="modelValue && !isUploadedVideo"
					type="button"
					class="absolute end-1 top-1 grid size-6 place-items-center rounded bg-surface-base/90 shadow"
					@click="update('')"
				>
					<span class="lucide-x size-4 text-ink-gray-7" />
				</button>
			</div>

			<!-- Uploaded video: thumbnail-style controls (no raw filename in an input). -->
			<div v-if="isUploadedVideo" class="flex-1 space-y-2">
				<div class="text-p-sm-medium text-ink-gray-7 truncate">
					{{ fileName }}
				</div>
				<div class="flex items-center gap-2">
					<FileUploader
						:fileTypes="['video/mp4', 'video/webm', 'video/ogg']"
						:validateFile="validatePlayableVideo"
						@success="(file: { file_url: string }) => update(file.file_url)"
						@failure="onUploadFailure"
					>
						<template #default="{ openFileSelector, uploading, progress }">
							<Button :loading="uploading" @click="openFileSelector">
								<template #prefix>
									<span class="lucide-upload size-4" />
								</template>
								{{ uploading ? `${progress}%` : __('Replace') }}
							</Button>
						</template>
					</FileUploader>
					<Button theme="red" variant="ghost" @click="update('')">
						<template #prefix>
							<span class="lucide-trash-2 size-4" />
						</template>
						{{ __('Remove') }}
					</Button>
				</div>
				<p class="text-p-sm text-ink-gray-5">
					{{
						__(
							'Uploaded video — students see it on the course page. Remove it to use a YouTube link instead.'
						)
					}}
				</p>
			</div>

			<!-- Empty or YouTube link: URL input + upload. -->
			<div v-else class="flex-1 space-y-2">
				<FormControl
					type="text"
					v-model="urlInput"
					:placeholder="__('Paste a YouTube link')"
					variant="outline"
				/>
				<FileUploader
					:fileTypes="['video/*']"
					@success="(file: { file_url: string }) => update(file.file_url)"
				>
					<template #default="{ openFileSelector, uploading, progress }">
						<Button :loading="uploading" @click="openFileSelector">
							<template #prefix>
								<span class="lucide-upload size-4" />
							</template>
							{{ uploading ? `${progress}%` : __('Upload video') }}
						</Button>
					</template>
				</FileUploader>
				<p class="text-p-sm text-ink-gray-5">
					{{
						preview.type === 'youtube'
							? __(
									'YouTube link added — students see it embedded on the course page. Clear the field to upload a file instead.'
							  )
							: __(
									'Paste a YouTube link, or upload a video file (MP4, WebM, or OGG) to show a preview on the course page.'
							  )
					}}
				</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Button, FileUploader, FormControl, FormLabel, toast } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { getVideoPreview, getYouTubeId } from '@/utils/video'

// Only formats browsers can actually play — reject the rest at upload time so a
// course never ends up with an unplayable preview (e.g. .MOV/H.265).
const PLAYABLE_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg']
const PLAYABLE_VIDEO_EXTS = ['mp4', 'webm', 'ogg', 'ogv']

// Probe whether the browser can actually decode the file — extension/MIME isn't
// enough (e.g. an .mp4 may contain HEVC/H.265, which Chrome/Firefox can't play).
function canBrowserPlay(file: File): Promise<boolean> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file)
		const video = document.createElement('video')
		let settled = false
		const finish = (ok: boolean) => {
			if (settled) return
			settled = true
			URL.revokeObjectURL(url)
			video.removeAttribute('src')
			resolve(ok)
		}
		video.preload = 'metadata'
		video.muted = true
		video.onloadeddata = () => finish(true)
		video.oncanplay = () => finish(true)
		video.onerror = () => finish(false)
		// Guard against browsers that fire neither for an undecodable codec.
		setTimeout(() => finish(video.videoWidth > 0), 4000)
		video.src = url
	})
}

async function validatePlayableVideo(file: File): Promise<string | void> {
	const ext = file.name.split('.').pop()?.toLowerCase() || ''
	const mimeOk = !file.type || PLAYABLE_VIDEO_TYPES.includes(file.type)
	if (!mimeOk || !PLAYABLE_VIDEO_EXTS.includes(ext)) {
		return __(
			"Please upload an MP4, WebM, or OGG video — formats like .MOV can't be played in the browser."
		)
	}
	if (!(await canBrowserPlay(file))) {
		return __(
			"This video's codec can't be played in browsers (e.g. HEVC/H.265). Please upload an H.264 MP4 or a WebM."
		)
	}
}

function onUploadFailure(error: unknown) {
	const e = error as { messages?: string[]; message?: string } | string
	const msg =
		typeof e === 'string'
			? e
			: e?.messages?.[0] || e?.message || __('Upload failed')
	toast.error(msg)
}

const props = defineProps<{
	modelValue?: string
	label?: string
	required?: boolean
}>()

const emit = defineEmits<{
	(e: 'update:modelValue', value: string): void
}>()

const preview = computed(() => getVideoPreview(props.modelValue))

// Whether the current value is an actually-uploaded video. Uploads are stored as
// a /files/ (or /private/files/) path; anything else is a link. We key off the
// path — NOT getVideoPreview's 'file' type — so a half-typed link (e.g. just "h")
// doesn't momentarily classify as a file and swap the URL input out mid-keystroke.
const isUploadedVideo = computed<boolean>(() => {
	const v = props.modelValue || ''
	return v.startsWith('/files/') || v.startsWith('/private/files/')
})

// Reset the in-browser playback error whenever the source changes.
const videoError = ref<boolean>(false)
watch(
	() => props.modelValue,
	() => {
		videoError.value = false
	}
)

const fileName = computed<string>(() => {
	const v = props.modelValue || ''
	return decodeURIComponent(v.split('/').pop() || '')
})

// Show a proper, full YouTube URL in the input even when the value is stored as
// a bare id / share fragment (legacy). Storage is left untouched — only a bare
// id (no scheme, no path) is expanded for display; full URLs and file paths
// pass through, so typing a URL isn't rewritten under the cursor.
const urlInput = computed<string>({
	get() {
		const v = props.modelValue
		if (!v) return ''
		const id = getYouTubeId(v)
		if (id && !/^https?:\/\//.test(v) && !v.startsWith('/')) {
			return `https://www.youtube.com/watch?v=${id}`
		}
		return v
	},
	set(value: string) {
		update(value)
	},
})

function update(value: string) {
	emit('update:modelValue', value || '')
}
</script>
