<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('New Batch'),
			size: '3xl',
		}"
	>
		<template #body-content>
			<div class="text-base">
				<div class="grid grid-cols-2 gap-10">
					<div class="space-y-5">
						<FormControl
							v-model="batch.title"
							:label="__('Title')"
							:required="true"
						/>
						<FormControl
							v-model="batch.start_date"
							:label="__('Start Date')"
							type="date"
							:required="true"
						/>
						<FormControl
							v-model="batch.end_date"
							:label="__('End Date')"
							type="date"
							:required="true"
						/>
						<Link
							doctype="LMS Category"
							v-model="batch.category"
							:label="__('Category')"
							:allowCreate="true"
							@create="
								() => {
									openSettings('Categories')
									show = false
								}
							"
						/>
					</div>
					<div class="space-y-5">
						<FormControl
							v-model="batch.start_time"
							:label="__('Start Time')"
							type="time"
							:required="true"
						/>
						<FormControl
							v-model="batch.end_time"
							:label="__('End Time')"
							type="time"
							:required="true"
						/>
						<FormControl
							v-model="batch.timezone"
							:label="__('Timezone')"
							:required="true"
						/>
						<FormControl
							v-model="batch.seat_count"
							:label="__('Seat Count')"
							type="number"
							:required="false"
						/>
					</div>
				</div>

				<div class="space-y-5 border-t mt-5 pt-5">
					<MultiSelect
						v-model="batch.instructors"
						doctype="Course Evaluator"
						:label="__('Instructors')"
						:required="true"
						:onCreate="(close: () => void) => openSettings('Evaluators', close)"
						:filters="{ ignore_user_type: 1 }"
					/>
					<FormControl
						v-model="batch.description"
						:label="__('Description')"
						type="textarea"
						:required="true"
						:rows="4"
					/>
					<div class="">
						<div class="mb-1.5 text-sm text-ink-gray-5">
							{{ __('Batch Details') }}
							<span class="text-ink-red-3">*</span>
						</div>
						<TextEditor
							:content="batch.batch_details"
							@change="(val: string) => (batch.batch_details = val)"
							:editable="true"
							:fixedMenu="true"
							editorClass="prose-sm max-w-none border-b border-x bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[10rem]"
						/>
					</div>
				</div>
			</div>
		</template>
		<template #actions="{ close }">
			<div class="text-right">
				<Button variant="solid" @click="saveBatch(close)">
					{{ __('Save') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Button, Dialog, FormControl, TextEditor, toast } from 'frappe-ui'
import { Link, useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import { ref, inject, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { cleanError, openSettings } from '@/utils'
import MultiSelect from '@/components/Controls/MultiSelect.vue'

const show = defineModel<boolean>({ required: true, default: false })
const router = useRouter()
const { capture } = useTelemetry()
const { updateOnboardingStep } = useOnboarding('learning')
const user = inject<any>('$user')

const props = defineProps<{
	batches: any
}>()

const batch = ref({
	title: '',
	start_date: null,
	end_date: null,
	start_time: null,
	end_time: null,
	timezone: null,
	description: '',
	batch_details: '',
	instructors: [],
	category: null,
	seat_count: 0,
})

const saveBatch = (close: () => void = () => {}) => {
	props.batches.insert.submit(
		{
			...batch.value,
			instructors: batch.value.instructors.map((instructor) => ({
				instructor: instructor,
			})),
		},
		{
			onSuccess(data: any) {
				toast.success(__('Batch created successfully'))
				close()
				capture('batch_created')
				router.push({
					name: 'BatchDetail',
					params: { batchName: data.name },
					hash: '#settings',
				})
				if (user.data?.is_system_manager) {
					updateOnboardingStep('create_first_batch', true, false, () => {
						localStorage.setItem('firstBatch', data.name)
					})
				}
			},
			onError(err: any) {
				toast.error(cleanError(err.messages?.[0]))
				console.error(err)
			},
		}
	)
}

const keyboardShortcut = (e: KeyboardEvent) => {
	if (
		e.key === 's' &&
		(e.ctrlKey || e.metaKey) &&
		e.target &&
		e.target instanceof HTMLElement &&
		!e.target.classList.contains('ProseMirror')
	) {
		saveBatch()
		e.preventDefault()
	}
}

onMounted(() => {
	window.addEventListener('keydown', keyboardShortcut)
})

onBeforeUnmount(() => {
	window.removeEventListener('keydown', keyboardShortcut)
})

watch(show, () => {
	if (show.value) capture('batch_form_opened')
})
</script>
