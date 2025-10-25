<template>
	<div class="text-ink-gray-7">
		<span v-if="instructors?.length == 1">
			<router-link
				:to="{
					name: 'Profile',
					params: { username: instructors[0].username },
				}"
				class="text-ink-gray-7 hover:text-ink-gray-9"
			>
				{{ instructors[0].full_name }}
			</router-link>
		</span>
		<span v-if="instructors?.length == 2">
			<router-link
				:to="{
					name: 'Profile',
					params: { username: instructors[0].username },
				}"
				class="text-ink-gray-7 hover:text-ink-gray-9"
			>
				{{ instructors[0].first_name }}
			</router-link>
			{{ __('and') }}
			<router-link
				:to="{
					name: 'Profile',
					params: { username: instructors[1].username },
				}"
				class="text-ink-gray-7 hover:text-ink-gray-9"
			>
				{{ instructors[1].first_name }}
			</router-link>
		</span>
		<span v-if="instructors?.length > 2">
			<router-link
				:to="{
					name: 'Profile',
					params: { username: instructors[0].username },
				}"
				class="text-ink-gray-7 hover:text-ink-gray-9"
			>
				{{ instructors[0].first_name }}
			</router-link>
			{{ __('and') }} {{ instructors?.length - 1 }} {{ __('others') }}
		</span>
	</div>
</template>
<script setup>
const props = defineProps({
	instructors: {
		type: Array,
		required: true,
	},
})
</script>
