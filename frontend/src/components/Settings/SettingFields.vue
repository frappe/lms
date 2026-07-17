<template>
	<div>
		<template v-for="(section, index) in sections" :key="index">
			<div
				v-if="index > 0"
				class="mt-2 h-px border-t border-outline-elevation-2"
			/>
			<div
				v-if="section.label"
				class="text-p-base-semibold text-ink-gray-8 mb-1"
				:class="{ 'mt-6': index > 0 }"
			>
				{{ section.label }}
			</div>
			<template
				v-for="(column, columnIndex) in section.columns"
				:key="columnIndex"
			>
				<template
					v-for="(field, fieldIndex) in column.fields"
					:key="`${columnIndex}-${fieldIndex}`"
				>
					<!-- Upload: full-width block (label/description sit above) -->
					<div v-if="field.type == 'Upload'" class="py-3">
						<div class="space-y-1 mb-2">
							<div class="text-p-base-medium text-ink-gray-7">
								{{ __(field.label) }}
							</div>
							<div class="text-p-sm text-ink-gray-5">
								{{ __(field.description) }}
							</div>
						</div>
						<FileUploader
							v-if="!data[field.name]"
							:fileTypes="['image/*']"
							:validateFile="validateFile"
							@success="(file) => (data[field.name] = file.file_url)"
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
							<div class="flex items-center text-sm gap-x-2">
								<div
									class="flex items-center justify-center rounded border border-outline-elevation-2 bg-surface-gray-2"
									:class="field.size == 'lg' ? 'px-5 py-5' : 'px-20 py-8'"
								>
									<img
										:src="fileUrl(data[field.name])"
										class="rounded"
										:class="field.size == 'lg' ? 'w-36' : 'size-6'"
									/>
								</div>
								<div class="flex flex-col flex-wrap">
									<span class="break-all text-ink-gray-9">
										{{ fileName(data[field.name]) }}
									</span>
								</div>
								<span
									@click="data[field.name] = null"
									class="lucide-x border text-ink-gray-7 border-outline-elevation-2 rounded-md cursor-pointer w-5 h-5 p-1 ms-4"
								/>
							</div>
						</div>
					</div>

					<!-- Code/HTML: full-width block -->
					<div v-else-if="field.type == 'Code'" class="py-3">
						<CodeEditor
							:label="__(field.label)"
							type="HTML"
							description="The HTML you add here will be shown on your sign up page."
							v-model="data[field.name]"
							height="250px"
							class="shrink-0"
							:showLineNumbers="true"
						>
						</CodeEditor>
					</div>

					<!-- Textarea: full-width block (label/description above, like CRM) -->
					<div v-else-if="field.type == 'textarea'" class="py-3">
						<div class="space-y-1 mb-2">
							<div class="text-p-base-medium text-ink-gray-7">
								{{ __(field.label) }}
							</div>
							<div v-if="field.description" class="text-p-sm text-ink-gray-5">
								{{ __(field.description) }}
							</div>
						</div>
						<FormControl
							type="textarea"
							:rows="field.rows || 3"
							v-model="data[field.name]"
							:required="field.reqd"
							:placeholder="field.placeholder || __(field.label)"
						/>
					</div>

					<div v-else class="flex items-center justify-between gap-4 py-3">
						<div class="flex flex-col">
							<div class="text-p-base-medium text-ink-gray-7">
								{{ __(field.label) }}
							</div>
							<div v-if="field.description" class="text-p-sm text-ink-gray-5">
								{{ __(field.description) }}
							</div>
						</div>
						<div class="shrink-0">
							<BooleanSwitch
								v-if="field.type == 'checkbox'"
								size="sm"
								v-model="data[field.name]"
							/>
							<Link
								v-else-if="field.type == 'Link'"
								v-model="data[field.name]"
								:doctype="field.doctype"
								:required="field.reqd"
								class="w-48"
							/>
							<Select
								v-else-if="field.type == 'select'"
								v-model="data[field.name]"
								:options="field.options"
								class="w-48"
							/>
							<FormControl
								v-else
								:key="field.name"
								v-model="data[field.name]"
								:type="field.type"
								:rows="field.rows"
								:options="field.options"
								:required="field.reqd"
								:min="field.min"
								class="w-48"
								:placeholder="field.placeholder || __(field.label)"
							/>
						</div>
					</div>
				</template>
			</template>
		</template>
	</div>
</template>
<script setup>
import { Button, FileUploader, FormControl, Select } from 'frappe-ui'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import { watch } from 'vue'
import { validateFile } from '@/utils'
import Link from '@/components/Controls/Link.vue'
import CodeEditor from '@/components/Controls/CodeEditor.vue'

const props = defineProps({
	sections: {
		type: Array,
		required: true,
	},
	data: {
		type: Object,
		required: true,
	},
})

// Attach fields arrive from the backend as a {file_name, file_url} object, but
// become a plain file_url string after a fresh upload. Handle both shapes.
const fileUrl = (value) =>
	value && typeof value === 'object' ? value.file_url : value

const fileName = (value) => {
	const url = fileUrl(value)
	return value && typeof value === 'object' && value.file_name
		? value.file_name
		: (url || '').split('/').pop()
}

// Seed each checkbox's default into the doc when it loads empty, without
// overwriting an already-saved value. Watches props.data because the panel can
// mount before the settings doc has loaded.
watch(
	() => props.data,
	(data) => {
		if (!data) return
		props.sections.forEach((section) => {
			section.columns.forEach((column) => {
				column.fields.forEach((field) => {
					if (field.type !== 'checkbox') return
					const current = data[field.name]
					if (current === null || current === undefined || current === '') {
						data[field.name] = field.default ? 1 : 0
					}
				})
			})
		})
	},
	{ immediate: true }
)
</script>
