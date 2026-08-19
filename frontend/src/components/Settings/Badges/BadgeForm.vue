<template>
	<SettingsLayout
		:title="title"
		:show-back="true"
		v-model:enabled="badge.enabled"
		@back="emit('updateStep', 'list')"
	>
		<template #header-actions>
			<Button variant="solid" :loading="saving" @click="save">{{
				__('Save')
			}}</Button>
		</template>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 md:gap-y-0">
			<div class="space-y-4">
				<FormControl
					v-model="badge.title"
					:label="__('Title')"
					type="text"
					:required="true"
					:placeholder="__('e.g. Course Champion')"
				/>
				<Combobox
					:modelValue="badge.reference_doctype"
					:options="referenceDoctypeOptions"
					:label="__('Assign For')"
					:required="true"
					@update:modelValue="
						(value: string | null) => (badge.reference_doctype = value ?? '')
					"
				/>
				<FormControl
					v-model="badge.description"
					:label="__('Description')"
					:required="true"
					type="textarea"
					:placeholder="__('What is this badge awarded for?')"
				/>
				<Uploader
					v-model="badge.image"
					label="Badge Image"
					description="An image that represents the badge."
				/>
			</div>

			<div class="space-y-4">
				<BooleanSwitch
					size="sm"
					v-model="badge.grant_only_once"
					:label="__('Grant Only Once')"
					:description="__('Each user can only receive this badge one time.')"
				/>
				<Select
					v-model="badge.event"
					:label="__('Event')"
					:options="eventOptions"
					:required="true"
					class="w-full"
				/>
				<Select
					v-model="badge.user_field"
					:label="__('Assign To')"
					:options="userFieldOptions"
					:required="true"
					class="w-full"
				/>
				<CodeEditor
					v-model="badge.condition"
					:label="__('Condition')"
					type="JavaScript"
					:required="true"
					:showBorder="true"
					height="82px"
				/>
			</div>
			<div class="space-y-4"></div>
		</div>
	</SettingsLayout>
</template>
<script setup lang="ts">
import { Combobox, Button, call, FormControl, toast } from 'frappe-ui'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import { computed, ref, watch } from 'vue'
import { cleanError } from '@/utils'
import type { Badges, Badge } from '@/types'
import CodeEditor from '@/components/Controls/CodeEditor.vue'
import Uploader from '@/components/Controls/Uploader.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import Select from '@/components/Controls/Select.vue'

const emit = defineEmits<{ updateStep: ['list' | 'form'] }>()

const defaultBadge = {
	name: '',
	title: '',
	enabled: true,
	description: '',
	image: '',
	grant_only_once: false,
	event: 'New',
	reference_doctype: '',
	condition: '',
	user_field: 'member',
	field_to_check: '',
}
const badges = defineModel<Badges>('badges')
const badge = ref<Badge>(defaultBadge)

const props = defineProps<{
	badgeName: string | null
}>()

const title = computed(() =>
	props.badgeName && props.badgeName !== 'new'
		? badge.value?.title || props.badgeName
		: __('New Badge')
)

watch(
	() => props.badgeName,
	(val) => {
		if (val != 'new') {
			badges.value?.data?.forEach((bdg: Badge) => {
				if (bdg.name === val) {
					badge.value = bdg
				}
			})
		} else {
			badge.value = { ...defaultBadge }
		}
	}
)

const saving = ref<boolean>(false)
const save = () => saveBadge()

const saveBadge = async () => {
	saving.value = true
	try {
		if (props.badgeName == 'new') {
			createBadge()
		} else {
			await updateBadge()
		}
	} catch {
		saving.value = false
	}
}

const updateBadge = async () => {
	if (props.badgeName != badge.value?.title) {
		await renameDoc()
	}
	setValue()
}

const renameDoc = async () => {
	await call('frappe.client.rename_doc', {
		doctype: 'LMS Badge',
		old_name: props.badgeName,
		new_name: badge.value?.title,
	})
}

const setValue = () => {
	badges.value?.setValue.submit(
		{
			...badge.value,
			name: badge.value.title,
		},
		{
			onSuccess() {
				saving.value = false
				badges.value?.reload()
				emit('updateStep', 'list')
				toast.success(__('Badge updated successfully'))
			},
			onError(err: any) {
				saving.value = false
				emit('updateStep', 'list')
				toast.error(cleanError(err.messages[0]) || err)
			},
		}
	)
}

const createBadge = () => {
	badges.value?.insert.submit(
		{
			...badge.value,
			name: badge.value.name,
		},
		{
			onSuccess() {
				saving.value = false
				badges.value?.reload()
				emit('updateStep', 'list')
				toast.success(__('Badge created successfully'))
			},
			onError(err) {
				saving.value = false
				emit('updateStep', 'list')
				toast.error(cleanError(err.messages?.[0]) || __('Error creating badge'))
			},
		}
	)
}

const referenceDoctypeOptions = computed(() => {
	return [
		{ label: __('Course'), value: 'LMS Course' },
		{ label: __('Batch'), value: 'LMS Batch' },
		{ label: __('User'), value: 'Member' },
		{ label: __('Quiz Submission'), value: 'LMS Quiz Submission' },
		{ label: __('Assignment Submission'), value: 'LMS Assignment Submission' },
		{
			label: __('Programming Exercise Submission'),
			value: 'LMS Programming Exercise Submission',
		},
		{ label: __('Course Enrollment'), value: 'LMS Enrollment' },
		{ label: __('Batch Enrollment'), value: 'LMS Batch Enrollment' },
	]
})

const eventOptions = computed(() => {
	let options = ['New', 'Value Change', 'Manual Assignment']
	return options.map((event) => ({ label: __(event), value: event }))
})

const userFieldOptions = computed(() => {
	return [
		{ label: __('Member'), value: 'member' },
		{ label: __('Owner'), value: 'owner' },
	]
})
</script>
