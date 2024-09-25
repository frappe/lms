<template>
	<div class="flex flex-col justify-between h-full">
		<div>
			<div class="font-semibold mb-1">
				{{ __(label) }}
			</div>
			<div class="text-xs text-gray-600">
				{{ __(description) }}
			</div>
		</div>
		<div
			class="my-5"
			:class="{ 'flex justify-between w-full': columns.length > 1 }"
		>
			<div v-for="(column, index) in columns" :key="index">
				<div
					class="flex flex-col space-y-5"
					:class="columns.length > 1 ? 'w-72' : 'w-full'"
				>
					<div v-for="field in column">
						<Link
							v-if="field.type == 'Link'"
							v-model="field.value"
							:doctype="field.doctype"
							:label="__(field.label)"
						/>

						<Codemirror
							v-else-if="field.type == 'Code'"
							v-model:value="field.value"
							:label="__(field.label)"
							:height="200"
							:options="{
								mode: field.mode,
								theme: 'seti',
							}"
						/>

						<FormControl
							v-else
							:key="field.name"
							v-model="field.value"
							:label="__(field.label)"
							:type="field.type"
							:rows="field.rows"
							:options="field.options"
						/>
					</div>
				</div>
			</div>
		</div>
		<div class="flex flex-row-reverse mt-auto">
			<Button variant="solid" :loading="data.save.loading" @click="update">
				{{ __('Update') }}
			</Button>
		</div>
	</div>
</template>

<script setup>
import { FormControl, Button } from 'frappe-ui'
import { computed } from 'vue'
import Link from '@/components/Controls/Link.vue'
import Codemirror from 'codemirror-editor-vue3'
import 'codemirror/theme/seti.css'
import 'codemirror/mode/htmlmixed/htmlmixed.js'

const props = defineProps({
	fields: {
		type: Array,
		required: true,
	},
	data: {
		type: Object,
		required: true,
	},
	label: {
		type: String,
		required: true,
	},
	description: {
		type: String,
	},
})

const columns = computed(() => {
	const cols = []
	let currentColumn = []

	props.fields.forEach((field) => {
		if (field.type === 'Column Break') {
			if (currentColumn.length > 0) {
				cols.push(currentColumn)
				currentColumn = []
			}
		} else {
			if (field.type == 'checkbox') {
				field.value = props.data.doc[field.name] ? true : false
			} else {
				field.value = props.data.doc[field.name]
			}
			currentColumn.push(field)
		}
	})

	if (currentColumn.length > 0) {
		cols.push(currentColumn)
	}

	return cols
})

const update = () => {
	props.fields.forEach((f) => {
		props.data.doc[f.name] = f.value
	})
	props.data.save.submit()
}
</script>
<style>
.CodeMirror pre.CodeMirror-line,
.CodeMirror pre.CodeMirror-line-like {
	font-family: revert;
}

.CodeMirror {
	border-radius: 12px;
}
</style>
