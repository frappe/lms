<template>
	<component :is="is" v-if="user.data" v-bind="props" :embedded="true" />
	<div
		v-else
		class="rounded-7 border border-outline-gray-2 py-20 text-center text-p-base text-ink-gray-7"
	>
		<div>
			{{ __('Please login to continue.') }}
		</div>
		<Button class="mt-2" @click="redirectToLogin()">
			{{ __('Login') }}
		</Button>
	</div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import type { Component } from 'vue'
import { Button } from 'frappe-ui'
import { provideStudentView } from '@/composables/useStudentView'
import type { UserResource } from '@/composables/useStudentView'

// Not named `props`: the template's `props` is the prop of that name.
const blockProps = withDefaults(
	defineProps<{
		is: Component
		props: Record<string, unknown>
		studentView?: boolean
	}>(),
	{ studentView: false }
)

const { mockedUser: user } = provideStudentView(
	inject<UserResource>('$user')!,
	() => blockProps.studentView
)

const redirectToLogin = (): void => {
	window.location.href = '/login'
}
</script>
