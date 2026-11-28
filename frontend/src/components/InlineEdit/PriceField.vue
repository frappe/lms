<template>
	<div class="space-y-2">
		<Dropdown :options="menu">
			<Button
				variant="ghost"
				:aria-label="label"
				class="-ms-1.5 !h-auto !px-1.5"
			>
				<span class="text-xl-semibold text-ink-gray-9">{{ headline }}</span>
				<template #suffix>
					<span
						class="lucide-chevron-down size-4 text-ink-gray-5"
						aria-hidden="true"
					/>
				</template>
			</Button>
		</Dropdown>
		<PriceInput
			v-if="paid"
			:currency="currency"
			:amount="amount"
			:missing="missing"
			class="-mx-2"
			@update:currency="(value) => emit('update:currency', value)"
			@update:amount="(value) => emit('update:amount', value)"
		/>
	</div>
</template>

<script setup lang="ts">
import { Button, Dropdown } from 'frappe-ui'
import { computed } from 'vue'
import PriceInput from '@/components/InlineEdit/PriceInput.vue'

/**
 * Free or paid, and the price when paid. `paid` is controlled, so a parent
 * can refuse the switch to paid by not applying it.
 */
const props = defineProps<{
	paid: boolean
	currency?: string | null
	amount?: number | null
	label: string
	missing?: boolean
}>()

const emit = defineEmits<{
	'update:paid': [value: boolean]
	'update:currency': [value: string]
	'update:amount': [value: number]
}>()

const menu = computed(() =>
	[
		{ label: __('Free'), paid: false },
		{ label: __('Paid'), paid: true },
	].map((option) => ({
		label: option.label,
		icon: option.paid === props.paid ? 'lucide-check' : undefined,
		onClick: () => emit('update:paid', option.paid),
	}))
)

// Names the choice; the price itself is in the field below it.
const headline = computed<string>(() => (props.paid ? __('Paid') : __('Free')))
</script>
