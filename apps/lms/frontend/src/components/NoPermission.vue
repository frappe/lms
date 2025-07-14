<template>
	<div class="border rounded-md w-1/3 mx-auto my-32">
		<div class="border-b px-5 py-3 font-medium">
			<span
				class="inline-flex items-center before:bg-surface-red-5 before:w-2 before:h-2 before:rounded-md before:mr-2"
			></span>
			{{ __('Not Permitted') }}
		</div>
		<div v-if="user.data" class="px-5 py-3">
			<div>
				{{ __('You do not have permission to access this page.') }}
			</div>
			<router-link
				:to="{
					name: 'Courses',
				}"
			>
				<Button variant="solid" class="mt-2">
					{{ __('Checkout Courses') }}
				</Button>
			</router-link>
		</div>
		<div class="px-5 py-3">
			<div>
				{{ __('Please login to access this page.') }}
			</div>
			<Button @click="redirectToLogin()" class="mt-4">
				{{ __('Login') }}
			</Button>
		</div>
	</div>
</template>
<script setup>
import { inject } from 'vue'
import { Button } from 'frappe-ui'

const user = inject('$user')

const redirectToLogin = () => {
	window.location.href = '/login'
}
</script>
