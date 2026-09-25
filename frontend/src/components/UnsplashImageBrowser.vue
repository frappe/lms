<template>
	<Popover bare>
		<template #trigger="{ open, setOpen }">
			<slot v-bind="{ open, setOpen }"></slot>
		</template>
		<template #default>
			<div
				class="absolute start-1/2 mt-3 max-w-sm -translate-x-1/2 transform rounded-6 bg-surface-base px-4 sm:px-0 lg:max-w-3xl"
			>
				<div
					class="overflow-hidden rounded-6 p-3 shadow-2xl ring-1 ring-outline-gray-2"
				>
					<div class="flex items-center gap-x-2">
						<div class="flex-1">
							<TextInput
								type="text"
								placeholder="search by keyword"
								:aria-label="__('Search by keyword')"
								v-model="search"
								:debounce="300"
							/>
						</div>
						<FileUploader
							:private="false"
							@success="(file) => $emit('select', file.file_url)"
						>
							<template
								v-slot="{ file, progress, uploading, openFileSelector }"
							>
								<div class="w-full text-center">
									<Button @click="openFileSelector" :loading="uploading">
										{{ uploading ? `Uploading ${progress}%` : 'Upload Image' }}
									</Button>
								</div>
							</template>
						</FileUploader>
					</div>
					<div
						class="relative mt-2 grid w-[25.5rem] gap-2 bg-surface-base lg:grid-cols-2"
					>
						<Button
							v-for="image in images.data"
							:key="image.id"
							class="h-[50px] w-[200px] overflow-hidden rounded-4 hover:opacity-80"
							@click="$emit('select', image.urls.raw)"
						>
							<img
								:src="
									safeUrl(
										image.urls.raw +
											'&w=200&h=50&fit=crop&crop=entropy,faces,focalpoint'
									)
								"
								:alt="__('Unsplash photo')"
							/>
						</Button>
					</div>
					<div class="mt-2 text-center text-sm text-ink-gray-4">
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
// import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue'
import { Popover, FileUploader, Button, createResource } from 'frappe-ui'
import { ref, watch } from 'vue'
import { safeUrl } from '@/utils/safeUrl'

defineEmits(['select'])

const search = ref('')

const images = createResource({
	url: 'gameplan.api.get_unsplash_photos',
	makeParams: () => ({ keyword: search.value }),
	auto: true,
	debounce: 500,
})

// `auto: true` only fires the debounced fetch once, on creation — it does not
// re-run on later `search` changes. See EditCoverImage.vue for the same
// pattern.
watch(
	() => search.value,
	() => images.reload()
)
</script>
