<template>
	<div
		:class="[
			type !== 'checkbox' &&
				'[&_label]:!text-sm [&_label]:md:!text-sm [&_label]:tracking-wider [&_label]:text-gray-600',
			typeClass,
			customClass,
		]"
	>
		<slot />
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue'

type FormWrapperType =
	| 'input'
	| 'textarea'
	| 'editor'
	| 'combobox'
	| 'checkbox'
	| 'editorBottomMenu'

const typeClasses: Record<FormWrapperType, string> = {
	input:
		'[&_input]:!rounded [&_input]:py-3 [&_input]:px-4 [&_input]:!border-[1.5px] [&_input]:!border-gray-100 [&_input]:!bg-white [&_input]:!h-10 text-sm [&_input]:md:!text-base',
	textarea:
		'[&_textarea]:!rounded [&_textarea]:py-3 [&_textarea]:px-4 [&_textarea]:!border-[1.5px] [&_textarea]:!border-gray-100 [&_textarea]:!bg-white [&_textarea]:md:!text-sm',
	editor:
		'[&_.ProseMirror]:!border-gray-100 [&_.ProseMirror]:!bg-white [&_.ProseMirror]:!border-t-[1.5px] [&_.ProseMirror]:!border-x-[1.5px] [&>div>div:first-child]:!py-3',
	editorBottomMenu:
		'[&_.ProseMirror]:!border-gray-100 [&_.ProseMirror]:!bg-white [&_.ProseMirror]:!border-t-[1.5px] [&_.ProseMirror]:!border-x-[1.5px] [&>div>div:first-child]:!py-3 [&_.ProseMirror]:!pb-14 [&>div>div:first-child]:!absolute [&>div>div:first-child]:!bottom-0 [&>div>div:first-child]:!left-0 [&>div>div:first-child]:!z-10 [&>div>div:first-child]:!rounded-t-none [&>div>div:first-child]:!rounded-b-md',
	combobox:
		'[&_button]:!rounded [&_button]:!py-3 [&_button]:!px-4 [&_button]:!border-[1.5px] [&_button]:!border-gray-100 [&_button]:!bg-white [&_button]:!h-10',
	checkbox:
		'[&_label]:-mt-[0.8px] [&_label]:font-medium [&_label]:!tracking-normal [&_label]:!text-sm [&_label]:md:!text-sm [&_label]:!text-gray-800 [&_input]:!text-primary-500 [&_input[type=checkbox]]:!w-4 [&_input[type=checkbox]]:!h-4',
}

const props = withDefaults(
	defineProps<{
		type?: FormWrapperType
		customClass?: string
	}>(),
	{
		type: 'input',
	},
)

const typeClass = computed(() => typeClasses[props.type])
</script>
