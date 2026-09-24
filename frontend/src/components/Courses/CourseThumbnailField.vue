<template>
	<div
		class="flex flex-col gap-y-1.5"
		role="group"
		:aria-labelledby="thumbnailLabelId"
	>
		<InputLabel :id="thumbnailLabelId" :label="__('Course thumbnail')" />

		<div v-if="hasImage" class="flex flex-col gap-4 sm:flex-row sm:items-start">
			<div
				class="relative aspect-[750/422] w-full shrink-0 grid place-items-center overflow-hidden rounded-6 border border-outline-gray-2 bg-surface-gray-2 sm:w-56"
			>
				<img :src="safeUrl(doc.image)" alt="" class="size-full object-cover" />
			</div>

			<div class="min-w-0 space-y-3 sm:flex-1">
				<div class="space-y-0.5 text-sm">
					<div class="text-ink-gray-9 font-medium break-all leading-5">
						{{ filename }}
						<span class="ms-2 text-ink-gray-5 font-normal">
							{{ metaLabel }}
						</span>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<FileUploader
						:fileTypes="['.jpg,.jpeg,.gif,.png']"
						:private="false"
						@success="(file) => onUploaded(file.file_url)"
						@failure="onUploadFailure"
					>
						<template #default="{ openFileSelector, uploading }">
							<Button
								class="text-p-base-medium"
								:loading="uploading"
								@click="openFileSelector"
							>
								<template #prefix>
									<span class="lucide-upload size-4" />
								</template>
								{{ uploading ? __('Uploading') : __('Replace') }}
							</Button>
						</template>
					</FileUploader>
					<Button variant="ghost" theme="red" @click="removeImage">
						<template #prefix>
							<span class="lucide-trash-2 size-4" />
						</template>
						{{ __('Remove') }}
					</Button>
				</div>
				<p class="text-p-xs text-ink-gray-5">
					{{ __('Remove the image to pick a color instead.') }}
				</p>
			</div>
		</div>

		<FileUploader
			v-else
			class="flex flex-col gap-4 sm:flex-row sm:items-start"
			:fileTypes="['.jpg,.jpeg,.gif,.png']"
			:private="false"
			@success="(file) => onUploaded(file.file_url)"
			@failure="onUploadFailure"
		>
			<template #default="{ openFileSelector, uploading }">
				<div
					class="relative aspect-[750/422] w-full shrink-0 grid place-items-center overflow-hidden rounded-6 border border-outline-gray-2 bg-surface-gray-2 sm:w-56"
					:style="
						doc?.card_gradient ? { backgroundColor: wellColor } : undefined
					"
				>
					<button
						type="button"
						class="grid size-full place-items-center transition hover:opacity-95 focus-visible:-outline-offset-2"
						:aria-label="__('Upload a course thumbnail image')"
						@click="openFileSelector"
					>
						<span
							v-if="!doc?.card_gradient"
							class="flex flex-col items-center gap-1 text-ink-gray-5"
						>
							<span class="lucide-image size-5" aria-hidden="true" />
							<span class="text-xs">{{ __('No thumbnail') }}</span>
						</span>
					</button>
				</div>

				<div class="min-w-0 space-y-3 sm:flex-1">
					<div class="space-y-2">
						<div class="text-xs text-ink-gray-5">
							{{ __('Color') }}
						</div>
						<div class="flex items-center gap-2 flex-wrap">
							<button
								v-for="c in colors"
								:key="c"
								type="button"
								class="size-8 rounded-5 border border-outline-gray-2 transition"
								:class="
									doc?.card_gradient === c
										? 'ring-2 ring-offset-2 ring-outline-gray-4'
										: 'hover:scale-105'
								"
								:style="{ backgroundColor: cardColor(c) }"
								:aria-label="c"
								@click="pickColor(c)"
							/>
						</div>
					</div>
					<div class="flex flex-col items-start gap-1.5">
						<Button :loading="uploading" @click="openFileSelector">
							<template #prefix>
								<span class="lucide-upload size-4" />
							</template>
							{{ uploading ? __('Uploading') : __('Upload image instead') }}
						</Button>
						<p class="text-p-xs text-ink-gray-5">
							{{ __('Upload an image to replace the color.') }}
						</p>
					</div>
				</div>
			</template>
		</FileUploader>
	</div>
</template>

<script setup lang="ts">
import {
	Button,
	FileUploader,
	UploadError,
	createResource,
	toast,
} from 'frappe-ui'
import { computed, inject, ref, useId, watch } from 'vue'
import type { CourseFormContext, Resource } from '@/types'
import { InputLabel } from 'frappe-ui/experimental'
import { safeUrl } from '@/utils/safeUrl'

// Layout mirrors VideoPreviewField (the sibling field in the same form row):
// the well is full-width on phones and settles back to w-56 from `sm` up, so the
// two fields line up instead of one being a fixed 224px box that can't reflow.
const thumbnailLabelId = useId()
const { resource, markDirty } = inject<CourseFormContext>('courseForm')!

const doc = computed(() => resource.doc)

const colors = [
	'Red',
	'Blue',
	'Green',
	'Amber',
	'Purple',
	'Cyan',
	'Orange',
	'Violet',
	'Pink',
	'Teal',
	'Gray',
	'Yellow',
] as const

const hasImage = computed<boolean>(() => Boolean(doc.value?.image))

// token-exempt: previews CourseCard's gradient, which keeps the raw ramp in both themes.
const cardColor = (c: string): string => `var(--${c.toLowerCase()}-400)`

const wellColor = computed<string>(() => {
	const c = doc.value?.card_gradient
	return c ? cardColor(String(c)) : ''
})

const filename = computed<string>(() => {
	const url = doc.value?.image || ''
	const last = url.split('/').pop() || ''
	try {
		return decodeURIComponent(last)
	} catch {
		return last
	}
})

const dims = ref<{ w: number; h: number } | null>(null)
const fileSize = ref<number | null>(null)

const fileMeta = createResource({
	url: 'frappe.client.get_value',
	makeParams: () => ({
		doctype: 'File',
		filters: { file_url: doc.value?.image },
		fieldname: 'file_size',
	}),
	auto: false,
	onSuccess(data: { file_size?: number } | null) {
		fileSize.value = data?.file_size ?? null
	},
}) as Resource<{ file_size?: number } | null>

watch(
	() => doc.value?.image,
	(url) => {
		dims.value = null
		fileSize.value = null
		if (!url) return
		const img = new window.Image()
		img.onload = () => {
			dims.value = { w: img.naturalWidth, h: img.naturalHeight }
		}
		img.src = url
		fileMeta.reload()
	},
	{ immediate: true }
)

function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`
	if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
	return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const metaLabel = computed<string>(() => {
	const parts: string[] = []
	if (dims.value) parts.push(`${dims.value.w} × ${dims.value.h}`)
	if (fileSize.value) parts.push(formatBytes(fileSize.value))
	return parts.join(' · ')
})

function onUploaded(url: string) {
	if (!doc.value) return
	doc.value.image = url
	markDirty()
}

function removeImage() {
	if (!doc.value) return
	doc.value.image = ''
	markDirty()
}

function pickColor(c: string) {
	if (!doc.value) return
	doc.value.card_gradient = c
	markDirty()
}

function onUploadFailure(error: unknown) {
	const message =
		error instanceof UploadError
			? error.messages[0] || error.message
			: __('Error uploading file')
	toast.error(message)
}
</script>
