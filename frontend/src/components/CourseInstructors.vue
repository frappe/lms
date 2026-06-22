<template>
	<div class="text-ink-gray-7">
		<span>Ecological Society</span>
	</div>
</template>
<script setup lang="ts">
import type { CourseInstructorInfo } from '@/types/api'

defineProps<{
	instructors?: CourseInstructorInfo[]
}>()
</script>
