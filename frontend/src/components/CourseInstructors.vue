<template>
	<div class="text-gray-600">
		<span v-if="instructors?.length == 1">
			<router-link
				:to="{
					name: 'Profile',
					params: { username: instructors[0].username },
				}"
				class="text-gray-600 hover:text-black text-sm"
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
				class="text-gray-600 hover:text-black text-sm"
			>
				{{ instructors[0].first_name }}
			</router-link>
			<span class="text-sm mx-1">{{ __('and') }}</span>
			<router-link
				:to="{
					name: 'Profile',
					params: { username: instructors[1].username },
				}"
				class="text-gray-600 hover:text-black text-sm"
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
				class="text-gray-600 hover:text-black text-sm"
			>
				{{ instructors[0].first_name }}
			</router-link>
			<span class="text-sm mx-1">
				{{ __('and') }} {{ instructors?.length - 1 }} {{ __('others') }}
			</span>
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
