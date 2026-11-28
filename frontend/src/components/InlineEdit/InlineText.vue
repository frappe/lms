<template>
	<textarea
		ref="field"
		:value="modelValue ?? ''"
		rows="1"
		:placeholder="placeholder"
		:aria-label="label || placeholder"
		class="block resize-none overflow-hidden py-1.5"
		:class="[
			plain ? PLAIN_FIELD : ['px-2.5', GHOST_FIELD],
			missingRing(missing),
			bleed ? BLEED_TEXT : 'w-full',
		]"
		@input="onInput"
		@keydown.enter.prevent="emit('enter')"
	/>
</template>

<script setup lang="ts">
import { nextTick, onMounted, useTemplateRef, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import {
	BLEED_TEXT,
	GHOST_FIELD,
	PLAIN_FIELD,
	missingRing,
} from '@/components/InlineEdit/fieldClasses'

/**
 * A one-paragraph ghost field that grows with its text. frappe-ui inputs
 * have a fixed type scale, so a title or intro set at page size needs this.
 */
const props = defineProps<{
	modelValue?: string | null
	placeholder: string
	label?: string
	missing?: boolean
	/** Line its text up with the surrounding text, padding outside. */
	bleed?: boolean
	/** No fill or border of its own, for a row that highlights itself. */
	plain?: boolean
}>()

const emit = defineEmits<{
	'update:modelValue': [value: string]
	enter: []
}>()

const textarea = useTemplateRef<HTMLTextAreaElement>('field')

function fitHeight(): void {
	const element = textarea.value
	if (!element) return
	element.style.height = 'auto'
	element.style.height = `${element.scrollHeight + 2}px`
}

function onInput(event: Event): void {
	emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
	fitHeight()
}

onMounted(fitHeight)
// The text rewraps when the width settles after mount, so refit then.
let width = 0
useResizeObserver(textarea, ([entry]) => {
	if (entry.contentRect.width === width) return
	width = entry.contentRect.width
	fitHeight()
})
watch(
	() => props.modelValue,
	() => nextTick(fitHeight)
)

defineExpose({ focus: () => textarea.value?.focus() })
</script>
