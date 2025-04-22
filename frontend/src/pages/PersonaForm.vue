<template>
	<div class="flex h-screen overflow-hidden sm:bg-gray-50">
		<div class="relative h-full z-10 mx-auto pt-8 sm:w-max sm:pt-32">
			<div class="mx-auto flex items-center justify-center space-x-2">
				<LMSLogo class="size-7" />
				<span
					class="select-none text-xl font-semibold tracking-tight text-gray-900"
				>
					Learning
				</span>
			</div>
			<div
				class="mx-auto space-y-5 w-full h-fit bg-white px-4 py-8 sm:mt-6 sm:w-96 sm:rounded-lg sm:px-8 sm:shadow-xl"
			>
				<div>
					<div class="text-sm text-gray-700 mb-2">
						{{ __('1. What best describes your role?') }}
					</div>
					<FormControl
						v-model="persona.role"
						type="select"
						:options="roleOptions"
					/>
				</div>

				<div>
					<div>
						<div class="text-sm text-gray-700 mb-2">
							{{ __('2. How many students are you planning to teach?') }}
						</div>
						<FormControl
							v-model="persona.noOfStudents"
							type="select"
							:options="noOfStudentsOptions"
						/>
					</div>
				</div>

				<div>
					<div>
						<div class="text-sm text-gray-700 mb-2">
							{{ __('3. What is your main use case for Frappe Learning?') }}
						</div>
						<FormControl
							v-model="persona.useCase"
							type="select"
							:options="useCaseOptions"
						/>
					</div>
				</div>

				<div>
					<div>
						<div class="text-sm text-gray-700 mb-2">
							{{ __('4. Are you currently using any Frappe products?') }}
						</div>
						<FormControl
							v-model="persona.frappeProducts"
							type="select"
							:options="frappeProductsOptions"
						/>
					</div>
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
console.log(user.data?.sitename)

const persona = reactive({
	role: null,
	noOfStudents: null,
	useCase: null,
	frappeProducts: null,
})

const submitPersona = () => {
	let responses = {
		site: user.data?.sitename,
		role: persona.role,
		no_of_students: persona.noOfStudents,
		use_case: persona.useCase,
		frappe_products: persona.frappeProducts,
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

const frappeProductsOptions = computed(() => {
	const options = [
		'Frappe Framework',
		'ERPNext / Frappe HR',
		'Frappe CRM / Helpdesk',
		'Custom Frappe App',
		'Other',
		'Not using any Frappe product',
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
