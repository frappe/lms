<template>
	<div class="py-3">
		<div class="flex flex-col gap-5 @lg:flex-row">
			<div class="flex shrink-0 flex-col gap-2 @lg:w-56">
				<div class="relative">
					<div
						class="grid aspect-video w-full place-items-center overflow-hidden rounded-4 border border-outline-gray-1"
						:class="image ? 'bg-surface-gray-2' : courseTint(tint)"
						data-testid="thumbnail-preview"
					>
						<img
							v-if="image"
							:src="safeUrl(image)"
							alt=""
							class="size-full object-cover"
						/>
						<span
							v-else
							class="size-10 stroke-[1.5]"
							:class="courseIcon(icon)"
							aria-hidden="true"
						/>
					</div>
					<Tooltip
						v-if="image"
						:text="
							__(
								'Without an image, or if it does not load, the card shows the colour and icon.'
							)
						"
					>
						<span
							class="lucide-info absolute end-2 top-2 size-4 text-ink-gray-5"
							:aria-label="__('How the thumbnail falls back')"
							data-testid="thumbnail-info"
							role="img"
							tabindex="0"
						/>
					</Tooltip>
				</div>
				<Button
					class="w-full"
					icon-left="lucide-upload"
					:loading="uploading"
					:label="image ? __('Replace image') : __('Upload image')"
					data-testid="upload-image"
					@click="input?.click()"
				/>
				<input
					ref="input"
					type="file"
					:accept="IMAGE_ACCEPT"
					class="hidden"
					@change="onPick"
				/>
				<Button
					v-if="image"
					class="w-full"
					variant="ghost"
					icon-left="lucide-trash-2"
					:label="__('Remove image')"
					@click="image = ''"
				/>
			</div>
			<div class="min-w-0 flex-1 space-y-4">
				<div
					class="-mx-1 flex flex-wrap items-center gap-3 p-1"
					role="group"
					:aria-label="__('Thumbnail colour')"
				>
					<button
						v-for="(swatch, color) in COURSE_SWATCHES"
						:key="color"
						type="button"
						class="grid size-6 place-items-center rounded-full"
						:class="swatch"
						:aria-label="__('{0} thumbnail').format(color)"
						:aria-pressed="isPicked(color)"
						@click="tint = courseColor(color)"
					>
						<span
							v-if="isPicked(color)"
							class="size-2 rounded-full bg-surface-base"
							aria-hidden="true"
						/>
					</button>
					<Button
						class="ms-auto"
						icon-left="lucide-shuffle"
						:label="__('Shuffle')"
						:tooltip="__('Pick a random colour and icon')"
						@click="shuffle"
					/>
				</div>
				<CourseIconPicker v-model="icon" :columns="16" large :tint="tint" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { Button, Tooltip } from 'frappe-ui'
import CourseIconPicker from '@/components/InlineEdit/CourseIconPicker.vue'
import { IMAGE_ACCEPT, useImageUpload } from '@/composables/useImageUpload'
import { courseColor, courseIcon, shuffleThumbnail } from '@/utils/courseIcons'
import { COURSE_SWATCHES, courseTint } from '@/utils/courseTints'
import { safeUrl } from '@/utils/safeUrl'

/** The course card thumbnail: a colour and icon, or an uploaded image. */
const image = defineModel<string | null | undefined>('image')
const tint = defineModel<string | null | undefined>('tint')
const icon = defineModel<string | null | undefined>('icon')

const input = useTemplateRef<HTMLInputElement>('input')
const { uploading, onPick } = useImageUpload(image)

const isPicked = (color: string): boolean =>
	(tint.value || '').toLowerCase() === color

function shuffle(): void {
	const next = shuffleThumbnail(tint.value, icon.value)
	tint.value = next.color
	icon.value = next.icon
}
</script>
