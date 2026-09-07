<template>
	<div
		class="flex flex-col gap-y-1.5"
		role="group"
		:aria-labelledby="thumbnailLabelId"
	>
		<InputLabel :id="thumbnailLabelId" :label="__('Course thumbnail')" />

		<div class="flex flex-col gap-4 sm:flex-row sm:items-start">
			<div
				class="relative aspect-[750/422] w-full shrink-0 grid place-items-center overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-gray-2 sm:w-56"
				:style="
					!hasImage && doc?.card_gradient
						? { backgroundColor: wellColor }
						: undefined
				"
			>
				<img
					v-if="hasImage"
					:src="safeUrl(doc.image)"
					alt=""
					class="size-full object-cover"
				/>
				<button
					v-else
					type="button"
					class="grid size-full place-items-center transition hover:opacity-95 focus-visible:-outline-offset-2"
					:aria-label="__('Upload a course thumbnail image')"
					@click="openFilePicker"
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
				<template v-if="hasImage">
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
							ref="uploaderRef"
							:fileTypes="['.jpg,.jpeg,.gif,.png']"
							:uploadArgs="{ private: false }"
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
				</template>

				<template v-else>
					<div class="space-y-2">
						<div class="text-xs text-ink-gray-5">
							{{ __('Color') }}
						</div>
						<div class="flex items-center gap-2 flex-wrap">
							<button
								v-for="c in colors"
								:key="c"
								type="button"
								class="size-8 rounded-md border border-outline-gray-2 transition"
								:class="
									doc?.card_gradient === c
										? 'ring-2 ring-offset-2 ring-outline-gray-4'
										: 'hover:scale-105'
								"
								:style="{ backgroundColor: `var(--${c.toLowerCase()}-400)` }"
								:aria-label="c"
								@click="pickColor(c)"
							/>
						</div>
					</div>
					<div class="flex flex-col items-start gap-1.5">
						<FileUploader
							ref="uploaderRef"
							:fileTypes="['.jpg,.jpeg,.gif,.png']"
							:uploadArgs="{ private: false }"
							@success="(file) => onUploaded(file.file_url)"
							@failure="onUploadFailure"
						>
							<template #default="{ openFileSelector, uploading }">
								<Button :loading="uploading" @click="openFileSelector">
									<template #prefix>
										<span class="lucide-upload size-4" />
									</template>
									{{ uploading ? __('Uploading') : __('Upload image instead') }}
								</Button>
							</template>
						</FileUploader>
						<p class="text-p-xs text-ink-gray-5">
							{{ __('Upload an image to replace the color.') }}
						</p>
					</div>
				</template>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Button, FileUploader, createResource, toast } from 'frappe-ui'
import { computed, inject, ref, useId, watch } from 'vue'
import type { CourseFormContext, Resource } from '@/types'
import { InputLabel } from '@/components/Form/labeling'
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

const wellColor = computed<string>(() => {
	const c = doc.value?.card_gradient
	if (!c) return ''
	return `var(--${String(c).toLowerCase()}-400)`
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

const uploaderRef = ref<{ inputRef: () => HTMLInputElement | null } | null>(
	null
)

// Only the empty well is clickable, and only to add an image. It used to also
// delete the thumbnail when one was set, which gave a control named after the
// image a destructive action — worse now that the well spans the viewport on a
// phone. Removing stays with the labelled Remove button.
function openFilePicker() {
	uploaderRef.value?.inputRef?.()?.click?.()
}

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

function onUploadFailure(error: any) {
	let message = __('Error uploading file')
	if (error?._server_messages) {
		try {
			message = JSON.parse(JSON.parse(error._server_messages)[0]).message
		} catch {
			/* fall through */
		}
	}
	toast.error(message)
}
</script>
