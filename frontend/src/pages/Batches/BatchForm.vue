<template>
	<SettingsPage v-if="doc">
		<SettingsGroup :title="__('Enrollment')" icon="lucide-user-plus">
			<SettingSwitch
				v-model="doc.allow_self_enrollment"
				:label="__('Self enrollment')"
				:summary="
					doc.allow_self_enrollment
						? __(
								'Learners enroll themselves, and pay first if the batch is paid.'
						  )
						: __('Learners are asked to contact you, and you enroll them.')
				"
			/>
			<SettingSwitch
				v-model="doc.allow_late_enrollment"
				:label="__('Allow enrolment after the batch starts')"
				:summary="
					doc.allow_late_enrollment
						? __('Learners can enroll until the last enrolment date.')
						: __('Enrolment closes when the batch starts.')
				"
			/>
			<SettingRow
				v-if="doc.allow_late_enrollment"
				:label="__('Last enrolment date')"
				:summary="
					__('Between the start and end dates, in the site\'s timezone.')
				"
			>
				<template #control>
					<DatePicker
						v-model="doc.last_enrollment_date"
						variant="outline"
						format="D MMM YYYY"
						:min="doc.start_date"
						:max="doc.end_date"
						:placeholder="__('Last enrolment date')"
						:aria-label="__('Last enrolment date')"
						class="w-60"
					/>
				</template>
			</SettingRow>
			<SettingLink
				v-model="doc.confirmation_email_template"
				:label="__('Confirmation email')"
				:summary="__('Sent to each learner when they are enrolled.')"
				doctype="Email Template"
				:placeholder="__('Default email')"
				:onCreate="openEmailTemplateForm"
			/>
		</SettingsGroup>

		<SettingsGroup :title="__('Pricing')" icon="lucide-credit-card">
			<SettingSwitch
				:modelValue="doc.paid_batch"
				:label="__('Paid batch')"
				@update:modelValue="setPaidBatch"
				:summary="__('Learners pay to enroll.')"
			/>
			<SettingRow v-if="doc.paid_batch" :label="__('Batch price')">
				<template #control>
					<PriceInput
						:currency="doc.currency"
						:amount="doc.amount"
						:missing="form?.isMissing('currency') || form?.isMissing('amount')"
						@update:currency="(value) => (doc!.currency = value)"
						@update:amount="(value) => (doc!.amount = value)"
					/>
				</template>
			</SettingRow>
			<PaymentsAppDialog v-model="needsPaymentsApp" />
		</SettingsGroup>

		<SettingsGroup :title="__('Certificate')" icon="lucide-award">
			<SettingSwitch
				v-model="doc.certification"
				:label="__('Certificate')"
				:summary="__('Issue a certificate to learners who complete the batch.')"
			/>
			<SettingSwitch
				v-model="doc.evaluation"
				:label="__('1-on-1 evaluation')"
				:summary="__('Learners book an evaluation with an evaluator.')"
			/>
			<SettingRow
				v-if="doc.evaluation"
				:label="__('Evaluation end date')"
				:summary="__('Learners can book until this date.')"
			>
				<template #control>
					<DatePicker
						v-model="doc.evaluation_end_date"
						variant="outline"
						format="D MMM YYYY"
						:min="doc.end_date"
						:placeholder="__('Evaluation end date')"
						:aria-label="__('Evaluation end date')"
						class="w-60"
					/>
				</template>
			</SettingRow>
		</SettingsGroup>

		<SettingsGroup :title="__('Live classes')" icon="lucide-video">
			<SettingField
				v-model="doc.conferencing_provider"
				type="select"
				:label="__('Video calls')"
				:summary="conferencingSummary"
				:options="conferencingOptions"
			/>
			<SettingLink
				v-if="doc.conferencing_provider === 'Zoom'"
				v-model="doc.zoom_account"
				:label="__('Zoom account')"
				doctype="LMS Zoom Settings"
				:onCreate="
					(_value: string | null, close?: () => void) =>
						openSettings('zoom', close)
				"
			/>
			<SettingLink
				v-else-if="doc.conferencing_provider === 'Google Meet'"
				v-model="doc.google_meet_account"
				:label="__('Google Meet account')"
				doctype="LMS Google Meet Settings"
				:onCreate="
					(_value: string | null, close?: () => void) =>
						openSettings('google-meet', close)
				"
			/>
		</SettingsGroup>

		<SettingsGroup :title="__('Search and sharing')" icon="lucide-search">
			<SettingField
				v-model="form!.meta.description"
				type="textarea"
				:label="__('Meta description')"
				:summary="__('Leave empty to use the short description.')"
				:placeholder="doc.description"
			/>
			<SettingField
				type="textarea"
				v-model="form!.meta.keywords"
				:label="__('Meta keywords')"
				:summary="__('Comma separated keywords for search engines.')"
			/>
			<SettingImage
				v-model="doc.meta_image"
				:label="__('Meta image')"
				:summary="__('Shown when the batch link is shared.')"
			/>
			<SettingRow
				:label="__('Meta preview')"
				:summary="
					__('Edit the meta description and meta image to change this.')
				"
			>
				<SearchPreview
					:url="batchUrl"
					:title="doc.title"
					:description="form?.meta.description || doc.description"
					:image="doc.meta_image"
				/>
			</SettingRow>
		</SettingsGroup>

		<BatchManageGroup :batch="batch" />
	</SettingsPage>
</template>

<script setup lang="ts">
import { DatePicker } from 'frappe-ui'
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SettingField from '@/components/InlineEdit/SettingField.vue'
import SettingImage from '@/components/InlineEdit/SettingImage.vue'
import SettingLink from '@/components/InlineEdit/SettingLink.vue'
import SettingSwitch from '@/components/InlineEdit/SettingSwitch.vue'
import SettingsGroup from '@/components/InlineEdit/SettingsGroup.vue'
import SettingsPage from '@/components/InlineEdit/SettingsPage.vue'
import SearchPreview from '@/components/InlineEdit/SearchPreview.vue'
import SettingRow from '@/components/InlineEdit/SettingRow.vue'
import PriceInput from '@/components/InlineEdit/PriceInput.vue'
import PaymentsAppDialog from '@/components/PaymentsAppDialog.vue'
import { usePaymentsApp } from '@/composables/usePaymentsApp'
import BatchManageGroup from '@/pages/Batches/components/BatchManageGroup.vue'
import { openBatchForm } from '@/composables/useBatchForms'
import { injectBatchForm } from '@/pages/Batches/composables/useBatchForm'
import { openSettings } from '@/utils'
import type { BatchDetails, Resource } from '@/types'

/** Batch settings: what is not edited in place on the overview. */
const props = defineProps<{ batch: Resource<BatchDetails | null> }>()

const router = useRouter()
const route = useRoute()
const form = injectBatchForm()
const doc = computed(() => form?.doc.value ?? null)
const { needsPaymentsApp, canSell } = usePaymentsApp()

const setPaidBatch = (paid: boolean | number | null | undefined): void => {
	if (!doc.value || (paid && !canSell()))
		return // The form keeps checkboxes as booleans.
	;(doc.value as Record<string, unknown>).paid_batch = Boolean(paid)
}

// The address learners share, without the scheme, as search results print it.
const batchUrl = computed<string>(
	() => `${window.location.host}/lms/batches/${doc.value?.name ?? ''}`
)

const conferencingOptions = [
	{ label: __('None'), value: '' },
	{ label: __('Zoom'), value: 'Zoom' },
	{ label: __('Google Meet'), value: 'Google Meet' },
]

const conferencingSummary = computed(() => {
	const account = doc.value?.zoom_account || doc.value?.google_meet_account
	if (!doc.value?.conferencing_provider) {
		return __('No account connected, so classes have no join links.')
	}
	return account
		? `${doc.value.conferencing_provider} · ${account}`
		: __('Pick the account classes are created from.')
})

const openEmailTemplateForm = (): void => {
	openBatchForm(
		router,
		'NewBatchEmailTemplate',
		props.batch.data?.name ?? '',
		route.hash
	)
}

// EmailTemplateForm is a route, so it hands the new name back in the URL.
// The param is stripped once adopted, or a reload would re-apply it.
watch(
	[() => route.query.emailTemplate, doc],
	([created]) => {
		if (typeof created !== 'string' || !created || !doc.value) return
		doc.value.confirmation_email_template = created
		const query = { ...route.query }
		delete query.emailTemplate
		router.replace({ ...route, query })
	},
	{ immediate: true, flush: 'post' }
)
</script>
