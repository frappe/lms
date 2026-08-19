<template>
	<div
		class="relative flex min-h-dvh flex-col overflow-y-auto bg-surface-base transition-opacity duration-300 ease-out"
		:class="leaving ? 'opacity-0' : 'opacity-100'"
	>
		<div class="flex flex-1 justify-center px-4 pb-16 pt-[105px]">
			<PersonaCard
				:steps="steps"
				@complete="handleComplete"
				@choose="handleChoose"
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
import PersonaCard from '@/components/Persona/PersonaCard.vue'
import { call, usePageMeta } from 'frappe-ui'
import { useTelemetry } from 'frappe-ui/frappe'
import { BookOpen, Users, Award, Rocket, Compass } from 'lucide-vue-next'
import { computed, inject, markRaw, ref } from 'vue'
import { useRouter } from 'vue-router'
import { sessionStore } from '@/stores/session'

const user = inject('$user')
const router = useRouter()
const { brand } = sessionStore()
const { capture } = useTelemetry()

const leaving = ref(false)
const FADE_MS = 300
const collected = ref({})

const PERSONALISE_HINT = __(
	'This helps us personalise your learning experience.'
)

// The whole flow is driven by this data. Steps render by `type`; adding or
// reordering steps is an edit here, not in PersonaCard.
const steps = computed(() => [
	{
		key: 'discovery_source',
		type: 'tags',
		title: __('How did you hear about Frappe Learning?'),
		subtitle: PERSONALISE_HINT,
		options: [
			{
				label: __('Search engine (Google, etc.)'),
				value: 'Search engine',
			},
			{ label: __('GitHub'), value: 'GitHub' },
			{
				label: __('Already using Frappe / ERPNext'),
				value: 'Already using Frappe / ERPNext',
			},
			{
				label: __('Frappe Cloud Marketplace'),
				value: 'Frappe Cloud Marketplace',
			},
			{ label: __('Social media'), value: 'Social media' },
			{ label: __('Friend or colleague'), value: 'Friend or colleague' },
			{
				label: __('AI assistant (ChatGPT, etc.)'),
				value: 'AI assistant',
			},
			{ label: __('Other'), value: 'Other' },
		],
	},
	{
		key: 'usage_context',
		type: 'tags',
		title: __('Where will you be using Frappe Learning?'),
		subtitle: PERSONALISE_HINT,
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
			{ label: __('Company or Workplace'), value: 'Company or Workplace' },
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
		key: 'current_tool',
		type: 'tags',
		title: __('What are you using today to manage learning?'),
		subtitle: PERSONALISE_HINT,
		options: [
			{ label: __('Moodle'), value: 'Moodle', icon: 'moodle' },
			{
				label: __('Google Classroom'),
				value: 'Google Classroom',
				icon: 'google-classroom',
			},
			{ label: __('Canvas'), value: 'Canvas', icon: 'canvas' },
			{ label: __('Open edX'), value: 'Open edX', icon: 'open-edx' },
			{ label: __('Classplus'), value: 'Classplus', icon: 'class-plus' },
			{ label: __('Teachmint'), value: 'Teachmint', icon: 'teach-mint' },
			{ label: __('LearnDash'), value: 'LearnDash', icon: 'learndash' },
			{ label: __('Thinkific'), value: 'Thinkific', icon: 'thinkific' },
			{ label: __('Teachable'), value: 'Teachable', icon: 'teachable' },
			{ label: __('Kajabi'), value: 'Kajabi', icon: 'kajabi' },
			{ label: __('TalentLMS'), value: 'TalentLMS', icon: 'talent-lms' },
			{
				label: __('Google Drive'),
				value: 'Google Drive',
				icon: 'google-drive',
			},
			{ label: __('Notion'), value: 'Notion', icon: 'notion' },
			{
				label: __('Spreadsheets'),
				value: 'Spreadsheets',
				icon: 'spreadsheet',
			},
			{ label: __('No LMS yet'), value: 'No LMS yet', icon: 'no_lms' },
			{ label: __('Other'), value: 'Other', icon: 'other' },
		],
	},
	{
		key: 'first_milestone',
		type: 'outcome',
		title: __('Your workspace is ready'),
		subtitle: __('Where do you want to start?'),
		options: [
			{
				label: __('Publish my first course'),
				value: 'Publish my first course',
				description: __('Set up your first course and lessons.'),
				icon: markRaw(BookOpen),
				route: { name: 'Courses' },
			},
			{
				label: __('Onboard my existing learners'),
				value: 'Onboard my existing learners',
				description: __('Bring your learners into a batch.'),
				icon: markRaw(Users),
				route: { name: 'Batches' },
			},
			{
				label: __('Award my first certificate'),
				value: 'Award my first certificate',
				description: __('Configure certification for a course.'),
				icon: markRaw(Award),
				route: { name: 'Courses' },
			},
			{
				label: __('Launch a paid course'),
				value: 'Launch a paid course',
				description: __('Add pricing and go live.'),
				icon: markRaw(Rocket),
				route: { name: 'Courses' },
			},
			{
				label: __('Just exploring'),
				value: 'Just exploring',
				description: __('Poke around a sample course.'),
				icon: markRaw(Compass),
				route: { name: 'Courses' },
			},
		],
	},
])

const persistCaptured = () =>
	call('frappe.client.set_value', {
		doctype: 'LMS Settings',
		name: 'LMS Settings',
		fieldname: 'persona_captured',
		value: 1,
	})

// All tag questions answered; hold the answers until the outcome row is
// chosen so the persona is submitted once, with the same keys as before.
const handleComplete = (answers) => {
	collected.value = { ...answers }
}

// The outcome screen IS the first_milestone question, rendered as routed
// rows. Choosing one completes the persona: single submission with the
// original key set, so the frappe school / pulse payload shape is unchanged.
const handleChoose = (step, option) => {
	if (leaving.value) return
	const answers = { ...collected.value, [step.key]: option.value }
	capture('onboarding_persona', answers)
	// External analytics call; fire without blocking the transition.
	call('lms.lms.api.capture_user_persona', {
		responses: JSON.stringify({ site: user.data?.sitename, ...answers }),
	})
	leaveTo(option.route ?? { name: 'Home' }, persistCaptured())
}

const skipPersonaForm = () => {
	if (leaving.value) return
	// Don't discard answers the user already gave: if they skip on the outcome
	// screen, submit what was collected (same keys, minus the final choice).
	if (Object.keys(collected.value).length) {
		const answers = { ...collected.value }
		capture('onboarding_persona', answers)
		call('lms.lms.api.capture_user_persona', {
			responses: JSON.stringify({ site: user.data?.sitename, ...answers }),
		})
	}
	leaveTo({ name: 'Home' }, persistCaptured())
}

// Fade out while the persist call settles; navigate once both are done so a
// failed set_value can't be silently abandoned mid-navigation.
const leaveTo = async (route, persist) => {
	leaving.value = true
	const fade = new Promise((resolve) => setTimeout(resolve, FADE_MS))
	try {
		await Promise.all([persist, fade])
	} catch (e) {
		await fade
	}
	router.push(route)
}

usePageMeta(() => {
	return {
		title: 'Persona',
		icon: brand.favicon,
	}
})
</script>
