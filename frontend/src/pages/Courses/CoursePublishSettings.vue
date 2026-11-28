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

	<SettingsGroup :title="__('Pricing')" icon="lucide-credit-card">
		<SettingSwitch
			:label="__('Paid course')"
			:summary="__('Learners pay to enroll.')"
			:modelValue="Boolean(doc.paid_course)"
			@update:modelValue="setPaidCourse"
		/>
		<SettingRow v-if="doc.paid_course" :label="__('Course price')">
			<template #control>
				<PriceInput
					:currency="doc.currency"
					:amount="doc.course_price"
					:missing="isMissing?.('price')"
					@update:currency="(value) => setField('currency', value)"
					@update:amount="(value) => setField('course_price', value)"
				/>
			</template>
		</SettingRow>
	</SettingsGroup>

	<SettingsGroup :title="__('Certificate')" icon="lucide-award">
		<SettingSwitch
			:label="__('Completion certificate')"
			:summary="
				__('Issue a free certificate when learners complete the course.')
			"
			:modelValue="certificate === 'free'"
			@update:modelValue="(on) => setCertificate(on ? 'free' : 'none')"
		/>
		<template v-if="!doc.paid_course">
			<SettingSwitch
				:label="__('Paid certificate')"
				:summary="
					__('Sell an evaluator-graded certificate alongside this free course.')
				"
				:modelValue="certificate === 'paid'"
				@update:modelValue="(on) => setCertificate(on ? 'paid' : 'none')"
			/>
			<SettingRow
				v-if="certificate === 'paid'"
				:label="__('Certificate price')"
			>
				<template #control>
					<PriceInput
						:currency="doc.currency"
						:amount="doc.course_price"
						:missing="isMissing?.('price')"
						@update:currency="(value) => setField('currency', value)"
						@update:amount="(value) => setField('course_price', value)"
					/>
				</template>
			</SettingRow>
		</template>
		<template v-if="certificate !== 'none'">
			<SettingAction
				:label="__('Certificate template')"
				:summary="__('Certificates render from a Print Format.')"
				:action="__('Manage templates')"
				@click="openPrintFormats"
			/>
			<SettingLink
				v-if="certificate === 'paid'"
				v-model="doc.evaluator"
				:label="__('Evaluator')"
				:summary="__('Learners book a session with them after finishing.')"
				doctype="Course Evaluator"
				:placeholder="__('Select evaluator')"
				:onCreate="openEvaluatorModal"
				@update:modelValue="markDirty()"
			/>
			<SettingField
				v-if="certificate === 'paid'"
				v-model="doc.timezone"
				type="combobox"
				:label="__('Timezone')"
				:summary="__('Evaluation slots are shown in this timezone.')"
				:options="timezoneOptions"
				:placeholder="__('Select timezone')"
				@update:modelValue="markDirty()"
			/>
		</template>
	</SettingsGroup>

	<PaymentsAppDialog v-model="needsPaymentsApp" />

	<NewMemberModal
		v-model="showMemberModal"
		:defaultRoles="['batch_evaluator']"
		@created="onEvaluatorCreated"
	/>
</template>

<script setup lang="ts">
import { createResource } from 'frappe-ui'
import { computed, ref } from 'vue'
import SettingAction from '@/components/InlineEdit/SettingAction.vue'
import SettingField from '@/components/InlineEdit/SettingField.vue'
import SettingLink from '@/components/InlineEdit/SettingLink.vue'
import SettingRow from '@/components/InlineEdit/SettingRow.vue'
import SettingSwitch from '@/components/InlineEdit/SettingSwitch.vue'
import PriceInput from '@/components/InlineEdit/PriceInput.vue'
import PaymentsAppDialog from '@/components/PaymentsAppDialog.vue'
import { useCourseOffer } from '@/composables/useCourseOffer'
import SettingsGroup from '@/components/InlineEdit/SettingsGroup.vue'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'
import type { Resource } from '@/types'
import type { LMSCourse } from '@/types/lms/LMSCourse'
import { openExternal } from '@/utils/openExternal'

/** The Access, Pricing and Certificate sections of the Settings tab. */
const {
	resource,
	markDirty,
	isMissing,
	certificate,
	needsPaymentsApp,
	setField,
	setPaidCourse,
	setCertificate,
} = useCourseOffer()

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
