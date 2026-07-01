<template>
	<div
		class="relative flex min-h-screen flex-col overflow-y-auto transition-opacity duration-300 ease-out"
		:class="leaving ? 'opacity-0' : 'opacity-100'"
	>
		<div class="flex flex-1 flex-col justify-center px-4 py-10">
			<div class="mb-10 flex flex-col items-center text-center">
				<div class="flex items-center gap-x-2">
					<LMSLogo class="size-7" />
					<span
						class="select-none text-3xl-semibold tracking-tight text-ink-gray-9"
					>
						{{ __('Learning') }}
					</span>
				</div>
				<p class="mt-3 text-p-base text-ink-gray-6">
					{{
						__(
							'Answer a few quick questions so we can set Frappe Learning up for you'
						)
					}}
				</p>
			</div>

			<Questionnaire
				:questions="questions"
				accent="black"
				:labels="labels"
				:show-skip="false"
				@submit="submitPersona"
			/>
		</div>

		<button
			type="button"
			class="absolute inset-x-0 bottom-0 py-4 text-center text-sm text-ink-gray-5 transition-colors hover:text-ink-gray-7"
			@click="skipPersonaForm"
		>
			{{ __('Skip for now') }}
		</button>
	</div>
</template>

<script setup>
import LMSLogo from '@/components/Icons/LMSLogo.vue'
import Questionnaire from '@/components/Questionnaire.vue'
import { call, usePageMeta } from 'frappe-ui'
import { useTelemetry } from 'frappe-ui/frappe'
import { computed, inject, ref } from 'vue'
import { useRouter } from 'vue-router'
import { sessionStore } from '@/stores/session'

const user = inject('$user')
const router = useRouter()
const { brand } = sessionStore()
const { capture } = useTelemetry()
const leaving = ref(false)
const FADE_MS = 300

const leaveHome = async (persist) => {
	leaving.value = true
	const fade = new Promise((resolve) => setTimeout(resolve, FADE_MS))
	try {
		await Promise.all([persist, fade])
	} catch (e) {
		await fade
	}
	router.push({ name: 'Home' })
}

const submitPersona = (answers) => {
	capture('onboarding_persona', answers)
	const responses = JSON.stringify({ site: user.data?.sitename, ...answers })
	// External analytics call; fire without blocking the transition.
	call('lms.lms.api.capture_user_persona', { responses })
	// Persist the flag ourselves so a reload can't reopen the form.
	leaveHome(
		call('frappe.client.set_value', {
			doctype: 'LMS Settings',
			name: 'LMS Settings',
			fieldname: 'persona_captured',
			value: 1,
		})
	)
}

const skipPersonaForm = () => {
	leaveHome(
		call('frappe.client.set_value', {
			doctype: 'LMS Settings',
			name: 'LMS Settings',
			fieldname: 'persona_captured',
			value: 1,
		})
	)
}

const labels = computed(() => ({
	progress: (n, total) => __('Question {0} of {1}').format(n, total),
	complete: (pct) => __('{0}% complete').format(pct),
	back: __('Back'),
	skip: __('Skip for now'),
}))

const questions = computed(() => [
	{
		key: 'usage_context',
		title: __('Where will you be using Frappe Learning?'),
		options: [
			{ label: __('School'), value: 'School' },
			{
				label: __('College or University'),
				value: 'College or University',
			},
			{
				label: __('Coaching or Training Institute'),
				value: 'Coaching or Training Institute',
			},
			{
				label: __('Company or Workplace'),
				value: 'Company or Workplace',
			},
			{ label: __('Customer Academy'), value: 'Customer Academy' },
			{ label: __('Personal Business'), value: 'Personal Business' },
			{
				label: __('Non-profit or Government'),
				value: 'Non-profit or Government',
			},
			{ label: __('Other'), value: 'Other' },
		],
	},
	{
		key: 'first_milestone',
		title: __("What's the first milestone you'd like to achieve?"),
		options: [
			{
				label: __('Publish my first course'),
				value: 'Publish my first course',
			},
			{
				label: __('Onboard my existing learners'),
				value: 'Onboard my existing learners',
			},
			{
				label: __('Award my first certificate'),
				value: 'Award my first certificate',
			},
			{ label: __('Launch a paid course'), value: 'Launch a paid course' },
			{ label: __('Just exploring'), value: 'Just exploring' },
		],
	},
	{
		key: 'current_tool',
		title: __('What are you using today to manage learning?'),
		options: [
			{ label: __('Moodle'), value: 'Moodle' },
			{ label: __('Google Classroom'), value: 'Google Classroom' },
			{ label: __('Canvas'), value: 'Canvas' },
			{ label: __('Thinkific'), value: 'Thinkific' },
			{ label: __('Teachable'), value: 'Teachable' },
			{ label: __('Kajabi'), value: 'Kajabi' },
			{ label: __('TalentLMS'), value: 'TalentLMS' },
			{ label: __('Google Drive'), value: 'Google Drive' },
			{ label: __('Notion'), value: 'Notion' },
			{ label: __('Spreadsheets'), value: 'Spreadsheets' },
			{ label: __('No LMS yet'), value: 'No LMS yet' },
			{ label: __('Other'), value: 'Other' },
		],
	},
])

usePageMeta(() => {
	return {
		title: 'Persona',
		icon: brand.favicon,
	}
})
</script>
