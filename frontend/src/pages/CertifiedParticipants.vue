<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
	</header>
	<div class="grid grid-cols-3 gap-4 m-5">
		<div v-for="participant in participants.data">
			<router-link
				:to="{
					name: 'Profile',
					params: { username: participant.username },
				}"
			>
				<div class="flex shadow rounded-md h-full p-2">
					<UserAvatar :user="participant" size="3xl" class="mr-2" />
					<div>
						<router-link
							:to="{
								name: 'Profile',
								params: { username: participant.username },
							}"
						>
							<div class="text-lg font-semibold mb-2">
								{{ participant.full_name }}
							</div>
						</router-link>
						<div class="font-medium text-gray-700 text-xs mb-1">
							{{ __('is certified for') }}
						</div>
						<div class="leading-5" v-for="course in participant.courses">
							{{ course }}
						</div>
					</div>
				</div>
			</router-link>
		</div>
	</div>
</template>
<script setup>
import { Breadcrumbs, createResource } from 'frappe-ui'
import { computed } from 'vue'
import UserAvatar from '@/components/UserAvatar.vue'

const participants = createResource({
	url: 'lms.lms.api.get_certified_participants',
	auto: true,
	cache: ['certified-participants'],
})

const breadcrumbs = computed(() => {
	return [{ label: 'Certified Participants', to: '/certified-participants' }]
})
</script>
