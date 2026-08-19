<template>
	<FormShell :title="__('New Batch')" size="3xl" @close="close">
		<template #default>
			<div v-if="!canCreateBatch" class="p-4 text-base text-ink-gray-6">
				{{ __('You are not permitted to create a batch.') }}
			</div>
			<div v-else data-testid="new-batch-fields" class="text-base">
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
						type="time"
						:label="__('Start Time')"
						:required="true"
						variant="outline"
					/>
					<FormControl
						v-model="batch.end_time"
						type="time"
						:label="__('End Time')"
						:required="true"
						variant="outline"
					/>
					<Combobox
						v-model="batch.timezone"
						:options="timezoneOptions"
						:placeholder="__('Select timezone')"
						:label="__('Timezone')"
						:required="true"
						variant="outline"
						class="w-full"
					/>
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
					<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
						<FormControl
							v-model="batch.description"
							:label="__('Description')"
							type="textarea"
							:required="true"
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
						<InputLabel
							:id="batchDetailsLabelId"
							:for-id="batchDetailsId"
							:label="__('Batch Details')"
							:required="true"
						/>
						<div
							class="rounded-t-lg rounded-b-md outline-none transition-[box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
						>
							<RichTextEditor
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
		<template #actions>
			<div v-if="canCreateBatch" class="flex items-center justify-end">
				<HeaderButton
					data-testid="new-batch-save"
					:label="__('Save')"
					variant="solid"
					:loading="batches.insert.loading"
					@click="saveBatch()"
				/>
			</div>
		</template>
	</FormShell>
	<NewMemberModal
		v-model="showMemberModal"
		:defaultRoles="['batch_evaluator']"
		@created="onInstructorCreated"
	/>
</template>
<script setup lang="ts">
import {
	Combobox,
	FormControl,
	createListResource,
	createResource,
	toast,
} from 'frappe-ui'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import { computed, inject, onMounted, onBeforeUnmount, ref } from 'vue'
import { createLMSCategory, cleanError } from '@/utils'
import { sanitizeOnWrite } from '@/utils/sanitizeOnWrite'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { useFormRoute } from '@/composables/useFormRoute'
import MultiLink from '@/components/Controls/MultiLink.vue'
import Link from '@/components/Controls/Link.vue'
import Select from '@/components/Controls/Select.vue'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import { InputLabel, useInputLabeling } from '@/components/Form/labeling'
import { submitResource } from '@/utils/resource'

const { capture } = useTelemetry()
const { updateOnboardingStep } = useOnboarding('learning')
const user = inject<any>('$user')
const showMemberModal = ref(false)
const { inputId: batchDetailsId, labelId: batchDetailsLabelId } =
	useInputLabeling({})

const { close, saveAndReplace } = useFormRoute({ name: 'Batches' })

// Its own list resource — but the cache key is deliberately byte-identical to
// Batches.vue:167. createListResource returns the cached instance and discards
// this call's options (listResource.js:15-22), so a saved batch shows up in the
// list purely because insert.onSuccess refetches THAT instance (:123-126).
// Disambiguating either key — a filter, a tab, a start — silently breaks that.
const batches = createListResource({
	doctype: 'LMS Batch',
	url: 'lms.lms.utils.get_batches',
	cache: ['batches', user.data?.name],
	pageLength: 24,
})

// Copied from Batches.vue:358-364. The list page gates the button; a URL does
// not go through the button.
const canCreateBatch = computed(() => {
	// Cast because Window has no read_only_mode declaration; same shape as
	// CourseCardOverlay.vue:161, the other typed SFC that reads this flag.
	if ((window as Window & { read_only_mode?: boolean }).read_only_mode)
		return false
	return Boolean(
		user.data?.is_moderator ||
			user.data?.is_instructor ||
			user.data?.is_evaluator
	)
})

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
	const fields = batch.value as Record<string, unknown>
	for (const key of Object.keys(fields)) {
		const value = fields[key]
		if (typeof value === 'string') {
			fields[key] = sanitizeOnWrite(value)
		}
	}
}

const saveBatch = () => {
	if (!canCreateBatch.value) return
	validateFields()
	submitResource(
		batches.insert,
		{
			...batch.value,
			instructors: batch.value.instructors.map((instructor) => ({
				instructor: instructor,
			})),
		},
		{
			onSuccess(data: any) {
				toast.success(__('Batch created successfully'))
				capture('batch_created')
				// replace, not push: the form entry is consumed so Back reaches
				// the list rather than a stale empty form.
				saveAndReplace({
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
