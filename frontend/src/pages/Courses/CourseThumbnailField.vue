<template>
	<div class="flex flex-col gap-y-1.5">
		<FormLabel :label="__('Course thumbnail')" />

		<div class="flex items-start gap-5">
			<button
				type="button"
				class="w-56 aspect-[750/422] rounded-lg overflow-hidden border border-outline-gray-2 flex items-center justify-center shrink-0 hover:opacity-95 transition"
				:style="
					!hasImage && doc.card_gradient
						? { backgroundColor: wellColor }
						: undefined
				"
				:title="
					hasImage
						? __('Remove the image to pick a color instead.')
						: __('Click to upload an image.')
				"
				@click="onWellClick"
			>
				<img
					v-if="hasImage"
					:src="doc.image"
					:alt="__('Course thumbnail')"
					class="w-full h-full object-cover"
				/>
				<div
					v-else-if="!doc.card_gradient"
					class="flex flex-col items-center gap-1 text-ink-gray-5"
				>
					<ImageIcon class="size-5 stroke-1.5" />
					<span class="text-xs">{{ __('No thumbnail') }}</span>
				</div>
			</button>

			<div class="flex-1 min-w-0 space-y-3">
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
							@success="(file) => onUploaded(file.file_url)"
							@failure="onUploadFailure"
						>
							<template #default="{ openFileSelector, uploading }">
								<Button :loading="uploading" @click="openFileSelector">
									<template #prefix>
										<Upload class="size-4 stroke-1.5" />
									</template>
									{{ uploading ? __('Uploading') : __('Replace') }}
								</Button>
							</template>
						</FileUploader>
						<Button variant="ghost" theme="red" @click="removeImage">
							<template #prefix>
								<Trash2 class="size-4 stroke-1.5" />
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
									doc.card_gradient === c
										? 'ring-2 ring-offset-2 ring-outline-gray-4'
										: 'hover:scale-105'
								"
								:style="{ backgroundColor: getColor(c.toLowerCase(), 400) }"
								:aria-label="c"
								@click="pickColor(c)"
							/>
						</div>
					</div>
					<div class="flex flex-col items-start gap-1.5">
						<FileUploader
							ref="uploaderRef"
							:fileTypes="['.jpg,.jpeg,.gif,.png']"
							@success="(file) => onUploaded(file.file_url)"
							@failure="onUploadFailure"
						>
							<template #default="{ openFileSelector, uploading }">
								<Button :loading="uploading" @click="openFileSelector">
									<template #prefix>
										<Upload class="size-4 stroke-1.5" />
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
import {
	Button,
	FileUploader,
	FormLabel,
	createResource,
	toast,
} from 'frappe-ui'
import { Image as ImageIcon, Trash2, Upload } from 'lucide-vue-next'
import { computed, inject, ref, watch } from 'vue'
import { getColor } from '@/utils'
import type { CourseFormContext, Resource } from '@/types/api'

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
	return getColor(String(c).toLowerCase(), 400)
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

const uploaderRef = ref<{ inputRef: () => HTMLInputElement } | null>(null)

function onWellClick() {
	if (hasImage.value) {
		removeImage()
		return
	}
	const input = uploaderRef.value?.inputRef?.()
	input?.click?.()
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
