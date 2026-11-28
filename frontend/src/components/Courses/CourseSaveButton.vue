<template>
	<div class="inline-flex items-center gap-2">
		<!-- A draft is unsaved by nature; its Draft badge already says so. -->
		<Badge v-if="form.isDirty.value && !form.draftChapters" theme="amber">
			{{ __('Not saved') }}
		</Badge>
		<span
			class="inline-flex"
			@mouseenter="previewGaps(true)"
			@mouseleave="previewGaps(false)"
			@focusin="previewGaps(true)"
			@focusout="previewGaps(false)"
		>
			<Tooltip :text="tooltip" :hoverDelay="100">
				<Button
					:variant="form.isDirty.value ? 'solid' : 'subtle'"
					:disabled="!form.isDirty.value"
					:loading="form.resource.setValue?.loading"
					@click="save"
				>
					{{ __('Save') }}
				</Button>
			</Tooltip>
		</span>
	</div>
</template>

<script setup lang="ts">
import { Badge, Button, Tooltip } from 'frappe-ui'
import { computed, ref } from 'vue'
import type { CourseForm } from '@/composables/useCourseForm'
import { joinLabels } from '@/utils/courseForm'

/** Save for the course form. Hovering rings every empty required field. */
const props = defineProps<{ form: CourseForm }>()

// A save that found gaps keeps the rings up until the gaps are filled.
const pinned = ref<boolean>(false)

const missingLabels = computed<string[]>(() =>
	props.form.missingFields.value.map((field) => field.label)
)

const tooltip = computed<string>(() => {
	if (missingLabels.value.length) {
		return __('Add {0} to save').format(joinLabels(missingLabels.value))
	}
	return props.form.isDirty.value
		? __('Save (Ctrl+S)')
		: __('No changes to save')
})

function previewGaps(active: boolean): void {
	if (active) props.form.showRequired.value = missingLabels.value.length > 0
	else if (!pinned.value) props.form.showRequired.value = false
}

function save(): void {
	pinned.value = missingLabels.value.length > 0
	props.form.submitCourse()
}
</script>
