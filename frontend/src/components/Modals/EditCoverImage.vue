<template>
	<Popover bare>
		<template #trigger="{ isOpen, toggle }" class="flex w-full">
			<slot v-bind="{ isOpen, togglePopover: toggle }"></slot>
		</template>
		<template #default>
			<div
				class="absolute start-1/2 mt-3 w-96 max-w-lg -translate-x-1/2 transform rounded-lg bg-surface-base px-4 sm:px-0 lg:max-w-3xl"
			>
				<div
					class="overflow-hidden rounded-lg p-3 shadow-2xl ring-1 ring-black ring-opacity-5"
				>
					<div class="flex items-center justify-center gap-x-2">
						<TextInput
							type="text"
							placeholder="search by keyword"
							:aria-label="__('Search images by keyword')"
							v-model="search"
							:debounce="300"
							class="flex-1"
						/>
						<FileUploader
							:fileTypes="['image/*']"
							:uploadArgs="{ private: false }"
							:validateFile="validateFile"
							@success="(file) => saveImage(file)"
						>
							<template
								v-slot="{ file, progress, uploading, openFileSelector }"
							>
								<div class="">
									<Button @click="openFileSelector" :loading="uploading">
										{{ uploading ? `Uploading ${progress}%` : 'Upload Image' }}
									</Button>
								</div>
							</template>
						</FileUploader>
					</div>
					<div
						v-if="hasImages"
						class="relative mt-2 grid w-[25.5rem] gap-2 bg-surface-base lg:grid-cols-2"
					>
						<button
							v-for="image in images.data"
							:key="image.id"
							class="h-[50px] w-[200px] overflow-hidden rounded hover:opacity-80"
							@click="$emit('select', image.urls.raw)"
						>
							<img
								:src="
									safeUrl(
										image.urls.raw +
											'&w=200&h=50&fit=crop&crop=entropy,faces,focalpoint'
									)
								"
								:alt="__('Cover image option')"
							/>
						</button>
					</div>
					<!-- Unsplash needs an access key that most sites never set, so the
					     grid is empty by default. Say so instead of showing a blank
					     box that reads as a broken picker. -->
					<div
						v-else-if="hasFetched && !images.loading"
						class="mt-2 w-[25.5rem] rounded border border-dashed p-4 text-center text-sm text-ink-gray-5"
					>
						<template v-if="search">
							{{ __('No images found for "{0}".').format(search) }}
						</template>
						<template v-else>
							{{
								__(
									'Image search is unavailable. Add an Unsplash access key in Settings, or upload your own image.'
								)
							}}
						</template>
					</div>
					<div
						v-if="hasImages"
						class="mt-2 text-center text-sm text-ink-gray-4"
					>
						{{ __('Image search powered by') }}
						<a class="underline" v-external href="https://unsplash.com">
							{{ __('Unsplash') }}
						</a>
					</div>
				</div>
			</div>
		</template>
	</Popover>
</template>
<script setup>
import {
	Popover,
	TextInput,
	FileUploader,
	Button,
	createResource,
} from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { safeUrl } from '@/utils/safeUrl'

const search = ref(null)
const emit = defineEmits(['select'])

const images = createResource({
	url: 'lms.lms.api.get_unsplash_photos',
	makeParams: () => {
		return {
			keyword: search.value,
		}
	},
	auto: true,
	debounce: 500,
})

const hasImages = computed(() => images.data?.length > 0)

// `auto: true` calls the *debounced* fetch, so `loading` stays false for the
// whole debounce window. Keying the empty state off `loading` alone told a
// correctly configured site its Unsplash key was missing for those 500ms.
const hasFetched = computed(
	() => images.data !== null && images.data !== undefined
)

watch(
	() => search.value,
	() => {
		images.reload()
	}
)

const saveImage = (file) => {
	emit('select', file.file_url)
}

const validateFile = (file) => {
	let extension = file.name.split('.').pop().toLowerCase()
	if (!['jpg', 'jpeg', 'png'].includes(extension)) {
		return 'Only image file is allowed.'
	}
}
</script>
