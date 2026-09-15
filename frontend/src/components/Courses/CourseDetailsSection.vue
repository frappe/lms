<template>
	<section class="space-y-5">
		<div class="text-base-semibold text-ink-gray-9">
			{{ __('Course details') }}
		</div>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
			<FormControl
				v-model="doc.title"
				:label="__('Title')"
				:required="true"
				variant="outline"
				@input="markDirty()"
			/>
			<Link
				v-model="doc.category"
				doctype="LMS Category"
				:label="__('Category')"
				:placeholder="__('Select category')"
				:inlineCreate="true"
				inlineCreatePlaceholder="Category name"
				:onCreate="onCreateCategory"
				variant="outline"
				@update:modelValue="markDirty()"
			/>
			<CourseInstructorsField />
			<div class="space-y-1.5">
				<InputLabel :id="tagsLabelId" :label="__('Tags')" />
				<MultiSelect
					v-model="tagsArray"
					:options="tagOptions"
					:placeholder="__('Add tag')"
					variant="outline"
					class="w-full justify-between"
					@update:query="tagQuery = $event"
				>
					<template #trigger="{ open, selectedOptions }">
						<button
							type="button"
							:aria-expanded="open"
							:class="[
								'relative inline-flex w-full min-h-7 items-center gap-2 rounded border border-outline-gray-2 bg-surface-base px-2 text-start text-base text-ink-gray-8 outline-none transition-colors hover:border-outline-gray-3 hover:shadow-sm focus:border-outline-gray-4 focus:shadow-sm',
								open && 'border-outline-gray-4 shadow-sm',
							]"
						>
							<span class="lucide-tag size-4 shrink-0 text-ink-gray-5" />
							<span
								class="min-w-0 flex-1 truncate"
								:class="!selectedOptions.length && 'text-ink-gray-4'"
							>
								<template v-if="tagsArray.length">{{
									tagsSelectedLabels
								}}</template>
								<template v-else>{{ __('Add tag') }}</template>
							</span>
							<span
								class="lucide-chevron-down size-4 shrink-0 text-ink-gray-4 transition-transform duration-200"
								:class="open && 'rotate-180'"
							/>
						</button>
					</template>
				</MultiSelect>
			</div>
			<FormControl
				v-model="doc.short_introduction"
				type="textarea"
				:rows="3"
				:label="__('Short description')"
				:placeholder="__('Type something')"
				:required="true"
				variant="outline"
				class="md:col-span-2"
				@change="markDirty()"
			/>
		</div>
		<div class="grid gap-5 grid-cols-1 xl:grid-cols-2">
			<CourseThumbnailField />
			<VideoPreviewField
				:modelValue="doc.video_link"
				:label="__('Preview video')"
				@update:modelValue="setVideoLink"
			/>
		</div>
	</section>
</template>

<script setup lang="ts">
import { FormControl, MultiSelect } from 'frappe-ui'
import { computed, inject, ref, useId } from 'vue'
import { createLMSCategory } from '@/utils'
import { createHandler } from '@/utils/createHandler'
import Link from '@/components/Controls/Link.vue'
import CourseInstructorsField from '@/components/Courses/CourseInstructorsField.vue'
import CourseThumbnailField from '@/components/Courses/CourseThumbnailField.vue'
import VideoPreviewField from '@/components/Controls/VideoPreviewField.vue'
import type { CourseFormContext } from '@/types'
import { InputLabel } from '@/components/Form/labeling'

interface TagOption {
	label: string
	value: string
}

const tagsLabelId = useId()
const { resource, markDirty } = inject<CourseFormContext>('courseForm')!

const doc = computed(() => resource.doc)

const parsedTags = computed<string[]>(() => {
	const tags = resource.doc?.tags
	return tags ? tags.split(', ').filter(Boolean) : []
})

const tagsArray = computed<string[]>({
	get: () => parsedTags.value,
	set: (vals: string[]) => {
		if (!resource.doc) return
		resource.doc.tags = vals.join(', ')
		markDirty()
	},
})

const tagQuery = ref<string>('')
const tagOptions = computed<TagOption[]>(() => {
	const selected: TagOption[] = parsedTags.value.map((t) => ({
		label: t,
		value: t,
	}))
	const q = tagQuery.value.trim()
	if (q && !parsedTags.value.includes(q)) {
		return [...selected, { label: `${__('Create')} "${q}"`, value: q }]
	}
	return selected
})

const tagsSelectedLabels = computed<string>(() => tagsArray.value.join(', '))

function setVideoLink(value: string) {
	if (!resource.doc) return
	resource.doc.video_link = value
	markDirty()
}

function createCategory(name: string, done?: () => void) {
	if (!name) return
	createLMSCategory(name).then((categoryName: string | undefined) => {
		if (!categoryName || !resource.doc) return
		resource.doc.category = categoryName
		done?.()
		markDirty()
	})
}

function onCreateCategory(value: string | null, done?: () => void) {
	createHandler(value, done, (name) => createCategory(name, done))
}
</script>
