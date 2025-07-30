<template>
	<div class="">
		<span v-if="instructors?.length == 1">
			<router-link
				:to="{
					name: 'Profile',
					params: { username: instructors[0].username },
				}"
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
			>
				{{ instructors[0].first_name }}
			</router-link>
			{{ __('and') }}
			<router-link
				:to="{
					name: 'Profile',
					params: { username: instructors[1].username },
				}"
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
