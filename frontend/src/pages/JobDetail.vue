<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs
			class="h-7"
			:items="[{ label: __('Jobs'), route: { name: 'Jobs' } }]"
		/>
		<div class="flex">
			<Button v-if="user.data?.name" variant="solid">
				<template #prefix>
					<Plus class="h-4 w-4" />
				</template>
				{{ __('New Job') }}
			</Button>
		</div>
	</header>
	<div></div>
</template>
<script setup>
const props = defineProps({
	job: {
		type: String,
		required: true,
	},
})
</script>
