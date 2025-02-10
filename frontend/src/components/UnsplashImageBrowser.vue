<template>
	<Popover transition="default">
		<template #target="{ isOpen, togglePopover }" class="flex w-full">
			<slot v-bind="{ isOpen, togglePopover }"></slot>
		</template>
		<template #body>
			<div
				class="absolute left-1/2 mt-3 max-w-sm -translate-x-1/2 transform rounded-lg bg-surface-white px-4 sm:px-0 lg:max-w-3xl"
			>
				<div
					class="overflow-hidden rounded-lg p-3 shadow-2xl ring-1 ring-black ring-opacity-5"
				>
					<div class="flex items-center space-x-2">
						<div class="flex-1">
							<TextInput
								type="text"
								placeholder="search by keyword"
								v-model="search"
								:debounce="300"
							/>
						</div>
						<FileUploader @success="(file) => $emit('select', file.file_url)">
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
						class="relative mt-2 grid w-[25.5rem] gap-2 bg-surface-white lg:grid-cols-2"
					>
						<Button
							v-for="image in $resources.images.data"
							:key="image.id"
							class="h-[50px] w-[200px] overflow-hidden rounded hover:opacity-80"
							@click="$emit('select', image.urls.raw)"
						>
							<img
								:src="
									image.urls.raw +
									'&w=200&h=50&fit=crop&crop=entropy,faces,focalpoint'
								"
							/>
						</Button>
					</div>
					<div class="mt-2 text-center text-sm text-ink-gray-4">
						{{ __('Image search powered by') }}
						<a class="underline" target="_blank" href="https://unsplash.com">
							{{ __('Unsplash') }}
						</a>
					</div>
				</div>
			</div>
		</template>
	</Popover>
</template>

<script>
// import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue'
import { Popover, FileUploader, Button } from 'frappe-ui'

export default {
	name: 'UnsplashImageBrowser',
	components: {
		Popover,
		FileUploader,
	},
	emits: ['select'],
	resources: {
		images() {
			return {
				url: 'gameplan.api.get_unsplash_photos',
				params: { keyword: this.search },
				auto: true,
				debounce: 500,
			}
		},
	},
	data() {
		return {
			search: '',
		}
	},
}
</script>
