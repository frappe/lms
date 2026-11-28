<template>
	<SettingsGroup :title="__('Access')" icon="lucide-door-open">
		<SettingSwitch
			v-for="row in accessRows"
			:key="row.label"
			:label="row.label"
			:summary="row.summary"
			:modelValue="row.value"
			@update:modelValue="row.set"
		/>
	</SettingsGroup>

	<SettingsGroup :title="__('Evaluation and certificate')" icon="lucide-award">
		<template v-if="hasCertificate">
			<SettingAction
				:label="__('Certificate template')"
				:summary="__('Certificates render from a Print Format.')"
				:action="__('Manage templates')"
				@click="openPrintFormats"
			/>
			<SettingLink
				v-if="doc.paid_certificate"
				v-model="doc.evaluator"
				:label="__('Evaluator')"
				:summary="__('Learners book a session with them after finishing.')"
				doctype="Course Evaluator"
				:placeholder="__('Select evaluator')"
				:onCreate="openEvaluatorModal"
				@update:modelValue="markDirty()"
			/>
			<SettingField
				v-if="doc.paid_certificate"
				v-model="doc.timezone"
				type="combobox"
				:label="__('Timezone')"
				:summary="__('Evaluation slots are shown in this timezone.')"
				:options="timezoneOptions"
				:placeholder="__('Select timezone')"
				@update:modelValue="markDirty()"
			/>
		</template>
		<SettingRow
			v-else
			:label="__('No certificate')"
			:summary="__('Turn on a certificate on the Overview page first.')"
		/>
	</SettingsGroup>

	<NewMemberModal
		v-model="showMemberModal"
		:defaultRoles="['batch_evaluator']"
		@created="onEvaluatorCreated"
	/>
</template>

<script setup lang="ts">
import { createResource } from 'frappe-ui'
import { computed, inject, ref } from 'vue'
import SettingAction from '@/components/InlineEdit/SettingAction.vue'
import SettingField from '@/components/InlineEdit/SettingField.vue'
import SettingLink from '@/components/InlineEdit/SettingLink.vue'
import SettingRow from '@/components/InlineEdit/SettingRow.vue'
import SettingSwitch from '@/components/InlineEdit/SettingSwitch.vue'
import SettingsGroup from '@/components/InlineEdit/SettingsGroup.vue'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'
import type { CourseFormContext, Resource } from '@/types'
import type { LMSCourse } from '@/types/lms/LMSCourse'
import { openExternal } from '@/utils/openExternal'

/** The Access and certificate sections of the Settings tab. */
const { resource, markDirty } = inject<CourseFormContext>('courseForm')!

const doc = computed(() => resource.doc!)
const showMemberModal = ref<boolean>(false)

type Flag = 'upcoming' | 'featured' | 'enforce_lesson_completion'

function setFlag(field: Flag | 'disable_self_learning', value: boolean): void {
	;(doc.value as LMSCourse)[field] = value ? 1 : 0
	markDirty()
}

const flagRow = (field: Flag, label: string, summary: string) => ({
	label,
	summary,
	value: Boolean(doc.value[field]),
	set: (value: boolean) => setFlag(field, value),
})

const accessRows = computed(() => [
	{
		label: __('Self enrollment'),
		summary: doc.value.disable_self_learning
			? __('Off: you enroll people from the Dashboard.')
			: __('Learners enroll themselves.'),
		value: !doc.value.disable_self_learning,
		set: (value: boolean) => setFlag('disable_self_learning', !value),
	},
	flagRow(
		'enforce_lesson_completion',
		__('Lessons in sequence'),
		__('Each lesson opens only after the previous one is complete.')
	),
	flagRow(
		'upcoming',
		__('Upcoming'),
		__('Show the course before it opens. Learners can ask to be notified.')
	),
	flagRow(
		'featured',
		__('Featured'),
		__('Highlight the course on the homepage.')
	),
])

const hasCertificate = computed<boolean>(() =>
	Boolean(doc.value.enable_certification || doc.value.paid_certificate)
)

const timezoneResource = createResource({
	url: 'frappe.geo.country_info.get_country_timezone_info',
	auto: true,
	transform: (data: { all_timezones: string[] }) => data.all_timezones,
}) as Resource<string[] | null>

const timezoneOptions = computed<{ label: string; value: string }[]>(() =>
	(timezoneResource.data || []).map((zone) => ({ label: zone, value: zone }))
)

function openPrintFormats(): void {
	openExternal('/app/print-format?doc_type=LMS Certificate')
}

function openEvaluatorModal(): void {
	showMemberModal.value = true
}

function onEvaluatorCreated(created: { name: string }): void {
	doc.value.evaluator = created.name
	markDirty()
}
</script>
