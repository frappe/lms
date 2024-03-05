<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Create a Batch'),
			size: '3xl',
			actions: [
				{
					label: __('Save'),
					variant: 'solid',
					onClick: (close) => createBatch(close),
				},
			],
		}"
	>
		<template #body-content>
			<div>
				<div class="grid grid-cols-3 gap-4">
					<div>
						<FormControl
							v-model="batch.title"
							:label="__('Title')"
							class="mb-4"
						/>
						<FormControl
							v-model="batch.published"
							type="checkbox"
							:label="__('Published')"
						/>
					</div>
					<div>
						<FormControl
							v-model="batch.start_date"
							:label="__('Start Date')"
							type="date"
							class="mb-4"
						/>
						<FormControl
							v-model="batch.end_date"
							:label="__('End Date')"
							type="date"
							class="mb-4"
						/>
					</div>
					<div>
						<FormControl
							v-model="batch.start_time"
							:label="__('Start Time')"
							type="time"
							class="mb-4"
						/>
						<FormControl
							v-model="batch.end_time"
							:label="__('End Time')"
							type="time"
							class="mb-4"
						/>
					</div>
				</div>
				<div class="grid grid-cols-3 gap-4 mt-4 border-t pt-4">
					<div>
						<FormControl
							v-model="batch.seat_count"
							:label="__('Seat Count')"
							type="number"
							class="mb-4"
						/>
						<FormControl
							v-model="batch.evaluation_end_date"
							:label="__('Evaluation End Date')"
							type="date"
							class="mb-4"
						/>
					</div>
					<div>
						<FormControl
							v-model="batch.medium"
							:label="__('Medium')"
							class="mb-4"
						/>
						<FormControl
							v-model="batch.category"
							:label="__('Category')"
							class="mb-4"
						/>
					</div>
					<div>
						<FileUploader
							v-if="!batch.meta_image"
							:fileTypes="['image/*']"
							:validateFile="validateFile"
							@success="
								(file) => {
									batch.meta_image.value = file
								}
							"
						>
							<template
								v-slot="{ file, progress, uploading, openFileSelector }"
							>
								<div class="mb-4">
									<Button @click="openFileSelector" :loading="uploading">
										{{
											uploading ? `Uploading ${progress}%` : 'Upload an image'
										}}
									</Button>
								</div>
							</template>
						</FileUploader>
					</div>
				</div>
				<div class="border-t pt-4 mb-4">
					<FormControl
						v-model="batch.paid_batch"
						type="checkbox"
						:label="__('Paid Batch')"
					/>
					<FormControl
						v-model="batch.amount"
						:label="__('Amount')"
						type="number"
						class="my-4"
					/>
					<Link
						doctype="Currency"
						v-model="batch.currency"
						:filters="{ enabled: 1 }"
						:label="__('Currency')"
					/>
				</div>
				<div class="grid grid-cols-2 gap-4 border-y pt-4 mb-4"></div>
				<FormControl
					v-model="batch.description"
					:label="__('Description')"
					type="textarea"
					class="mb-4"
				/>
				<div>
					<label class="block text-sm text-gray-600 mb-1">
						{{ __('Batch Details') }}
					</label>
					<TextEditor
						:content="batch.batch_details"
						@change="(val) => (batch.batch_details = val)"
						:editable="true"
						:fixedMenu="true"
						editorClass="prose-sm max-w-none border-b border-x bg-gray-100 rounded-b-md py-1 px-2 min-h-[7rem] mb-4"
					/>
				</div>
				<FormControl
					v-model="batch.batch_details_raw"
					:label="__('Batch Details Raw')"
					type="textarea"
					class="mb-4"
				/>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import {
	Dialog,
	FormControl,
	TextEditor,
	FileUploader,
	Button,
} from 'frappe-ui'
import { reactive, defineModel } from 'vue'
import Link from '@/components/Controls/Link.vue'

const show = defineModel()

const batch = reactive({
	title: '',
	published: false,
	start_date: '',
	end_date: '',
	start_time: '',
	end_time: '',
	medium: '',
	category: '',
	seat_count: 0,
	evaluation_end_date: '',
	description: '',
	batch_details: '',
	batch_details_raw: '',
	meta_image: '',
	paid_batch: false,
	amount: 0,
	currency: '',
})
</script>
