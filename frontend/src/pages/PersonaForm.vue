<template>
	<div class="flex h-screen overflow-hidden sm:bg-gray-50">
		<div class="relative h-full mx-auto sm:w-max pt-40">
			<div class="flex items-center justify-center gap-x-2">
				<LMSLogo class="size-7" />
				<span
					class="select-none text-xl font-semibold tracking-tight text-gray-900"
				>
					Learning
				</span>
			</div>
			<div
				class="flex flex-col gap-5 bg-white py-8 sm:mt-6 sm:w-96 sm:rounded-lg sm:px-8 sm:shadow-xl"
			>
				<h1 class="font-medium text-center">
					{{ __('Help us understand your needs') }}
				</h1>

				<div class="flex flex-col gap-2">
					<div class="text-sm text-gray-700">
						{{ __('What is your use case for Frappe Learning?') }}
					</div>
					<Select v-model="persona.useCase" :options="useCaseOptions" />
				</div>

				<div class="flex flex-col gap-2">
					<div class="text-sm text-gray-700">
						{{ __('What best describes your role?') }}
					</div>
					<Select v-model="persona.role" :options="roleOptions" />
				</div>

				<Button
					variant="solid"
					class="self-center"
					:disabled="!persona.role || !persona.useCase"
					@click="submitPersona()"
				>
					{{ __('Submit and Continue') }}
				</Button>
			</div>
			<button
				class="text-center absolute bottom-0 end-0 start-0 text-sm py-4"
				@click="skipPersonaForm()"
			>
				{{ __('Skip') }}
			</button>
		</div>
	</div>
</template>
<script setup>
import LMSLogo from '@/components/Icons/LMSLogo.vue'
import { Button, call, usePageMeta } from 'frappe-ui'
import Select from '@/components/Controls/Select.vue'
import { computed, inject, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { sessionStore } from '@/stores/session'

const user = inject('$user')
const router = useRouter()
const { brand } = sessionStore()

const persona = reactive({
	role: null,
	useCase: null,
})

const submitPersona = () => {
	let responses = {
		site: user.data?.sitename,
		role: persona.role,
		use_case: persona.useCase,
	}
	call('lms.lms.api.capture_user_persona', {
		responses: JSON.stringify(responses),
	}).then(() => {
		router.push({
			name: 'Home',
		})
	})
}

const skipPersonaForm = () => {
	call('frappe.client.set_value', {
		doctype: 'LMS Settings',
		name: 'LMS Settings',
		fieldname: 'persona_captured',
		value: 1,
	}).then(() => {
		router.push({
			name: 'Home',
		})
	})
}

const roleOptions = computed(() => [
	{ label: __('Trainer / Instructor'), value: 'Trainer / Instructor' },
	{ label: __('Freelancer / Consultant'), value: 'Freelancer / Consultant' },
	{ label: __('HR / L&D Professional'), value: 'HR / L&D Professional' },
	{
		label: __('School / University Admin'),
		value: 'School / University Admin',
	},
	{ label: __('Software Developer'), value: 'Software Developer' },
	{ label: __('Community Manager'), value: 'Community Manager' },
	{
		label: __('Business Owner / Team Lead'),
		value: 'Business Owner / Team Lead',
	},
	{ label: __('Other'), value: 'Other' },
])

const useCaseOptions = computed(() => [
	{
		label: __('Teaching students in a school/university'),
		value: 'Teaching students in a school/university',
	},
	{
		label: __('Training employees in my company'),
		value: 'Training employees in my company',
	},
	{
		label: __('Onboarding and educating my users/community'),
		value: 'Onboarding and educating my users/community',
	},
	{
		label: __('Selling courses and earning income'),
		value: 'Selling courses and earning income',
	},
	{ label: __('Other'), value: 'Other' },
])

usePageMeta(() => {
	return {
		title: 'Persona',
		icon: brand.favicon,
	}
})
</script>
