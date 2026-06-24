<template>
	<div class="text-ink-gray-7">
		<span v-if="instructors?.length == 1">
			<router-link
				v-if="instructors[0].username"
				:to="{
					name: 'Profile',
					params: { username: instructors[0].username },
				}"
				class="text-ink-gray-7 hover:text-ink-gray-9"
			>
				{{ instructors[0].full_name }}
			</router-link>
			<span v-else>{{ instructors[0].full_name }}</span>
		</span>
		<span v-if="instructors?.length == 2">
			<router-link
				v-if="instructors[0].username"
				:to="{
					name: 'Profile',
					params: { username: instructors[0].username },
				}"
				class="text-ink-gray-7 hover:text-ink-gray-9"
			>
				{{ instructors[0].first_name }}
			</router-link>
			<span v-else>{{ instructors[0].first_name }}</span>
			{{ __('and') }}
			<router-link
				v-if="instructors[1].username"
				:to="{
					name: 'Profile',
					params: { username: instructors[1].username },
				}"
				class="text-ink-gray-7 hover:text-ink-gray-9"
			>
				{{ instructors[1].first_name }}
			</router-link>
			<span v-else>{{ instructors[1].first_name }}</span>
		</span>
		<span v-if="instructors?.length > 2">
			<router-link
				v-if="instructors[0].username"
				:to="{
					name: 'Profile',
					params: { username: instructors[0].username },
				}"
				class="text-ink-gray-7 hover:text-ink-gray-9"
			>
				{{ instructors[0].first_name }}
			</router-link>
			<span v-else>{{ instructors[0].first_name }}</span>
			{{ __('and') }} {{ instructors?.length - 1 }} {{ __('others') }}
		</span>
	</div>
</template>
<script setup lang="ts">
import type { CourseInstructorInfo } from '@/types/api'

defineProps<{
	instructors: CourseInstructorInfo[]
}>()
</script>
