<template>
	<Button v-if="hasPrev" @click="emit('switch', 'prev')">
		<template #prefix>
			<span class="lucide-chevron-left size-4 rtl:rotate-180" />
		</template>
		<span>{{ __('Previous') }}</span>
	</Button>
	<Button v-else-if="hasNext" :route="courseRoute" data-testid="back-to-course">
		<template #prefix>
			<span class="lucide-chevron-left size-4 rtl:rotate-180" />
		</template>
		<span>{{ __('Back to course') }}</span>
	</Button>
	<Tooltip
		v-if="hasNext && nextLocked"
		:text="__('Complete this lesson to move to the next')"
	>
		<span
			class="ms-auto inline-flex"
			tabindex="0"
			:aria-describedby="lockedReasonId"
			data-testid="next-locked"
		>
			<Button disabled>
				<template #prefix>
					<span class="lucide-lock size-4" aria-hidden="true" />
				</template>
				<span>{{ __('Next') }}</span>
			</Button>
			<span :id="lockedReasonId" class="sr-only">
				{{ __('Complete this lesson to move to the next') }}
			</span>
		</span>
	</Tooltip>
	<Button v-else-if="hasNext" class="ms-auto" @click="emit('switch', 'next')">
		<template #suffix>
			<span class="lucide-chevron-right size-4 rtl:rotate-180" />
		</template>
		<span>{{ __('Next') }}</span>
	</Button>
	<Button
		v-else
		:route="courseRoute"
		class="ms-auto"
		data-testid="back-to-course"
	>
		{{ __('Back to course') }}
	</Button>
</template>
<script setup lang="ts">
import { computed, useId } from 'vue'
import { Button, Tooltip } from 'frappe-ui'
import type { LocationQueryRaw } from 'vue-router'

const props = defineProps<{
	hasPrev: boolean
	hasNext: boolean
	nextLocked?: boolean
	courseName: string
	courseQuery?: LocationQueryRaw
}>()

const emit = defineEmits<{
	switch: [direction: 'prev' | 'next']
}>()

const lockedReasonId = useId()

const courseRoute = computed(() => ({
	name: 'CourseDetail',
	params: { courseName: props.courseName },
	query: props.courseQuery,
}))
</script>
