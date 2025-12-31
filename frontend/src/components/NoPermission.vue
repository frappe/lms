<template>
	<div class="bg-surface-white w-full h-full">
		<div class="w-fit mx-auto mt-56 text-center p-4">
			<div class="text-3xl font-semibold text-ink-gray-5 pb-4 mb-2 border-b">
				{{ __('Not Permitted') }}
			</div>
			<div v-if="user.data" class="px-5 py-3">
				<div class="text-ink-gray-5">
					{{ __('You do not have permission to access this page.') }}
				</div>
				<router-link
					:to="{
						name: 'Courses',
					}"
				>
					<Button variant="solid" class="mt-2 w-full">
						{{ __('Checkout Courses') }}
					</Button>
				</router-link>
			</div>
			<div class="px-5 py-3">
				<div class="text-ink-gray-5">
					{{ __('You are not permitted to access this page.') }}
				</div>
				<Button @click="redirectToLogin()" class="mt-4 w-full" variant="solid">
					{{ __('Login') }}
				</Button>
			</div>
		</div>
	</div>
</template>
<script setup>
import { inject } from 'vue'
import { Button, usePageMeta } from 'frappe-ui'
import { sessionStore } from '../stores/session'

const user = inject('$user')
const { brand } = sessionStore()

const redirectToLogin = () => {
	window.location.href = '/login'
}

usePageMeta(() => {
	return {
		title: __('Not Permitted'),
		icon: brand.favicon,
	}
})
</script>
