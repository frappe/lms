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
				<div class="grid grid-cols-1 md:grid-cols-3 gap-5">
					<FormControl
						v-model="batch.title"
						:label="__('Title')"
						:required="true"
						variant="outline"
						autocomplete="off"
					/>
					<FormControl
						v-model="batch.start_date"
						:label="__('Start Date')"
						type="date"
						:required="true"
						variant="outline"
					/>
					<FormControl
						v-model="batch.end_date"
						:label="__('End Date')"
						type="date"
						:required="true"
						variant="outline"
					/>
					<FormControl
						v-model="batch.start_time"
						:label="__('Start Time')"
						type="time"
						:required="true"
						variant="outline"
					/>
					<FormControl
						v-model="batch.end_time"
						:label="__('End Time')"
						type="time"
						:required="true"
						variant="outline"
					/>
					<div class="space-y-1.5">
						<FormLabel :label="__('Timezone')" :required="true" />
						<Combobox
							v-model="batch.timezone"
							:options="timezoneOptions"
							:placeholder="__('Select timezone')"
							variant="outline"
							class="w-full"
						/>
					</div>
					<Link
						v-model="batch.category"
						doctype="LMS Category"
						:label="__('Category')"
						variant="outline"
						:onCreate="createCategory"
					/>
					<FormControl
						v-model="batch.seat_count"
						:label="__('Seat Count')"
						type="number"
						:required="false"
						variant="outline"
					/>
					<Select
						v-model="batch.medium"
						:label="__('Medium')"
						:options="mediumOptions"
						variant="outline"
						class="w-full"
					/>
				</div>

				<div class="space-y-5 border-t mt-5 pt-5">
					<div class="grid grid-cols-2 gap-5">
						<FormControl
							v-model="batch.description"
							:label="__('Description')"
							type="textarea"
							:required="true"
							:rows="4"
							variant="outline"
						/>
						<MultiLink
							v-model="batch.instructors"
							doctype="User"
							url="lms.lms.api.search_users_by_role"
							:searchParams="{ roles: JSON.stringify(['Batch Evaluator']) }"
							:label="__('Instructors')"
							:placeholder="__('Select instructors')"
							:required="true"
							variant="outline"
							:onCreate="() => (showMemberModal = true)"
						/>
					</div>
					<div class="space-y-1.5">
						<FormLabel
							:label="__('Batch Details')"
							:id="batchDetailsId"
							:required="true"
						/>
						<div
							class="rounded-t-lg rounded-b-md outline-none transition-[box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-within:ring-2 ring-outline-gray-3"
						>
							<TextEditor
								:id="batchDetailsId"
								:content="batch.batch_details"
								@change="(val: string) => (batch.batch_details = val)"
								:editable="true"
								:fixedMenu="true"
								editorClass="prose-sm max-w-none border-b border-x border-outline-gray-2 hover:border-outline-gray-3 hover:shadow-sm focus-within:border-outline-gray-4 focus-within:shadow-sm rounded-b-md py-1 px-2 min-h-[10rem] max-h-[14rem] overflow-auto transition-colors"
							/>
						</div>
					</div>
				</div>
			</div>
		</template>
		<template #actions="{ close }">
			<div class="text-end">
				<Button variant="solid" @click="saveBatch(close)">
					{{ __('Save') }}
				</Button>
			</div>
		</template>
	</Dialog>
	<NewMemberModal
		v-model="showMemberModal"
		:defaultRoles="['batch_evaluator']"
		@created="onInstructorCreated"
	/>
</template>
<script setup lang="ts">
import {
	Button,
	Combobox,
	Dialog,
	FormControl,
	FormLabel,
	TextEditor,
	createResource,
	toast,
} from 'frappe-ui'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import { computed, inject, onMounted, onBeforeUnmount, ref, useId } from 'vue'
import { useRouter } from 'vue-router'
import { sanitizeHTML, createLMSCategory, cleanError } from '@/utils'
import MultiLink from '@/components/Controls/MultiLink.vue'
import Link from '@/components/Controls/Link.vue'
import Select from '@/components/Controls/Select.vue'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'

const show = defineModel<boolean>({ required: true, default: false })
const router = useRouter()
const { capture } = useTelemetry()
const { updateOnboardingStep } = useOnboarding('learning')
const user = inject<any>('$user')
const showMemberModal = ref(false)
const batchDetailsId = useId()

const props = defineProps<{
	batches: any
}>()

type Batch = {
	title: string
	start_date: string | null
	end_date: string | null
	start_time: string | null
	end_time: string | null
	timezone: string | null
	description: string
	batch_details: string
	instructors: string[]
	category: string | null
	seat_count: number
	medium: string | null
}

const batch = ref<Batch>({
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
	medium: null,
})

const createCategory = (name: string, done: () => void) => {
	createLMSCategory(name).then((categoryName: string) => {
		if (!categoryName) return
		batch.value.category = categoryName
		done()
	})
}

const onInstructorCreated = (user: any) => {
	batch.value.instructors = [...batch.value.instructors, user.name]
}

const validateFields = () => {
	Object.keys(batch.value).forEach((key) => {
		if (typeof batch.value[key as keyof Batch] === 'string') {
			batch.value[key as keyof Batch] = sanitizeHTML(
				batch.value[key as keyof Batch] as string
			)
		}
	})
}

const saveBatch = (close: () => void = () => {}) => {
	validateFields()
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
				const message = err?.messages?.[0]
				toast.error(message ? cleanError(message) : __('Error creating batch'))
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
	capture('batch_form_opened')
})

onBeforeUnmount(() => {
	window.removeEventListener('keydown', keyboardShortcut)
	capture('batch_form_closed', {
		data: batch.value,
	})
})

const timezoneResource = createResource({
	url: 'frappe.geo.country_info.get_country_timezone_info',
	auto: true,
	transform: (data: any) => data.all_timezones,
})

const timezoneOptions = computed(() =>
	(timezoneResource.data || []).map((tz: string) => ({ label: tz, value: tz }))
)

const mediumOptions = computed(() => {
	return [
		{
			label: __('Online'),
			value: 'Online',
		},
		{
			label: __('Offline'),
			value: 'Offline',
		},
	]
})
</script>
