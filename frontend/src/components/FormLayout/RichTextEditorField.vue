<template>
	<div role="group" :aria-labelledby="labelId" class="space-y-1.5">
		<InputLabel
			v-if="field.label"
			:id="labelId"
			:label="field.label"
			:required="field.reqd"
		/>
		<RichTextEditor v-bind="$attrs" @change="onChange" />
	</div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import { InputLabel } from 'frappe-ui/experimental'
import type { FieldComponentEmits, FieldComponentProps } from '@framework/ui/FormLayout'

/**
 * `FormLayout`'s field adapter for LMS's own rich text editor. Uncontrolled by
 * design: `modelValue` is read only to satisfy the field contract, never
 * forwarded as RichTextEditor's `:content` — a reloaded draft starts empty,
 * matching every hand-rolled RichTextEditor field this replaces.
 */
defineProps<FieldComponentProps>()
const emit = defineEmits<FieldComponentEmits>()

defineOptions({ inheritAttrs: false })

const labelId = useId()

function onChange(value: string) {
	emit('update:modelValue', value)
	emit('change', value)
}
</script>
