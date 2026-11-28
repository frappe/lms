<template>
	<div class="space-y-2.5 rounded-5 border border-outline-gray-2 p-3 text-p-sm">
		<div class="flex items-center justify-between gap-2">
			<span class="flex items-center gap-2 text-p-sm-medium text-ink-gray-8">
				<span class="lucide-award size-4 shrink-0" />
				{{ __('Certificate') }}
			</span>
			<Select
				:modelValue="kind"
				:options="options"
				variant="ghost"
				size="sm"
				:aria-label="__('Certificate')"
				class="-me-2 w-24"
				@update:modelValue="(value) => setCertificate(value as CertificateKind)"
			/>
		</div>
		<PriceInput
			v-if="kind === 'paid' && resource.doc"
			:currency="resource.doc.currency"
			:amount="resource.doc.course_price"
			:missing="isMissing?.('price')"
			class="-mx-2"
			@update:currency="(value) => setField('currency', value)"
			@update:amount="(value) => setField('course_price', value)"
		/>
		<router-link
			v-if="kind !== 'none'"
			:to="{ hash: '#settings' }"
			class="-mx-2 flex items-center justify-between gap-2 rounded-3 px-2 py-0.5 text-ink-gray-6 hover:bg-surface-gray-2"
		>
			<span class="flex min-w-0 items-center gap-2">
				<span
					class="size-4 shrink-0"
					:class="evaluatorLabel ? 'lucide-user-check' : 'lucide-palette'"
				/>
				<span class="truncate">{{
					evaluatorLabel || __('Design and details')
				}}</span>
			</span>
			<span class="flex shrink-0 items-center gap-0.5 text-ink-gray-6">
				{{ __('Settings') }}
				<span class="lucide-chevron-right size-3.5 rtl:rotate-180" />
			</span>
		</router-link>
		<p v-else class="text-ink-gray-6">{{ __('No certificate.') }}</p>
		<PaymentsAppDialog v-model="needsPaymentsApp" />
	</div>
</template>

<script setup lang="ts">
import { Select } from 'frappe-ui'
import { computed } from 'vue'
import PriceInput from '@/components/InlineEdit/PriceInput.vue'
import PaymentsAppDialog from '@/components/PaymentsAppDialog.vue'
import {
	useCourseOffer,
	type CertificateKind,
} from '@/composables/useCourseOffer'

/** None, free on completion, or paid and evaluated. */
const {
	resource,
	isMissing,
	certificate: kind,
	needsPaymentsApp,
	setField,
	setCertificate,
} = useCourseOffer()

const labels: Record<CertificateKind, string> = {
	none: __('None'),
	free: __('Free'),
	paid: __('Paid'),
}

// A paid course already charges, so its certificate can only be free.
const options = computed(() => {
	const kinds: CertificateKind[] = resource.doc?.paid_course
		? ['none', 'free']
		: ['none', 'free', 'paid']
	return kinds.map((value) => ({ label: labels[value], value }))
})

const evaluatorLabel = computed<string>(() => {
	const evaluator = resource.doc?.evaluator
	if (kind.value !== 'paid') return ''
	return evaluator
		? __('Evaluated by {0}').format(evaluator)
		: __('No evaluator yet')
})
</script>
