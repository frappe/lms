<template>
	<div
		:class="[
			'[&_input]:!rounded [&_input]:py-3 [&_input]:px-4 [&_input]:!border-[1.5px] [&_input]:!border-gray-100 [&_input]:!bg-white [&_input]:!h-10 [&_input]:md:!text-sm [&_label]:md:!text-sm [&_label]:!tracking-wider ',
			customClass,
		]"
	>
		<slot />
	</div>
</template>
<script setup lang="ts">
defineProps<{
	customClass?: string
}>()
</script>
