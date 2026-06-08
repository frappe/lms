<template>
	<div class="overflow-y-auto">
		<template v-for="(section, index) in sections" :key="index">
			<!-- Divider only between topics (sections), never between fields -->
			<div v-if="index > 0" class="h-px border-t border-outline-gray-modals" />
			<div
				v-if="section.label"
				class="text-p-md font-semibold text-ink-gray-9 mb-1"
				:class="{ 'mt-5': index > 0 }"
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
							<div class="text-p-base font-medium text-ink-gray-7">
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
									class="flex items-center justify-center rounded border border-outline-gray-modals bg-surface-gray-2"
									:class="field.size == 'lg' ? 'px-5 py-5' : 'px-20 py-8'"
								>
									<img
										:src="data[field.name]"
										class="rounded"
										:class="field.size == 'lg' ? 'w-36' : 'size-6'"
									/>
								</div>
								<div class="flex flex-col flex-wrap">
									<span class="break-all text-ink-gray-9">
										{{ data[field.name].split('/').pop() }}
									</span>
								</div>
								<X
									@click="data[field.name] = null"
									class="border text-ink-gray-7 border-outline-gray-modals rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ms-4"
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
							<div class="text-p-base font-medium text-ink-gray-7">
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

					<!-- Normal field: label + description on the left, control on the right (CRM layout) -->
					<div v-else class="flex items-center justify-between gap-4 py-3">
						<div class="flex flex-col">
							<div class="text-p-base font-medium text-ink-gray-7">
								{{ __(field.label) }}
							</div>
							<div v-if="field.description" class="text-p-sm text-ink-gray-5">
								{{ __(field.description) }}
							</div>
						</div>
						<div class="shrink-0">
							<Switch
								v-if="field.type == 'checkbox'"
								size="sm"
								v-model="field.value"
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
import { FormControl, FileUploader, Button, Select } from 'frappe-ui'
import Switch from '@/components/Controls/Switch.vue'
import { onMounted, watch } from 'vue'
import { validateFile } from '@/utils'
import { X } from 'lucide-vue-next'
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

const resolveInitialValue = (field, dataValue) => {
	if (dataValue !== null && dataValue !== undefined && dataValue !== '') {
		return field.type === 'checkbox' ? !!dataValue : dataValue
	}
	if (field.default !== undefined) {
		return field.type === 'checkbox' ? !!field.default : field.default
	}
	return field.type === 'checkbox' ? false : ''
}

onMounted(() => {
	props.sections.forEach((section) => {
		section.columns.forEach((column) => {
			column.fields.forEach((field) => {
				field.value = resolveInitialValue(field, props.data[field.name])
			})
		})
	})
})

watch(
	props.sections,
	(newSections) => {
		// Only checkboxes v-model on field.value; sync them to data so the
		// document resource sees the change. Non-checkbox fields v-model
		// directly against data and must NOT be touched here — otherwise the
		// stale field.value clobbers user input whenever any checkbox toggles.
		newSections.forEach((section) => {
			section.columns.forEach((column) => {
				column.fields.forEach((field) => {
					if (field.type !== 'checkbox') return
					if (props.data[field.name] != field.value) {
						props.data[field.name] = field.value
					}
				})
			})
		})
	},
	{ deep: true }
)
</script>
