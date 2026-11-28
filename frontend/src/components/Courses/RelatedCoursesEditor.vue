<template>
	<section class="space-y-4">
		<div class="flex items-baseline justify-between gap-4">
			<h2 class="text-3xl-semibold text-ink-gray-9">
				{{ __('Related courses') }}
			</h2>
			<span class="text-p-sm text-ink-gray-6">
				{{ __('Shown to learners below the course') }}
			</span>
		</div>
		<div
			class="grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4 gap-5"
		>
			<div
				v-for="name in modelValue"
				:key="name"
				class="group relative"
				data-testid="related-course"
			>
				<CourseCard
					v-if="details[name]"
					:course="details[name]"
					:to="{ name: 'CourseDetail', params: { courseName: name } }"
				/>
				<div
					v-else
					class="h-full min-h-72 animate-pulse rounded-6 bg-surface-gray-2"
				/>
				<Button
					class="absolute end-3 top-3 z-20 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100"
					variant="outline"
					icon="lucide-x"
					:aria-label="__('Remove {0}').format(details[name]?.title || name)"
					@click="remove(name)"
				/>
			</div>

			<div
				class="flex min-h-72 flex-col items-center justify-center gap-2 rounded-6 border border-dashed border-outline-gray-3 p-6 text-center"
			>
				<button
					type="button"
					class="flex flex-col items-center gap-2 rounded-5 p-2 outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
					data-testid="add-related-course"
					@click="openPicker"
				>
					<span
						class="flex size-12 items-center justify-center rounded-full bg-surface-gray-2"
					>
						<span
							class="lucide-plus size-5 text-ink-gray-6"
							aria-hidden="true"
						/>
					</span>
					<span class="text-base-semibold text-ink-gray-9">
						{{ __('Add related courses') }}
					</span>
					<span class="text-p-sm text-ink-gray-6">
						{{ __('Pick more courses learners should take next.') }}
					</span>
				</button>
			</div>
		</div>
		<PickerDialog
			v-model:open="picking"
			:title="__('Add related courses')"
			:searchPlaceholder="__('Search courses')"
			:items="picker.items.value"
			:categories="picker.categories.value"
			@add="add"
		/>
	</section>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Button, call } from 'frappe-ui'
import CourseCard from '@/components/CourseCard.vue'
import PickerDialog from '@/components/InlineEdit/PickerDialog.vue'
import { useCoursePickerItems } from '@/composables/useCoursePickerItems'

/** The related courses an instructor picks, shown as the cards learners will see. */
const props = defineProps<{ courseName: string; category?: string | null }>()
const modelValue = defineModel<string[]>({ required: true })

const details = reactive<Record<string, Record<string, unknown>>>({})
const picking = ref(false)

const picker = useCoursePickerItems(
	() => [props.courseName, ...modelValue.value],
	() => props.category
)

const openPicker = (): void => {
	picker.load()
	picking.value = true
}

const loadDetails = (names: string[]): void => {
	for (const name of names) {
		if (details[name]) continue
		call('lms.lms.utils.get_course_details', { course: name }).then(
			(course: Record<string, unknown>) => {
				details[name] = course
			}
		)
	}
}

watch(modelValue, loadDetails, { immediate: true })

const add = (names: string[]): void => {
	const fresh = names.filter((name) => !modelValue.value.includes(name))
	if (fresh.length) modelValue.value = [...modelValue.value, ...fresh]
}

const remove = (name: string): void => {
	modelValue.value = modelValue.value.filter((course) => course !== name)
}
</script>
