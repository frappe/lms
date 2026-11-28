<template>
	<div class="inline-flex items-center gap-2">
		<!-- A draft is unsaved by nature; its Draft badge already says so. -->
		<Badge v-if="form.isDirty.value && !form.draft" theme="amber">
			{{ __('Not saved') }}
		</Badge>
		<span
			class="inline-flex"
			@mouseenter="form.previewRequired(true)"
			@mouseleave="form.previewRequired(false)"
			@focusin="form.previewRequired(true)"
			@focusout="form.previewRequired(false)"
		>
			<ShortcutTooltip v-if="canSave" :label="__('Save')">
				<Button
					variant="solid"
					:loading="form.isSaving.value"
					@click="form.submitBatch()"
				>
					{{ __('Save') }}
				</Button>
			</ShortcutTooltip>
			<Tooltip v-else :text="form.saveTooltip.value" :hoverDelay="100">
				<Button
					:variant="form.isDirty.value ? 'solid' : 'subtle'"
					:disabled="!form.isDirty.value"
					@click="form.submitBatch()"
				>
					{{ __('Save') }}
				</Button>
			</Tooltip>
		</span>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge, Button, Tooltip } from 'frappe-ui'
import ShortcutTooltip from '@/components/ShortcutTooltip.vue'
import type { BatchForm } from '@/pages/Batches/composables/useBatchForm'

/** Save for the batch form. Hovering rings every empty required field. */
const props = defineProps<{ form: BatchForm }>()

const canSave = computed(
	() => props.form.isDirty.value && !props.form.missingFields.value.length
)
</script>
