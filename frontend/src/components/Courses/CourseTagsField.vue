<template>
	<div class="flex flex-wrap items-center gap-2">
		<Badge v-for="tag in tags" :key="tag" theme="gray" size="lg">
			{{ tag }}
			<template #suffix>
				<button
					type="button"
					class="-me-0.5 flex rounded-full p-0.5 hover:bg-surface-gray-4"
					:aria-label="__('Remove tag {0}').format(tag)"
					@click="removeTag(tag)"
				>
					<span class="lucide-x size-3" />
				</button>
			</template>
		</Badge>
		<MultiSelect
			v-model="tags"
			:options="tagOptions"
			:placeholder="__('Find or create a tag')"
			@update:query="query = $event"
		>
			<template #trigger>
				<button
					type="button"
					:aria-label="__('Add tag')"
					class="flex h-6 items-center gap-1 rounded-full border border-dashed border-outline-gray-3 px-2.5 text-p-sm text-ink-gray-6 hover:border-outline-gray-4 hover:text-ink-gray-8"
				>
					<span class="lucide-plus size-3" />
					{{ tags.length ? __('Tag') : __('Add tags') }}
				</button>
			</template>
			<template #footer="{ clear, selectAll }">
				<div
					v-if="tags.length || hasUnselectedOption"
					class="flex items-center justify-between gap-2 border-t border-outline-gray-1 px-2 py-1.5"
				>
					<Button v-if="tags.length" variant="ghost" size="sm" @click="clear">
						{{ __('Clear All') }}
					</Button>
					<Button
						v-if="hasUnselectedOption"
						variant="ghost"
						size="sm"
						class="ms-auto"
						@click="selectAll"
					>
						{{ __('Select All') }}
					</Button>
				</div>
			</template>
		</MultiSelect>
	</div>
</template>

<script setup lang="ts">
import { Badge, Button, MultiSelect } from 'frappe-ui'
import { computed, inject, ref } from 'vue'
import type { CourseFormContext } from '@/types'

interface TagOption {
	label: string
	value: string
}

const { resource, markDirty } = inject<CourseFormContext>('courseForm')!

const query = ref<string>('')

const tags = computed<string[]>({
	get: () => (resource.doc?.tags || '').split(', ').filter(Boolean),
	set: (values: string[]) => {
		if (!resource.doc) return
		resource.doc.tags = values.join(', ')
		markDirty()
	},
})

const tagOptions = computed<TagOption[]>(() => {
	const selected = tags.value.map((tag) => ({ label: tag, value: tag }))
	const typed = query.value.trim()
	if (!typed || tags.value.includes(typed)) return selected
	return [
		...selected,
		{ label: __('Create "{0}"').format(typed), value: typed },
	]
})

// frappe-ui's default footer offers Select All even with no options to select.
const hasUnselectedOption = computed<boolean>(() =>
	tagOptions.value.some((option) => !tags.value.includes(option.value))
)

function removeTag(tag: string): void {
	tags.value = tags.value.filter((existing) => existing !== tag)
}
</script>
