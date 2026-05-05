<template>
	<div class="flex min-h-screen flex-col bg-white sm:bg-gray-50">
		<!-- Center Container -->
		<div class="flex flex-1 flex-col items-center justify-start px-4 py-10 sm:justify-center sm:px-6 lg:px-8">
			<div class="w-full max-w-md min-w-0">
				<!-- Logo -->
				<div class="mb-6 flex items-center justify-center gap-x-2">
					<LMSLogo class="size-7" />
					<span class="text-xl font-semibold tracking-tight text-gray-900">
						{{ __('Learning') }}
					</span>
				</div>

				<!-- Card -->
				<div class="w-full overflow-hidden bg-white px-6 py-8 sm:rounded-lg sm:px-8 sm:shadow-xl">
					<p class="mb-8 text-center font-medium">
						{{ __('Help us understand your needs') }}
					</p>

					<!-- Use Case -->
					<div class="mb-5 min-w-0">
						<label class="mb-2 block text-sm text-gray-700">
							{{ __('What is your use case for Frappe Learning?') }}
						</label>
						<FormControl v-model="persona.useCase" type="select" :options="useCaseOptions"
							class="w-full min-w-0 [&_[data-slot=trigger]]:w-full" />
					</div>

					<!-- Role -->
					<div class="mb-6 min-w-0">
						<label class="mb-2 block text-sm text-gray-700">
							{{ __('What best describes your role?') }}
						</label>
						<FormControl v-model="persona.role" type="select" :options="roleOptions"
							class="w-full min-w-0 [&_[data-slot=trigger]]:w-full" />
					</div>

					<Button variant="solid" class="w-full" @click="submitPersona">
						{{ __('Submit and Continue') }}
					</Button>
				</div>
			</div>
		</div>

		<!-- Skip -->
		<div class="pb-6 text-center text-sm text-gray-600 hover:text-gray-900 cursor-pointer" @click="skipPersonaForm">
			{{ __('Skip') }}
		</div>
	</div>
</template>
<script setup>
import LMSLogo from '@/components/Icons/LMSLogo.vue'
import { Button, call, FormControl, usePageMeta } from 'frappe-ui'
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
