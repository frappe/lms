<template>
	<Dialog
		v-model="show"
		:options="{
			title: badge ? __('Edit Badge') : __('Create a new Badge'),
			size: '3xl',
		}"
	>
		<template #body-content>
			<div class="grid grid-cols-2 gap-x-5">
				<div class="space-y-4">
					<FormControl
						v-model="badge.enabled"
						:label="__('Enabled')"
						type="checkbox"
					/>
					<FormControl
						v-model="badge.title"
						:label="__('Title')"
						type="text"
						:required="true"
					/>
					<Autocomplete
						@update:modelValue="(opt: any) => (badge.reference_doctype = opt.value)"
						:modelValue="badge.reference_doctype"
						:options="referenceDoctypeOptions"
						:required="true"
						:label="__('Assign For')"
					/>
					<FormControl
						v-model="badge.description"
						:label="__('Description')"
						:required="true"
						type="textarea"
					/>
					<Uploader
						v-model="badge.image"
						label="Badge Image"
						description="An image that represents the badge."
					/>
				</div>

				<div class="space-y-4">
					<FormControl
						v-model="badge.grant_only_once"
						:label="__('Grant Only Once')"
						type="checkbox"
					/>
					<FormControl
						v-model="badge.event"
						:label="__('Event')"
						type="select"
						:options="eventOptions"
						:required="true"
					/>
					<FormControl
						v-model="badge.user_field"
						:label="__('Assign To')"
						type="select"
						:options="userFieldOptions"
						:required="true"
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
		</template>
		<template #actions="{ close }">
			<div class="pb-5 float-right">
				<Button variant="solid" @click="saveBadge(close)">
					{{ __('Save') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Button, call, Dialog, FormControl, toast } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { cleanError } from '@/utils'
import type { Badges, Badge } from '@/components/Settings/types'
import Autocomplete from '@/components/Controls/Autocomplete.vue'
import CodeEditor from '@/components/Controls/CodeEditor.vue'
import Uploader from '@/components/Controls/Uploader.vue'

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
const show = defineModel<boolean>({ required: true, default: false })
const badges = defineModel<Badges>('badges')
const badge = ref<Badge>(defaultBadge)

const props = defineProps<{
	badgeName: string | null
}>()

watch(
	() => props.badgeName,
	(val) => {
		if (val != 'new') {
			badges.value?.data.forEach((bdg: Badge) => {
				if (bdg.name === val) {
					badge.value = bdg
				}
			})
		} else {
			badge.value = { ...defaultBadge }
		}
	}
)

const saveBadge = (close: () => void) => {
	if (props.badgeName == 'new') {
		createBadge(close)
	} else {
		updateBadge(close)
	}
}

const updateBadge = async (close: () => void) => {
	if (props.badgeName != badge.value?.title) {
		await renameDoc()
	}
	setValue(close)
}

const renameDoc = async () => {
	await call('frappe.client.rename_doc', {
		doctype: 'LMS Badge',
		old_name: props.badgeName,
		new_name: badge.value?.title,
	})
}

const setValue = (close: () => void) => {
	badges.value?.setValue.submit(
		{
			...badge.value,
			name: badge.value.title,
		},
		{
			onSuccess() {
				badges.value?.reload()
				close()
				toast.success(__('Badge updated successfully'))
			},
			onError(err: any) {
				close()
				toast.error(cleanError(err.messages[0]) || err)
			},
		}
	)
}

const createBadge = (close: () => void) => {
	badges.value?.insert.submit(
		{
			...badge.value,
			name: badge.value.name,
		},
		{
			onSuccess() {
				badges.value?.reload()
				close()
				toast.success(__('Badge created successfully'))
			},
			onError(err) {
				close()
				toast.error(cleanError(err.messages[0]) || __('Error creating badge'))
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
	let options = ['New', 'Value Change', 'Auto Assign']
	return options.map((event) => ({ label: __(event), value: event }))
})

const userFieldOptions = computed(() => {
	return [
		{ label: __('Member'), value: 'member' },
		{ label: __('Owner'), value: 'owner' },
	]
})
</script>
