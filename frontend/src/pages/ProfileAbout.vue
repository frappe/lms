<template>
	<div class="mt-7">
		<h2 class="mb-3 text-lg font-semibold text-gray-900">
			{{ __('About') }}
		</h2>
		<div
			v-if="profile.data.bio"
			v-html="profile.data.bio"
			class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-gray-300 prose-th:border-gray-300 prose-td:relative prose-th:relative prose-th:bg-gray-100 prose-sm max-w-none !whitespace-normal"
		></div>
		<div v-else class="text-gray-700 text-sm italic">
			{{ __('No introduction') }}
		</div>
	</div>
</template>
<script setup>
const props = defineProps({
	profile: {
		type: Object,
		required: true,
	},
})
</script>
