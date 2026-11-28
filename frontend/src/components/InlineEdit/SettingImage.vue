<template>
	<SettingRow :label="label" :summary="summary">
		<div
			data-testid="setting-image-drop"
			class="flex items-center gap-4 rounded-5 border border-dashed p-4 transition-colors"
			:class="
				isDragging
					? 'border-outline-gray-5 bg-surface-gray-2'
					: 'border-outline-gray-3 hover:border-outline-gray-4'
			"
			@dragenter.prevent="isDragging = true"
			@dragover.prevent
			@dragleave="onLeave"
			@drop.prevent="onDropped"
		>
			<span
				class="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-4"
				:class="
					model
						? 'ring-1 ring-outline-gray-2'
						: 'bg-surface-gray-2 text-ink-gray-5'
				"
			>
				<img
					v-if="model"
					:src="safeUrl(model)"
					:alt="label"
					class="size-full object-cover"
				/>
				<span v-else class="lucide-image-up size-5" aria-hidden="true" />
				<span
					v-if="uploading"
					class="absolute inset-0 flex items-center justify-center bg-surface-base/70"
				>
					<span
						class="lucide-loader-2 size-4 animate-spin text-ink-gray-6"
						aria-hidden="true"
					/>
				</span>
			</span>
			<div class="min-w-0 flex-1">
				<p class="text-p-base text-ink-gray-8">
					{{
						model
							? __('Drop a new image to replace, or')
							: __('Drop an image here, or')
					}}
					<button
						type="button"
						data-testid="setting-image-browse"
						class="rounded-2 underline underline-offset-2 hover:text-ink-gray-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
						:disabled="uploading"
						@click="input?.click()"
					>
						{{ __('browse') }}
					</button>
				</p>
				<p class="mt-0.5 text-p-sm text-ink-gray-6">
					{{
						uploading
							? __('Uploading...')
							: __('1200 × 630 px works best. PNG or JPG.')
					}}
				</p>
			</div>
			<input
				ref="input"
				type="file"
				:accept="IMAGE_ACCEPT"
				class="hidden"
				@change="onPick"
			/>
			<Button
				v-if="model"
				variant="ghost"
				data-testid="setting-image-remove"
				:tooltip="__('Remove image')"
				:aria-label="__('Remove image')"
				@click="model = null"
			>
				<template #icon>
					<span class="lucide-x size-4" aria-hidden="true" />
				</template>
			</Button>
		</div>
	</SettingRow>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button } from 'frappe-ui'
import SettingRow from '@/components/InlineEdit/SettingRow.vue'
import { IMAGE_ACCEPT, useImageUpload } from '@/composables/useImageUpload'
import { safeUrl } from '@/utils/safeUrl'

/** A settings row for one public image: a dropzone under the label to drop, browse or remove it. */
defineProps<{ label: string; summary?: string }>()
const model = defineModel<string | null | undefined>()

const input = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const { uploading, onDrop, onPick } = useImageUpload(model)

function onLeave(event: DragEvent): void {
	const zone = event.currentTarget as HTMLElement
	if (!zone.contains(event.relatedTarget as Node | null))
		isDragging.value = false
}

function onDropped(event: DragEvent): void {
	isDragging.value = false
	onDrop(event)
}
</script>
