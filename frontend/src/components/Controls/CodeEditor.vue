<template>
	<div
		class="editor flex flex-col gap-1"
		:style="{
			height: height,
		}"
	>
		<span class="text-xs text-ink-gray-7" v-if="label">
			{{ label }}
		</span>
		<div
			ref="editor"
			class="h-auto flex-1 overflow-hidden overscroll-none !rounded border border-outline-gray-2 bg-surface-gray-2 dark:bg-gray-900"
		/>
		<span
			class="mt-1 text-xs text-ink-gray-5"
			v-show="description"
			v-html="description"
		></span>
		<Button
			v-if="showSaveButton"
			@click="emit('save', aceEditor?.getValue())"
			class="mt-3"
		>
			{{ __('Save') }}
		</Button>
	</div>
</template>
<script setup lang="ts">
import ace from 'ace-builds'
import 'ace-builds/src-min-noconflict/ext-searchbox'
import 'ace-builds/src-min-noconflict/theme-chrome'
import 'ace-builds/src-min-noconflict/theme-twilight'
import { PropType, onMounted, ref, watch } from 'vue'
import { Button } from 'frappe-ui'

const isDark = ref(false)

const props = defineProps({
	modelValue: {
		type: [Object, String, Array],
	},
	type: {
		type: String as PropType<'JSON' | 'HTML' | 'Python' | 'JavaScript' | 'CSS'>,
		default: 'JSON',
	},
	label: {
		type: String,
		default: '',
	},
	readonly: {
		type: Boolean,
		default: false,
	},
	height: {
		type: String,
		default: '250px',
	},
	showLineNumbers: {
		type: Boolean,
		default: false,
	},
	autofocus: {
		type: Boolean,
		default: true,
	},
	showSaveButton: {
		type: Boolean,
		default: false,
	},
	description: {
		type: String,
		default: '',
	},
})

const emit = defineEmits(['save', 'update:modelValue'])
const editor = ref<HTMLElement | null>(null)
let aceEditor = null as ace.Ace.Editor | null

onMounted(() => {
	isDark.value = localStorage.getItem('theme') === 'dark'
	setupEditor()
})

const setupEditor = () => {
	aceEditor = ace.edit(editor.value as HTMLElement)
	resetEditor(props.modelValue as string, true)
	aceEditor.setReadOnly(props.readonly)
	aceEditor.setOptions({
		fontSize: '12px',
		useWorker: false,
		showGutter: props.showLineNumbers,
		wrap: props.showLineNumbers,
	})
	if (props.type === 'CSS') {
		import('ace-builds/src-noconflict/mode-css').then(() => {
			aceEditor?.session.setMode('ace/mode/css')
		})
	} else if (props.type === 'JavaScript') {
		import('ace-builds/src-noconflict/mode-javascript').then(() => {
			aceEditor?.session.setMode('ace/mode/javascript')
		})
	} else if (props.type === 'Python') {
		import('ace-builds/src-noconflict/mode-python').then(() => {
			aceEditor?.session.setMode('ace/mode/python')
		})
	} else if (props.type === 'JSON') {
		import('ace-builds/src-noconflict/mode-json').then(() => {
			aceEditor?.session.setMode('ace/mode/json')
		})
	} else {
		import('ace-builds/src-noconflict/mode-html').then(() => {
			aceEditor?.session.setMode('ace/mode/html')
		})
	}
	aceEditor.on('blur', () => {
		try {
			let value = aceEditor?.getValue() || ''
			if (props.type === 'JSON') {
				value = JSON.parse(value)
			}
			if (value === props.modelValue) return
			if (!props.showSaveButton && !props.readonly) {
				emit('update:modelValue', value)
			}
		} catch (e) {
			// do nothing
		}
	})
}

const getModelValue = () => {
	let value = props.modelValue || ''
	try {
		if (props.type === 'JSON' || typeof value === 'object') {
			value = JSON.stringify(value, null, 2)
		}
	} catch (e) {
		// do nothing
	}
	return value as string
}

function resetEditor(value: string, resetHistory = false) {
	value = getModelValue()
	aceEditor?.setValue(value)
	aceEditor?.clearSelection()
	aceEditor?.setTheme(isDark.value ? 'ace/theme/twilight' : 'ace/theme/chrome')
	props.autofocus && aceEditor?.focus()
	if (resetHistory) {
		aceEditor?.session.getUndoManager().reset()
	}
}

watch(isDark, () => {
	console.log(isDark.value)
	aceEditor?.setTheme(isDark.value ? 'ace/theme/twilight' : 'ace/theme/chrome')
})

watch(
	() => props.type,
	() => {
		setupEditor()
	}
)

watch(
	() => props.modelValue,
	() => {
		resetEditor(props.modelValue as string)
	}
)

defineExpose({ resetEditor })
</script>
