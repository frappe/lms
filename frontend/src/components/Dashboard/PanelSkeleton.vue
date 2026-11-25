<template>
	<div class="flex h-full flex-col" aria-hidden="true">
		<div v-if="kind === 'rows'" class="flex flex-col gap-4 pt-1">
			<div
				v-for="index in rows"
				:key="index"
				class="flex items-center justify-between gap-4"
			>
				<Skeleton
					class="h-2 rounded-full"
					:class="LABEL_WIDTHS[(index - 1) % LABEL_WIDTHS.length]"
				/>
				<Skeleton class="h-2 w-10 rounded-full" />
			</div>
		</div>
		<div v-else class="mt-auto flex h-20 items-end gap-1.5">
			<Skeleton
				v-for="(height, index) in BAR_HEIGHTS"
				:key="index"
				class="flex-1 rounded-t-1"
				:style="{ height }"
			/>
		</div>
	</div>
</template>
<script setup lang="ts">
import { Skeleton } from 'frappe-ui'

withDefaults(defineProps<{ kind?: 'rows' | 'bars'; rows?: number }>(), {
	kind: 'bars',
	rows: 3,
})

const LABEL_WIDTHS = ['w-24', 'w-20', 'w-28']
const BAR_HEIGHTS = ['40%', '65%', '50%', '80%', '60%', '90%', '70%', '55%']
</script>
