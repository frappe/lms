<template>
	<div class="mb-5 divide-y divide-outline-gray-modals overflow-y-auto">
		<div v-for="(section, index) in sections" class="py-5">
			<div v-if="section.label" class="font-semibold text-ink-gray-9 mb-4">
				{{ section.label }}
			</div>
			<div
				:class="
					section.columns.length > 1
						? 'grid grid-cols-2 gap-x-8 gap-y-5 w-full items-start'
						: 'w-full space-y-5'
				"
			>
				<template
					v-for="(column, columnIndex) in section.columns"
					:key="columnIndex"
				>
					<div
						v-for="(field, fieldIndex) in column.fields"
						:key="`${columnIndex}-${fieldIndex}`"
						:style="
							section.columns.length > 1
								? { gridColumn: columnIndex + 1, gridRow: fieldIndex + 1 }
								: {}
						"
					>
						<Link
							v-if="field.type == 'Link'"
							v-model="data[field.name]"
							:doctype="field.doctype"
							:label="__(field.label)"
							:description="__(field.description)"
							:required="field.reqd"
						/>

						<div v-else-if="field.type == 'Code'">
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

						<div v-else-if="field.type == 'Upload'">
							<div class="space-y-1 mb-2">
								<div class="text-sm text-ink-gray-9 font-medium">
									{{ __(field.label) }}
								</div>
								<div class="text-sm text-ink-gray-5 leading-5">
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
						<Switch
							v-else-if="field.type == 'checkbox'"
							size="sm"
							:label="__(field.label)"
							:description="__(field.description)"
							v-model="field.value"
						/>
						<!-- <div v-else>
							{{ data[field.name] }}

						</div> -->
						<FormControl
							v-else
							:key="field.name"
							v-model="data[field.name]"
							:label="__(field.label)"
							:type="field.type"
							:rows="field.rows"
							:options="field.options"
							:description="field.description"
							:required="field.reqd"
							placeholder=""
						/>
					</div>
				</template>
			</div>
		</div>
	</div>
</template>
<script setup>
import { FormControl, FileUploader, Button } from 'frappe-ui'
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
