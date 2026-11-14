<template>
	<Badge :label="label" :theme="tone.theme" :size="size">
		<template #prefix>
			<span :class="tone.icon" class="size-3.5" aria-hidden="true" />
		</template>
	</Badge>
</template>

<script setup lang="ts">
import { Badge } from 'frappe-ui'
import { computed } from 'vue'

// What a thing on the home page is, as a pill with its icon: a skill, a course or
// a batch. The home lists send the kind as the server names it (Skill, Course, Batch).
const props = withDefaults(
	defineProps<{
		kind: 'skill' | 'course' | 'batch' | 'Skill' | 'Course' | 'Batch'
		size?: 'sm' | 'md' | 'lg'
	}>(),
	{ size: 'md' },
)
type Kind = 'skill' | 'course' | 'batch'
const kind = computed(() => props.kind.toLowerCase() as Kind)

const tones = {
	skill: { theme: 'blue', icon: 'lucide-sparkles' },
	course: { theme: 'green', icon: 'lucide-book-open' },
	batch: { theme: 'amber', icon: 'lucide-users' },
} as const
const labels = { skill: __('Skill'), course: __('Course'), batch: __('Batch') }

const tone = computed(() => tones[kind.value])
const label = computed(() => labels[kind.value])
</script>
