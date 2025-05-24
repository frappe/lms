<template>
	<div class="flex h-screen overflow-hidden sm:bg-gray-50">
		<div class="relative h-full z-10 mx-auto sm:w-max pt-40">
			<div class="mx-auto flex items-center justify-center space-x-2">
				<LMSLogo class="size-7" />
				<span
					class="select-none text-xl font-semibold tracking-tight text-gray-900"
				>
					Learning
				</span>
			</div>
			<div
				class="mx-auto w-full h-fit bg-white py-8 sm:mt-6 sm:w-96 sm:rounded-lg sm:px-8 sm:shadow-xl"
			>
				<div class="font-medium text-center mb-8">
					{{ __('Help us understand your needs') }}
				</div>

				<div class="mb-5">
					<div class="text-sm text-gray-700 mb-2">
						{{ __('What is your use case for Frappe Learning?') }}
					</div>
					<FormControl
						v-model="persona.useCase"
						type="select"
						:options="useCaseOptions"
					/>
				</div>

				<div class="mb-5">
					<div class="text-sm text-gray-700 mb-2">
						{{ __('What best describes your role?') }}
					</div>
					<FormControl
						v-model="persona.role"
						type="select"
						:options="roleOptions"
					/>
				</div>

				<div class="flex w-full">
					<Button variant="solid" class="mx-auto" @click="submitPersona()">
						{{ __('Submit and Continue') }}
					</Button>
				</div>
			</div>
			<div
				class="text-center absolute bottom-0 right-0 left-0 mx-auto cursor-pointer text-sm pb-4"
				@click="skipPersonaForm()"
			>
				{{ __('Skip') }}
			</div>
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
		no_of_students: persona.noOfStudents,
		use_case: persona.useCase,
	}
	call('lms.lms.api.capture_user_persona', {
		responses: JSON.stringify(responses),
	}).then(() => {
		router.push({
			name: 'Courses',
		})
	})
}

const skipPersonaForm = () => {
	call('frappe.client.set_value', {
		doctype: 'LMS Settings',
		name: null,
		fieldname: 'persona_captured',
		value: 1,
	}).then(() => {
		router.push({
			name: 'Courses',
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
