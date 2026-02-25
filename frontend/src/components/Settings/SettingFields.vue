<template>
	<div class="mb-5 divide-y divide-outline-gray-modals overflow-y-auto">
		<div v-for="(section, index) in sections" class="py-5">
			<div v-if="section.label" class="font-semibold text-ink-gray-9 mb-4">
				{{ section.label }}
			</div>
			<div
				:class="{
					'flex justify-between space-x-8 w-full': section.columns.length > 1,
				}"
			>
				<div
					v-for="(column, index) in section.columns"
					class="w-full space-y-5"
				>
					<div v-for="field in column.fields">
						<Link
							v-if="field.type == 'Link'"
							v-model="data[field.name]"
							:doctype="field.doctype"
							:label="__(field.label)"
							:description="__(field.description)"
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
								<div class="flex items-center text-sm space-x-2">
									<div
										class="flex items-center justify-center rounded border border-outline-gray-modals bg-surface-gray-2"
										:class="field.size == 'lg' ? 'px-5 py-5' : 'px-20 py-8'"
									>
										<img
											:src="data[field.name]?.file_url || data[field.name]"
											class="rounded"
											:class="field.size == 'lg' ? 'w-36' : 'size-6'"
										/>
									</div>
									<div class="flex flex-col flex-wrap">
										<span class="break-all text-ink-gray-9">
											{{
												data[field.name]?.file_name ||
												data[field.name].split('/').pop()
											}}
										</span>
										<span
											v-if="data[field.name]?.file_size"
											class="text-sm text-ink-gray-5 mt-1"
										>
											{{ getFileSize(data[field.name]?.file_size) }}
										</span>
									</div>
									<X
										@click="data[field.name] = null"
										class="border text-ink-gray-7 border-outline-gray-modals rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ml-4"
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
							placeholder=""
						/>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { FormControl, FileUploader, Button, Switch } from 'frappe-ui'
import { computed, onMounted, watch } from 'vue'
import { getFileSize, validateFile } from '@/utils'
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

onMounted(() => {
	props.sections.forEach((section) => {
		section.columns.forEach((column) => {
			column.fields.forEach((field) => {
				if (field.type == 'checkbox') {
					field.value = props.data[field.name] ? true : false
				} else {
					field.value = props.data[field.name]
				}
			})
		})
	})
})

watch(
	props.sections,
	(newSections) => {
		// Makes the form dirty on change
		newSections.forEach((section) => {
			section.columns.forEach((column) => {
				column.fields.forEach((field) => {
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
