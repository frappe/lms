<template>
	<div class="">
		<CollapsibleSection :label="__('Visibility')">
			<div class="flex flex-col gap-y-4">
				<BooleanSwitch
					size="sm"
					v-model="doc.upcoming"
					:label="__('Upcoming')"
					:description="__('Not yet open for enrollment.')"
					@update:modelValue="markDirty()"
				/>
				<BooleanSwitch
					size="sm"
					v-model="doc.featured"
					:label="__('Featured')"
					:description="__('Highlight on the homepage.')"
					@update:modelValue="markDirty()"
				/>
				<BooleanSwitch
					size="sm"
					v-model="selfEnrollment"
					:label="__('Self enrollment')"
					:description="__('Let users enroll themselves.')"
				/>
				<BooleanSwitch
					size="sm"
					v-model="doc.enforce_lesson_completion"
					:label="__('Enforce Lesson Completion')"
					:description="
						__('Students must complete each lesson before the next one opens.')
					"
					@update:modelValue="markDirty()"
				/>
			</div>
		</CollapsibleSection>

		<CollapsibleSection :label="__('Pricing and certification')">
			<div class="flex flex-col gap-y-4">
				<BooleanSwitch
					size="sm"
					:modelValue="Boolean(doc?.paid_course)"
					:label="__('Paid course')"
					:description="__('Charge learners to enroll in this course.')"
					@update:modelValue="setPaidCourse"
				/>

				<template v-if="doc?.paid_course">
					<Link
						v-model="doc.currency"
						doctype="Currency"
						:label="__('Currency')"
						:filters="{ enabled: 1 }"
						:placeholder="__('Select currency')"
						variant="outline"
						:required="true"
						@update:modelValue="markDirty()"
					/>
					<FormControl
						ref="coursePriceInput"
						v-model="doc.course_price"
						type="number"
						min="0"
						:label="__('Course price')"
						variant="outline"
						:required="true"
						@input="markDirty()"
					/>
					<div class="border-t -mx-5" />
					<BooleanSwitch
						size="sm"
						v-model="doc.enable_certification"
						:label="__('Completion certificate')"
						:description="
							__('Issue a free certificate when learners complete the course.')
						"
						@update:modelValue="markDirty()"
					/>
				</template>

				<template v-else>
					<div class="border-t -mx-5" />
					<BooleanSwitch
						size="sm"
						v-model="doc.enable_certification"
						:label="__('Completion certificate')"
						:description="
							__('Issue a free certificate when learners complete the course.')
						"
						@update:modelValue="markDirty()"
					/>
					<BooleanSwitch
						size="sm"
						:modelValue="doc.paid_certificate"
						:label="__('Paid certificate')"
						:description="
							__(
								'Sell an evaluator-graded certificate alongside this free course.'
							)
						"
						@update:modelValue="setPaidCertificate"
					/>
					<template v-if="doc.paid_certificate">
						<Link
							v-model="doc.currency"
							doctype="Currency"
							:label="__('Currency')"
							:filters="{ enabled: 1 }"
							:placeholder="__('Select currency')"
							variant="outline"
							:required="true"
							@update:modelValue="markDirty()"
						/>
						<FormControl
							v-model="doc.course_price"
							type="number"
							min="0"
							:label="__('Certificate price')"
							variant="outline"
							:required="true"
							@input="markDirty()"
						/>
						<Link
							ref="evaluatorLinkRef"
							v-model="doc.evaluator"
							doctype="Course Evaluator"
							:label="__('Evaluator')"
							:placeholder="__('Select evaluator')"
							variant="outline"
							:onCreate="openEvaluatorModal"
							@update:modelValue="markDirty()"
						/>
						<FormControl
							v-model="doc.timezone"
							type="combobox"
							:label="__('Timezone')"
							:options="timezoneOptions"
							:placeholder="__('Select timezone')"
							variant="outline"
							@update:modelValue="markDirty()"
						/>
					</template>
				</template>

				<div
					v-if="doc?.enable_certification || doc?.paid_certificate"
					class="flex flex-wrap items-center gap-1 text-p-sm text-ink-gray-6"
				>
					<span>
						{{
							__(
								'Certificates render from a Print Format. Build or customize templates from the desk.'
							)
						}}
					</span>
					<button
						type="button"
						class="font-medium text-ink-gray-8 underline"
						@click="openPrintFormats"
					>
						{{ __('Manage templates') }}
					</button>
				</div>
			</div>
		</CollapsibleSection>
	</div>

	<NewMemberModal
		v-model="showMemberModal"
		:defaultRoles="['batch_evaluator']"
		@created="onEvaluatorCreated"
	/>

	<Dialog
		v-model:open="showPaymentsAppModal"
		:title="__('Payments app required')"
		:actions="[
			{
				label: __('Get the Payments app'),
				variant: 'solid',
				onClick: ({ close }: any) => {
					openPaymentsApp()
					close()
				},
			},
		]"
	>
		<template #default>
			<p class="text-p-base text-ink-gray-7">
				{{
					__(
						'Selling a paid course or certificate needs the Payments app. Install it from the Frappe Marketplace, then turn on pricing here.'
					)
				}}
			</p>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { Dialog, FormControl, createResource } from 'frappe-ui'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import { computed, inject, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CollapsibleSection from '@/components/CollapsibleSection.vue'
import Link from '@/components/Controls/Link.vue'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'
import { useSettings } from '@/stores/settings'
import type { CourseFormContext, Resource } from '@/types'
import { openExternal } from '@/utils/openExternal'

const { resource, markDirty, markUnsaved } =
	inject<CourseFormContext>('courseForm')!
const dayjs = inject('$dayjs') as typeof import('dayjs')

const settingsStore = useSettings()
// Only block when we positively know the app is missing; if settings haven't
// loaded yet, let it through (the backend validation is the hard guard).
const paymentsAppMissing = computed<boolean>(
	() =>
		!!settingsStore.settings.data &&
		!settingsStore.settings.data.is_payments_app_installed
)

const doc = computed(() => resource.doc)
const evaluatorLinkRef = ref<{ reload: () => void } | null>(null)
const showMemberModal = ref<boolean>(false)
const showPaymentsAppModal = ref<boolean>(false)

const publishedOnLabel = computed<string>(() =>
	doc.value?.published_on
		? dayjs(doc.value.published_on).format('DD MMM YYYY')
		: ''
)

const selfEnrollment = computed<boolean>({
	get: () => !resource.doc?.disable_self_learning,
	set: (val: boolean) => {
		if (!resource.doc) return
		resource.doc.disable_self_learning = val ? 0 : 1
		markDirty()
	},
})

function applyPaidCourse(val: boolean): boolean {
	if (!resource.doc) return false
	if (val && paymentsAppMissing.value) {
		showPaymentsAppModal.value = true
		return false
	}
	resource.doc.paid_course = val ? 1 : 0
	// A paid course is already monetized: the paid-certificate flow only
	// applies to free courses, so clear it when switching to paid.
	if (val) resource.doc.paid_certificate = 0
	return true
}

function setPaidCourse(val: boolean) {
	if (applyPaidCourse(val)) markDirty()
}

// Onboarding's Set pricing step lands here with ?pricing=paid. It is dropped
// from the URL once read, so a refresh or a later visit leaves the form alone.
const route = useRoute()
const router = useRouter()
const coursePriceInput = ref<{ focus: () => void } | null>(null)
const pricingRequested = ref<boolean>(false)

watch(
	() => route.query.pricing,
	(pricing) => {
		if (pricing !== 'paid') return
		pricingRequested.value = true
		const { pricing: _dropped, ...query } = route.query
		router.replace({ query, hash: route.hash })
	},
	{ immediate: true }
)

// A cached course shows while it reloads; the reload would undo the switch.
const docLoaded = computed<boolean>(
	() => Boolean(resource.doc) && !resource.get?.loading
)

watch(
	[pricingRequested, docLoaded],
	([requested, loaded]) => {
		if (!requested || !loaded) return
		pricingRequested.value = false
		openPaidPricing()
	},
	{ immediate: true }
)

// No autosave: the switch waits for a price and the user's own save.
async function openPaidPricing() {
	if (!resource.doc?.paid_course) {
		if (!applyPaidCourse(true)) return
		markUnsaved()
	}
	await nextTick()
	coursePriceInput.value?.focus()
}

function setPaidCertificate(val: boolean) {
	if (!resource.doc) return
	if (val && paymentsAppMissing.value) {
		showPaymentsAppModal.value = true
		return
	}
	resource.doc.paid_certificate = val ? 1 : 0
	markDirty()
}

function openPaymentsApp() {
	openExternal('https://frappecloud.com/marketplace/apps/payments')
}

const timezoneResource = createResource({
	url: 'frappe.geo.country_info.get_country_timezone_info',
	auto: true,
	transform: (data: { all_timezones: string[] }) => data.all_timezones,
}) as Resource<string[] | null>

const timezoneOptions = computed<{ label: string; value: string }[]>(() =>
	(timezoneResource.data || []).map((tz) => ({ label: tz, value: tz }))
)

function openEvaluatorModal() {
	showMemberModal.value = true
}

function openPrintFormats() {
	openExternal('/app/print-format?doc_type=LMS Certificate')
}

function onEvaluatorCreated(created: { name: string }) {
	if (!resource.doc) return
	resource.doc.evaluator = created.name
	evaluatorLinkRef.value?.reload()
	markDirty()
}
</script>
