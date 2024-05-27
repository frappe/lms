<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<div>
			<FormControl
				type="text"
				placeholder="Search Participants"
				v-model="searchQuery"
				@input="participants.reload()"
			>
				<template #prefix>
					<Search class="w-4" name="search" />
				</template>
			</FormControl>
		</div>
	</header>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 m-5">
		<div v-if="participants.data" v-for="participant in participants.data">
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
import { Breadcrumbs, FormControl, createResource, debounce } from 'frappe-ui'
import { ref, computed } from 'vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { Search } from 'lucide-vue-next'

const searchQuery = ref('')

const participants = createResource({
	url: 'lms.lms.api.get_certified_participants',
	method: 'GET',
	debounce: 300,
	cache: ['certified_participants', searchQuery.value],
	makeParams() {
		return {
			search_query: searchQuery.value,
		}
	},
	auto: true,
})

const breadcrumbs = computed(() => {
	return [{ label: 'Certified Participants', to: '/certified-participants' }]
})
</script>
