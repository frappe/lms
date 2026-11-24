<template>
	<SetupFlow
		v-if="setupState.fetched && steps.length"
		:steps="steps"
		:labels="labels"
		:back-button="false"
		preview-side="end"
		@finish="finish"
		@vue:mounted="sendStartIfLost"
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
						:first-role="
							answers.first_milestone === 'Onboard my existing learners'
								? 'Batch Evaluator'
								: 'Course Creator'
						"
						@invitees="(emails) => (invitees = emails)"
						@done="done"
						@skip="skip"
						@back="back"
					/>
					<BrandStep
						v-else-if="step.type === 'brand'"
						v-model:name="brand.name"
						v-model:logo="brand.logo"
						:labels="brandLabels"
						:max-length="140"
						:save="saveBrand"
						@done="done"
					>
						<template #placeholder>
							<LMSLogo class="size-full" />
						</template>
					</BrandStep>
					<PasswordStep
						v-else-if="step.type === 'password'"
						:labels="passwordLabels"
						@input="(length) => (passwordLength = length)"
						@ready="(ready) => (passwordReady = ready)"
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
						:label="__('Back')"
						@click="back"
					>
						<template #prefix>
							<span class="lucide-arrow-left size-4 rtl:rotate-180" />
						</template>
					</Button>
				</div>
			</div>
		</template>

		<template #footer>
			<TelemetryConsent
				app-name="lms"
				class="mx-auto w-full max-w-md"
				:label="
					__('Help improve Frappe Learning by sharing anonymous usage data')
				"
				:error-message="__('Could not save your choice. Please try again.')"
			/>
		</template>

		<template #preview="{ step }">
			<div class="relative h-full">
				<SetupPreviewFrame
					side="end"
					:expanded="handingOver"
					:url="previewUrl(step)"
					:tabs="[
						{
							key: 'app',
							title: brand.name.trim() || __('Frappe Learning'),
							active: true,
						},
					]"
					:user="{
						name: user.data?.full_name || '',
						image: user.data?.user_image,
					}"
					:cursor="handingOver ? null : previewCursor(step)"
					@expanded="openApp"
				>
					<template #tab-icon>
						<img
							v-if="brand.logo"
							:src="brand.logo"
							alt=""
							class="size-full object-cover"
						/>
						<LMSLogo v-else class="size-full" />
					</template>
					<SetupPreview
						:step="step"
						:answers="answers"
						:email="user.data?.email || user.data?.name || ''"
						:user-name="user.data?.full_name || ''"
						:password-length="passwordLength"
						:password-ready="passwordReady"
						:brand-name="brand.name"
						:brand-logo="brand.logo"
						:invitees="invitees"
						:handing-over="handingOver"
						:landing="landing"
					/>
				</SetupPreviewFrame>
				<!-- Centred under the window, in the frame's bottom padding; the window starts 5rem in. -->
				<Transition
					enter-active-class="transition-opacity duration-300"
					leave-active-class="transition-opacity duration-300"
					enter-from-class="opacity-0"
					leave-to-class="opacity-0"
				>
					<p
						v-if="exampleCaption(step)"
						class="pointer-events-none absolute inset-x-0 bottom-0 flex h-20 items-center justify-center ps-20 text-base text-ink-gray-6"
					>
						{{ exampleCaption(step) }}
					</p>
				</Transition>
			</div>
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
import {
	Button,
	call,
	createListResource,
	createResource,
	toast,
	usePageMeta,
} from 'frappe-ui'
import {
	BrandStep,
	ChoiceStep,
	ListStep,
	PasswordStep,
	SetupFlow,
	SetupPreviewFrame,
	TelemetryConsent,
} from '@framework/ui/components/SetupFlow/index'
import { useTelemetry } from '@framework/ui/telemetry/index'
import { computed, inject, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LMSLogo from '@/components/Icons/LMSLogo.vue'
import PersonaToolIcon from '@/components/PersonaToolIcon.vue'
import SetupInvite from '@/components/Setup/SetupInvite.vue'
import SetupPreview from '@/components/Setup/SetupPreview.vue'
import { sessionStore } from '@/stores/session'
import { setupQuestions } from '@/utils/setupQuestions'

const user = inject('$user')
const router = useRouter()
const telemetry = useTelemetry()
const { capture } = telemetry

const answers = reactive({})

const passwordLength = ref(0)
const passwordReady = ref(false)
const { branding } = sessionStore()
// Prefilled from Brand settings, unless it is still Frappe's own name. Branding may still be
// loading when the page opens; fill what the owner has not typed yet, so a save never clears a
// logo the site already has.
const brand = reactive({ name: '', logo: '' })
watch(
	() => branding.data,
	(data) => {
		if (!data) return
		if (!brand.name && data.app_name !== 'Frappe')
			brand.name = data.app_name || ''
		brand.logo ||= data.banner_image?.file_url || data.app_logo?.file_url || ''
	},
	{ immediate: true }
)
const invitees = ref([])
const handingOver = ref(false)
const landing = ref(null)
// Long enough for the swap to the site's own list to finish before the window grows.
const LANDING_SWAP_MS = 500
const TOOL_PICK_MS = 800
const dayjs = inject('$dayjs')
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
		: [
				{
					name: 'brand',
					type: 'brand',
					title: __("What's your organization called?"),
					subtitle: __('Learners see this name and logo everywhere.'),
				},
		  ]),
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
	hint: __(
		'At least 8 characters. Mixing in numbers and symbols makes it stronger.'
	),
	show: __('Show'),
	hide: __('Hide'),
	save: __('Save and continue'),
	failed: __('That password could not be saved. Try another.'),
}))

const brandLabels = computed(() => ({
	logoLabel: __('Logo'),
	// The Learning logo shows until one is uploaded, so there is always a logo to replace.
	upload: __('Replace'),
	reupload: __('Replace'),
	remove: __('Remove'),
	nameLabel: __('Organization or team name'),
	namePlaceholder: __('Acme Academy'),
	save: __('Continue'),
	notAnImage: __('Choose an image file.'),
	uploadFailed: __('That logo could not be uploaded. Try another.'),
	failed: __('Your name and logo could not be saved. Try again.'),
}))

// Where the preview's pointer rests on each step: the part of the app that step changes.
function previewCursor(step) {
	if (step?.type === 'password')
		return '[data-slot="setup-preview-login-submit"]'
	if (step?.type === 'brand') return '[data-preview-cursor="brand"]'
	return '[data-preview-cursor="card"]'
}

// The address of the page the preview shows: sign-in first, then the list setup lands on.
function previewUrl(step) {
	const site = window.location.host
	if (step?.type === 'password') return `${site}/login`
	return `${site}/lms/${previewsBatches() ? 'batches' : 'courses'}`
}

function previewsBatches() {
	return (
		landing.value?.view === 'Batches' ||
		(!landing.value &&
			answers.first_milestone === 'Onboard my existing learners')
	)
}

// Made-up cards follow the usage answer; until then the preview shows the real demo course.
function exampleCaption(step) {
	if (step?.type === 'password' || !answers.usage_context) return ''
	if (landing.value || handingOver.value) return ''
	return previewsBatches()
		? __('An example of how your batches will look')
		: __('An example of how your courses will look')
}

async function saveBrand({ name, logo }) {
	await call('lms.lms.onboarding.save_brand', { name, logo })
	branding.reload()
}

async function pick(step, option, done) {
	answers[step.key] = option.value
	// The preview answers a tool pick, the import it would use or New Course, before
	// the step moves on. Below lg there is no preview to wait for.
	if (
		step.key === 'current_tool' &&
		window.matchMedia?.('(min-width: 1024px)').matches
	) {
		await new Promise((resolve) => setTimeout(resolve, TOOL_PICK_MS))
		// Picked again or cleared meanwhile: that pick moves on, or none does.
		if (answers[step.key] !== option.value) return
	}
	done({ choice: option.value })
}

function chooseGoal(option, done) {
	answers.first_milestone = option.value
	goalRoute = option.route ?? goalRoute
	done({ choice: option.value })
}

// Stays set on success: the page is navigating away.
let finishing = false

async function finish() {
	if (finishing) return
	finishing = true
	try {
		await call('lms.lms.onboarding.save_setup', {
			first_goal: answers.first_milestone,
		})
	} catch (e) {
		finishing = false
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
	// Below lg the preview is hidden, so there is nothing to grow into the app.
	if (!window.matchMedia?.('(min-width: 1024px)').matches) return openApp()
	await showSite()
	handingOver.value = true
}

// The preview's samples give way to the site's own courses or batches, the rows the page
// it opens will list, so the owner lands on what they saw last.
async function showSite() {
	const toBatches = goalRoute.name === 'Batches'
	try {
		const rows = await siteList(toBatches).reload()
		landing.value = {
			view: toBatches ? 'Batches' : 'Courses',
			rows: rows || [],
		}
		await new Promise((resolve) => setTimeout(resolve, LANDING_SWAP_MS))
	} catch {
		// The page itself shows the real list a moment later; hand over as things are.
	}
}

// The list the page opens with: same resource and cache key as the Courses or Batches
// page, which reuses it, so the page has its rows on arrival instead of loading cards.
// Keep these options in step with that page's own `createListResource`.
function siteList(toBatches) {
	const shared = { pageLength: 24, start: 0 }
	return toBatches
		? createListResource({
				...shared,
				doctype: 'LMS Batch',
				url: 'lms.lms.utils.get_batches',
				cache: ['batches', user.data?.name],
				filters: {
					end_date: ['>=', dayjs().format('YYYY-MM-DD')],
					published: 1,
				},
				orderBy: 'start_date',
		  })
		: createListResource({
				...shared,
				doctype: 'LMS Course',
				url: 'lms.lms.utils.get_courses',
				cache: ['courses', user.data?.name],
				filters: { published: 1, upcoming: 0, live: 1 },
		  })
}

// No full load: the app's sidebar, which builds the getting-started checklist in the
// order of the goal just saved, mounts with the page it opens.
function openApp() {
	router.replace(goalRoute)
}

// SetupFlow sends setup_started and the first step's view as it opens, and telemetry drops
// events until it has loaded, which on a new site's first page is often later. When it is
// still off as SetupFlow opens, both are sent once it is on. Drop this when the framework's
// SetupFlow waits for telemetry itself.
function sendStartIfLost() {
	if (telemetry.isEnabled) return
	const firstStep = steps.value[0]?.name
	const stop = watch(
		() => telemetry.isEnabled,
		(on) => {
			if (!on) return
			stop()
			capture('setup_started')
			capture('setup_step_viewed', { step: firstStep })
		}
	)
}

// The tab shows the logo as soon as it is uploaded, and keeps it when setup opens the app.
usePageMeta(() => ({
	title: __('Set up Frappe Learning'),
	...(brand.logo ? { icon: brand.logo } : {}),
}))
</script>
