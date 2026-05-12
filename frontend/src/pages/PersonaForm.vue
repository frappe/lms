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
import { Button, call, Select, usePageMeta } from 'frappe-ui'
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

const roleOptions = computed(() => {
	const options = [
		'Trainer / Instructor',
		'Freelancer / Consultant',
		'HR / L&D Professional',
		'School / University Admin',
		'Software Developer',
		'Community Manager',
		'Business Owner / Team Lead',
		'Other',
	]

	return options.map((option) => ({
		label: option,
		value: option,
	}))
})

const noOfStudentsOptions = computed(() => {
	const options = [
		'Less than 50',
		'50-200',
		'200-1000',
		'1000+',
		'Not sure yet',
	]

	return options.map((option) => ({
		label: option,
		value: option,
	}))
})

const useCaseOptions = computed(() => {
	const options = [
		'Teaching students in a school/university',
		'Training employees in my company',
		'Onboarding and educating my users/community',
		'Selling courses and earning income',
		'Other',
	]

	return options.map((option) => ({
		label: option,
		value: option,
	}))
})

usePageMeta(() => {
	return {
		title: 'Persona',
		icon: brand.favicon,
	}
})
</script>
