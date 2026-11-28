<template>
	<div class="flex items-center gap-2 rounded-4" :class="missingRing(missing)">
		<FormControl
			:modelValue="amount || ''"
			type="number"
			min="0"
			variant="ghost"
			:placeholder="__('Amount')"
			:aria-label="__('Amount')"
			class="min-w-0 flex-1"
			@update:modelValue="
				(value: string) => emit('update:amount', Number(value) || 0)
			"
		>
			<template v-if="symbol" #prefix>
				<span
					class="inline-flex min-w-4 justify-center text-p-base text-ink-gray-6"
					aria-hidden="true"
				>
					{{ symbol }}
				</span>
			</template>
		</FormControl>
		<Link
			:modelValue="currency ?? ''"
			doctype="Currency"
			query="lms.lms.api.search_currencies"
			:filters="{ enabled: 1 }"
			:placeholder="__('Currency')"
			:aria-label="__('Currency')"
			variant="ghost"
			trigger="button"
			class="shrink-0"
			@update:modelValue="(value: string) => emit('update:currency', value)"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FormControl } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import { missingRing } from '@/components/InlineEdit/fieldClasses'

/** The amount with its currency symbol, then the currency. Currencies come through the LMS search query. */
const props = defineProps<{
	currency?: string | null
	amount?: number | null
	missing?: boolean
}>()

const emit = defineEmits<{
	'update:currency': [value: string]
	'update:amount': [value: number]
}>()

const symbol = computed<string>(() => {
	if (!props.currency) return ''
	try {
		return (
			new Intl.NumberFormat(undefined, {
				style: 'currency',
				currencyDisplay: 'narrowSymbol',
				currency: props.currency,
			})
				.formatToParts(0)
				.find((part) => part.type === 'currency')?.value || ''
		)
	} catch {
		return ''
	}
})
</script>
