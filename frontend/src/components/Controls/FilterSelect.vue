<template>
	<Button
		v-if="!options"
		:variant="isActive ? 'outline' : 'subtle'"
		:aria-pressed="isActive"
		@click="model = isActive ? emptyValue : true"
	>
		<template #prefix>
			<span :class="[icon, 'size-4']" aria-hidden="true" />
		</template>
		{{ label }}
		<template v-if="isActive" #suffix>
			<span class="lucide-check size-3.5 text-ink-gray-6" aria-hidden="true" />
		</template>
	</Button>
	<Dropdown v-else :options="menuOptions">
		<Button :variant="isActive ? 'outline' : 'subtle'">
			<template #prefix>
				<span :class="[icon, 'size-4']" aria-hidden="true" />
			</template>
			{{ isActive ? selected?.label : label }}
			<template v-if="isActive" #suffix>
				<span
					class="lucide-check size-3.5 text-ink-gray-6"
					aria-hidden="true"
				/>
			</template>
		</Button>
	</Dropdown>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { Button, Dropdown } from 'frappe-ui'

type FilterValue = string | number | boolean | null

/** A filter chip. With `options` it opens a menu; without, it toggles `true` on and off. */
const props = withDefaults(
	defineProps<{
		label: string
		icon: string
		options?: { label: string; value: FilterValue }[]
		emptyValue?: FilterValue
	}>(),
	{ emptyValue: '', options: undefined }
)

const model = defineModel<FilterValue>()

const isActive = computed(() => model.value !== props.emptyValue)

const selected = computed(() =>
	props.options?.find((option) => option.value === model.value)
)

const menuOptions = computed(() =>
	(props.options || []).map((option) => ({
		label: option.label,
		icon: option.value === model.value ? 'lucide-check' : undefined,
		onClick: () => (model.value = option.value),
	}))
)
</script>
