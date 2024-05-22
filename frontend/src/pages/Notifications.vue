<template>
	<header
		class="sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
	</header>
	<div class="w-3/4 mx-auto">
		<div
			v-for="log in notifications.data"
			class="flex items-center border-b py-2 justify-between"
		>
			<div class="flex items-center">
				<UserAvatar :user="allUsers.data[log.from_user]" class="mr-2" />
				<div class="notification" v-html="log.subject"></div>
			</div>
			<Link
				v-if="log.link"
				:to="log.link"
				class="text-gray-600 font-medium text-sm hover:text-gray-700"
			>
				{{ __('View') }}
			</Link>
		</div>
	</div>
</template>
<script setup>
import { createResource, Breadcrumbs, Link } from 'frappe-ui'
import { computed, inject } from 'vue'
import UserAvatar from '@/components/UserAvatar.vue'

const user = inject('$user')
const allUsers = inject('$allUsers')

const notifications = createResource({
	url: 'frappe.client.get_list',
	makeParams: (values) => {
		return {
			doctype: 'Notification Log',
			fields: ['subject', 'from_user', 'link'],
			filters: {
				for_user: user.data?.name,
			},
			order_by: 'creation desc',
		}
	},
	auto: true,
	cache: user.data?.name,
})

const breadcrumbs = computed(() => {
	let crumbs = [
		{
			label: 'Notifications',
			route: {
				name: 'Notifications',
			},
		},
	]
	return crumbs
})
</script>
<style>
.notification strong {
	font-weight: 400;
}
.notification b {
	font-weight: 400;
}
</style>
