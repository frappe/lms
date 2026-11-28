<template>
	<div class="flex min-w-0 flex-col gap-4">
		<div
			v-if="kind || position"
			class="flex items-center gap-1.5 text-p-sm-semibold text-ink-gray-6"
			data-testid="lesson-eyebrow"
		>
			<span v-if="kind">{{ kind }}</span>
			<span v-if="kind && position" aria-hidden="true">·</span>
			<span v-if="position" class="tabular-nums">{{ position }}</span>
		</div>
		<!-- The mobile header already shows the title, so the h1 is only for screen readers. -->
		<h1
			:class="
				isMobile ? 'sr-only' : 'truncate text-xl-semibold text-ink-gray-9'
			"
		>
			{{ title }}
		</h1>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useScreenSize } from '@/utils/composables'
import { lessonKindLabel } from '@/utils/lessonKind'

const props = defineProps<{
	title: string
	icon?: string | null
	index: number
	total: number
}>()

const { isMobile } = useScreenSize()
const kind = computed(() => lessonKindLabel(props.icon))
// The mobile pager already shows the position.
const position = computed(() =>
	!isMobile.value && props.index > 0 && props.total
		? __('Lesson {0} of {1}').format(props.index, props.total)
		: ''
)
</script>
