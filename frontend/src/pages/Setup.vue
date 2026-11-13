<template>
	<SetupFlow
		v-if="setupState.fetched && steps.length"
		:steps="steps"
		:labels="labels"
		:back-button="false"
		@finish="finish"
	>
		<template #brand>
			<div
				class="flex items-center gap-2 text-base font-medium text-ink-gray-9"
			>
				<LMSLogo class="size-6" />
				{{ __('Frappe Learning') }}
			</div>
		</template>

		<template #step="{ step, done, skip, back, canGoBack }">
			<div class="flex flex-col">
				<h1 class="text-2xl-semibold text-ink-gray-9">{{ step.title }}</h1>
				<p class="mt-1.5 text-p-base text-ink-gray-6">{{ step.subtitle }}</p>

				<div class="mt-7">
					<ChoiceStep
						v-if="step.type === 'tags'"
						:options="step.options"
						:model-value="answers[step.key]"
						@select="(option) => pick(step, option, done)"
						@deselect="delete answers[step.key]"
					>
						<template #icon="{ option }">
							<PersonaToolIcon v-if="option.icon" :name="option.icon" />
						</template>
					</ChoiceStep>
					<ListStep
						v-else-if="step.type === 'outcome'"
						:options="step.options"
						@choose="(option) => chooseGoal(option, done)"
					/>
					<SetupInvite
						v-else-if="step.type === 'invite'"
						:can-go-back="canGoBack"
						@done="done"
						@skip="skip"
						@back="back"
					/>
					<PasswordStep
						v-else-if="step.type === 'password'"
						:labels="passwordLabels"
						@done="done"
					/>
				</div>

				<div
					v-if="step.type === 'tags' || step.type === 'outcome'"
					class="-mx-2 mt-6 flex items-center gap-2"
				>
					<Button
						v-if="step.type === 'tags'"
						variant="ghost"
						class="text-ink-gray-6"
						:label="__('Skip this question')"
						@click="skip"
					/>
					<Button
						v-if="canGoBack"
						variant="ghost"
						class="ms-auto text-ink-gray-6"
						icon-left="lucide-arrow-left"
						:label="__('Back')"
						@click="back"
					/>
				</div>
			</div>
		</template>

		<template #footer>
			<TelemetryConsent
				app-name="lms"
				class="mx-auto w-full max-w-md"
				:label="
					__('Share anonymous usage data to help improve Frappe Learning')
				"
				:error-message="__('Could not save your choice. Please try again.')"
			/>
		</template>

		<template #preview>
			<SetupPreview />
		</template>
	</SetupFlow>
	<div
		v-else-if="setupState.error"
		class="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"
	>
		<p class="max-w-sm text-p-base text-ink-gray-7">
			{{
				__('Could not load your setup. Check your connection and try again.')
			}}
		</p>
		<Button
			variant="solid"
			:label="__('Try again')"
			@click="setupState.reload()"
		/>
	</div>
</template>

<script setup>
import { Button, call, createResource, toast, usePageMeta } from 'frappe-ui'
import {
	ChoiceStep,
	ListStep,
	PasswordStep,
	SetupFlow,
	TelemetryConsent,
} from '@framework/ui/components/SetupFlow/index'
import { useTelemetry } from '@framework/ui/telemetry/index'
import { computed, inject, reactive } from 'vue'
import { useRouter } from 'vue-router'
import LMSLogo from '@/components/Icons/LMSLogo.vue'
import PersonaToolIcon from '@/components/PersonaToolIcon.vue'
import SetupInvite from '@/components/Setup/SetupInvite.vue'
import SetupPreview from '@/components/Setup/SetupPreview.vue'
import { setupQuestions } from '@/utils/setupQuestions'

const user = inject('$user')
const router = useRouter()
const { capture } = useTelemetry()

const answers = reactive({})
let goalRoute = { name: 'Home' }

const setupState = createResource({
	url: 'lms.lms.onboarding.get_setup_state',
	auto: true,
	onSuccess(data) {
		// The site itself is not set up yet: the desk wizard comes first.
		if (data?.setup_url) window.location.href = data.setup_url
		// Nothing left to ask, so an old bookmark or a second visit goes home.
		else if (data?.needs_setup === false) router.replace({ name: 'Home' })
	},
})

const steps = computed(() => {
	if (setupState.data?.setup_url) return []
	return allSteps.value
})

const allSteps = computed(() => [
	// A site owner who arrived without a password sets one first; the rest only when it
	// was never done.
	...(setupState.data?.needs_password
		? [
				{
					name: 'password',
					type: 'password',
					required: true,
					title: __('Set your password'),
					subtitle: __(
						'You are signed in, but have no password yet. Set one so you can sign in again from any device.'
					),
				},
		  ]
		: []),
	...(setupState.data?.needs_questions === false
		? []
		: setupQuestions().map((question) => ({
				...question,
				name: question.key,
		  }))),
	...(setupState.data?.can_send_email === false ||
	setupState.data?.needs_questions === false
		? []
		: [
				{
					name: 'invite_team',
					type: 'invite',
					title: __('Invite your team'),
					subtitle: __(
						'Add the people who will build courses with you, or your first learners.'
					),
				},
		  ]),
])

const labels = computed(() => ({
	back: __('Back'),
	skip: __('Skip setup'),
	skipTitle: __('Skip setup?'),
	skipMessage: __(
		'You can invite people later. The getting started checklist will guide you from here.'
	),
	cancel: __('Cancel'),
	stepOf: (step, total) => __('Step {0} of {1}').format(step, total),
}))

const passwordLabels = computed(() => ({
	label: __('Password'),
	placeholder: __('At least 8 characters'),
	hint: '',
	show: __('Show'),
	hide: __('Hide'),
	save: __('Save and continue'),
	failed: __('That password could not be saved. Try another.'),
}))

function pick(step, option, done) {
	answers[step.key] = option.value
	done({ choice: option.value })
}

function chooseGoal(option, done) {
	answers.first_milestone = option.value
	goalRoute = option.route ?? goalRoute
	done({ choice: option.value })
}

async function finish() {
	try {
		await call('lms.lms.onboarding.save_setup', {
			first_goal: answers.first_milestone,
		})
	} catch (e) {
		// Stay here, so the answers are kept and the last step can be sent again.
		toast.error(
			e?.messages?.[0] || __('Could not save your setup. Please try again.')
		)
		return
	}
	if (answers.first_milestone) {
		try {
			localStorage.setItem('lmsFirstGoal', answers.first_milestone)
		} catch {
			// The sidebar asks the server instead.
		}
	}
	if (Object.keys(answers).length) {
		capture('onboarding_persona', { ...answers })
		call('lms.lms.api.capture_user_persona', {
			responses: JSON.stringify({ site: user.data?.sitename, ...answers }),
		}).catch(() => {})
	}
	// A full load, so the getting-started checklist, set up when the app
	// first loaded, is built again in the order of the goal just picked.
	window.location.href = router.resolve(goalRoute).href
}

usePageMeta(() => ({ title: __('Set up Frappe Learning') }))
</script>
