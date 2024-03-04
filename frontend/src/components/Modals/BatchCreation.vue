<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Create a Batch'),
			size: 'xl',
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
				<FormControl v-model="batch.title" :label="__('Title')" class="mb-4" />
				<FormControl
					v-model="batch.published"
					type="checkbox"
					:label="__('Published')"
					class="mb-4"
				/>
				<div class="grid grid-cols-2 gap-4">
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
				<div class="grid grid-cols-2">
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
				</div>
				<FormControl
					v-model="batch.description"
					:label="__('Description')"
					type="textarea"
					class="mb-4"
				/>
				<TextEditor
					v-model="batch.batch_details"
					:label="__('Batch Details')"
					class="mb-4"
				/>
				<FormControl
					v-model="batch_details.raw"
					:label="__('Batch Details')"
					type="textarea"
					class="mb-4"
				/>
				<FileUploader
					v-if="!image"
					:fileTypes="['image/*']"
					:validateFile="validateFile"
					@success="
						(file) => {
							image = file
						}
					"
				>
					<template v-slot="{ file, progress, uploading, openFileSelector }">
						<div class="mb-4">
							<Button @click="openFileSelector" :loading="uploading">
								{{ uploading ? `Uploading ${progress}%` : 'Upload an image' }}
							</Button>
						</div>
					</template>
				</FileUploader>
				<div>
					<FormControl
						v-model="batch.paid_batch"
						type="checkbox"
						:label="__('Paid Batch')"
						class="mb-4"
					/>
					<FormControl
						v-model="batch.amount"
						:label="__('Amount')"
						type="number"
						class="mb-4"
					/>
					<Link
						doctype="Currency"
						v-model="course.currency"
						:filters="{ enabled: 1 }"
						:label="__('Currency')"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, FormControl, TextEditor, FileUploader, Link } from 'frappe-ui'

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
