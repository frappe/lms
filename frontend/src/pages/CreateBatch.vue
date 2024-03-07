<template>
	<div class="h-screen text-base">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs class="h-7" :items="breadcrumbs" />
		</header>
		<div>Batch creation</div>
	</div>
</template>
<script setup>
import { computed } from 'vue'
import { Breadcrumbs } from 'frappe-ui'

const props = defineProps({
	batchName: {
		type: String,
		required: true,
	},
})

const breadcrumbs = computed(() => {
	let crumbs = [
		{
			label: 'Batches',
			route: {
				name: 'Batches',
			},
		},
	]
	crumbs.push({
		label: props.batchName == 'new' ? 'New Batch' : 'Edit Batch',
		route: { name: 'CreateBatch', params: { batchName: props.batchName } },
	})
	return crumbs
})
</script>
