<template>
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
						v-model="data[field.name]"
						:doctype="field.doctype"
						:label="__(field.label)"
					/>

					<div v-else-if="field.type == 'Code'">
						<div>
							{{ __(field.label) }}
						</div>
						<Codemirror
							v-model:value="data[field.name]"
							:height="200"
							:options="{
								mode: field.mode,
								theme: 'seti',
							}"
						/>
					</div>

					<div v-else-if="field.type == 'Upload'">
						<div class="text-sm text-gray-600 mb-1">
							{{ __(field.label) }}
						</div>
						<FileUploader
							v-if="!data[field.name]"
							:fileTypes="['image/*']"
							:validateFile="validateFile"
							@success="(file) => (data[field.name] = file)"
						>
							<template
								v-slot="{ file, progress, uploading, openFileSelector }"
							>
								<div class="">
									<Button @click="openFileSelector" :loading="uploading">
										{{
											uploading ? `Uploading ${progress}%` : 'Upload an image'
										}}
									</Button>
								</div>
							</template>
						</FileUploader>
						<div v-else>
							<div class="flex items-center text-sm">
								<div class="border rounded-md p-2 mr-2">
									<FileText class="h-5 w-5 stroke-1.5 text-gray-700" />
								</div>
								<div class="flex flex-col flex-wrap">
									<span class="break-all">
										{{ data[field.name]?.file_name }}
									</span>
									<span class="text-sm text-gray-500 mt-1">
										{{ getFileSize(data[field.name]?.file_size) }}
									</span>
								</div>
								<X
									@click="data[field.name] = null"
									class="bg-gray-200 rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ml-4"
								/>
							</div>
						</div>
					</div>

					<FormControl
						v-else
						:key="field.name"
						v-model="data[field.name]"
						:label="__(field.label)"
						:type="field.type"
						:rows="field.rows"
					/>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { FormControl, FileUploader, Button } from 'frappe-ui'
import { computed } from 'vue'
import { getFileSize } from '@/utils'
import { X, FileText } from 'lucide-vue-next'
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
				field.value = props.data[field.name] ? true : false
			} else {
				field.value = props.data[field.name]
			}
			currentColumn.push(field)
		}
	})

	if (currentColumn.length > 0) {
		cols.push(currentColumn)
	}

	return cols
})
</script>
