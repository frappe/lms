<template>
<div class="text-3xl mx-auto text-center w-full">
	<div class="h-[80vh]">
		<AppCalendar />
	</div>
</div>
</template>
<script setup>

import { computed } from 'vue'
import { updateDocumentTitle } from '@/utils'
import AppCalendar from '../components/AppCalendar.vue'



const pageMeta = computed(() => {
	return {
		title: 'Calendar',
		description: 'Calendar',
	}
})


updateDocumentTitle(pageMeta)
</script>
