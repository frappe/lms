<template>
	<SetupPreviewLogin
		v-if="step?.type === 'password'"
		:email="email"
		:password-length="passwordLength"
		:ready="passwordReady"
		:email-link="false"
		:labels="loginLabels"
	>
		<template #logo>
			<LMSLogo />
		</template>
	</SetupPreviewLogin>
	<div v-else ref="root" class="preview-app flex h-full w-full">
		<Sidebar
			:collapsed="false"
			width="14rem"
			:ariaLabel="__('Preview')"
			class="border-e"
		>
			<div class="py-2" data-preview-cursor="brand">
				<SidebarHeader
					:title="brandName.trim() || __('Learning')"
					:subtitle="convertToTitleCase(userName)"
				>
					<template #prefix>
						<img
							v-if="brandLogo"
							:src="safeUrl(brandLogo)"
							alt=""
							class="size-full rounded object-cover"
						/>
						<LMSLogo v-else class="size-full" />
					</template>
				</SidebarHeader>
			</div>
			<div class="flex flex-col gap-0.5 px-2 pt-2">
				<template v-for="(group, index) in links" :key="group.label">
					<div v-if="index" class="h-2.5" />
					<SidebarItem
						v-for="link in group.items"
						:key="link.label"
						:label="__(link.label)"
						:icon="iconFor(link.icon)"
						:active="link.to === view"
					/>
				</template>
			</div>
			<div class="mt-auto flex flex-col gap-1 px-2 pb-2">
				<SidebarCollapseButton />
			</div>
		</Sidebar>
		<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
			<SetupPreviewSwap>
				<div
					:key="view + usage + Boolean(landing)"
					class="flex min-h-0 flex-1 flex-col"
					:class="[
						ACTIVE_TAB_ON_ITSELF,
						!handingOver && 'app-columns',
						staffUpdated && 'staff-updated',
					]"
				>
					<ListPage
						v-if="view === 'Courses'"
						:breadcrumbs="[{ label: __('Courses') }]"
						:title="__('All Courses')"
						:rows="landing?.rows || courses"
						:total-count="(landing?.rows || courses).length"
						:loading="false"
						:empty-name="__('Courses')"
						empty-icon="lucide-book-open"
					>
						<template #actions>
							<Popover
								:open="menuShown"
								trigger="manual"
								align="end"
								:portal-to="root || undefined"
								:auto-focus="false"
								:dismissible="false"
							>
								<template #trigger>
									<Button
										variant="subtle"
										class="ring-outline-gray-4 transition-[box-shadow,transform,background-color] duration-150"
										:class="[
											importOpen && 'ring-2',
											pressing && 'scale-95 !bg-surface-gray-4',
										]"
									>
										{{ __('Import') }}
									</Button>
								</template>
								<div class="flex flex-col gap-0.5 p-1.5">
									<ItemListRow
										v-for="option in importOptions"
										:key="option.label"
										:active="option.active"
										class="transition-colors duration-500"
									>
										<template #prefix>
											<span
												:class="option.icon"
												class="size-4 shrink-0 text-ink-gray-6"
											/>
										</template>
										{{ option.label }}
									</ItemListRow>
								</div>
							</Popover>
							<Button
								variant="solid"
								class="ring-outline-gray-4 transition-shadow duration-300"
								:class="fromScratch && 'ring-2'"
							>
								<template #prefix>
									<span class="lucide-plus size-4" />
								</template>
								{{ __('New Course') }}
							</Button>
						</template>
						<template #filters>
							<TabButtons
								:options="courseTabs"
								:model-value="'live'"
								class="!w-fit shrink-0"
							/>
							<FormControl
								:placeholder="__('Search')"
								:aria-label="__('Search')"
								type="text"
							>
								<template #prefix>
									<span class="lucide-search size-4 text-ink-gray-5" />
								</template>
							</FormControl>
							<ToggleFilter
								:modelValue="goal === CERTIFICATE && !landing"
								:label="__('Certification')"
								:mobileLabel="__('Certification available')"
							/>
						</template>
						<template #card="{ row }">
							<div class="relative h-full" data-preview-cursor="card">
								<CourseCard :course="row" />
								<Badge v-if="examples" v-bind="EXAMPLE_BADGE" />
							</div>
						</template>
					</ListPage>
					<ListPage
						v-else
						:breadcrumbs="[{ label: __('Batches') }]"
						:title="__('Active Batches')"
						:rows="landing?.rows || [batch]"
						:total-count="(landing?.rows || [batch]).length"
						:loading="false"
						:empty-name="__('Batches')"
						empty-icon="lucide-users"
					>
						<template #actions>
							<Button variant="subtle">{{ __('Import') }}</Button>
							<Button variant="solid">
								<template #prefix>
									<span class="lucide-plus size-4" />
								</template>
								{{ __('New Batch') }}
							</Button>
						</template>
						<template #filters>
							<TabButtons
								:options="batchTabs"
								:model-value="'active'"
								class="!w-fit shrink-0"
							/>
							<FormControl
								:placeholder="__('Search')"
								:aria-label="__('Search')"
								type="text"
							>
								<template #prefix>
									<span class="lucide-search size-4 text-ink-gray-5" />
								</template>
							</FormControl>
						</template>
						<template #card="{ row }">
							<div class="relative h-full" data-preview-cursor="card">
								<BatchCard :batch="row" />
								<Badge v-if="examples" v-bind="EXAMPLE_BADGE" />
							</div>
						</template>
					</ListPage>
				</div>
			</SetupPreviewSwap>
		</div>
	</div>
</template>

<script setup>
import {
	Badge,
	Button,
	FormControl,
	ItemListRow,
	Popover,
	Sidebar,
	SidebarHeader,
	SidebarItem,
	TabButtons,
} from 'frappe-ui'
import {
	SetupPreviewLogin,
	SetupPreviewSwap,
} from '@framework/ui/components/SetupFlow/index'
import * as icons from 'lucide-vue-next'
import { safeUrl } from '@/utils/safeUrl'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import ToggleFilter from '@/components/Controls/ToggleFilter.vue'
import CourseCard from '@/components/CourseCard.vue'
import SidebarCollapseButton from '@/components/Sidebar/SidebarCollapseButton.vue'
import LMSLogo from '@/components/Icons/LMSLogo.vue'
import ListPage from '@/components/Layouts/pages/ListPage.vue'
import BatchCard from '@/pages/Batches/components/BatchCard.vue'
import { convertToTitleCase, getSidebarLinks } from '@/utils'
import {
	SPREADSHEET_TOOLS,
	samplesFor,
	teacher,
} from '@/utils/setupPreviewData'

const props = defineProps({
	step: { type: Object, default: null },
	answers: { type: Object, required: true },
	email: { type: String, default: '' },
	/** Under the app name in the sidebar header, as the app shows the signed-in user. */
	userName: { type: String, default: '' },
	passwordLength: { type: Number, default: 0 },
	passwordReady: { type: Boolean, default: false },
	/** The name and logo being typed on the brand step, shown in the sidebar header as they will be. */
	brandName: { type: String, default: '' },
	brandLogo: { type: String, default: '' },
	invitees: { type: Array, default: () => [] },
	/** True while the preview grows into the app, so the page takes the app's own columns. */
	handingOver: { type: Boolean, default: false },
	/** The site's own page the owner lands on, `{ view, rows }`, shown in place of the samples. */
	landing: { type: Object, default: null },
})

const CERTIFICATE = 'Award my first certificate'
const PAID = 'Launch a paid course'
const ONBOARD = 'Onboard my existing learners'
const STUDENT = 'LMS Student'
const TEACHERS = ['Course Creator', 'Moderator']
// TabButtons measures its sliding active pill in screen pixels, and the preview is the app
// scaled down to fit, so the pill lands small and off its tab. Here the active tab carries
// the pill's own surface and the measured one is hidden.
const ACTIVE_TAB_ON_ITSELF =
	'[&_[data-slot=tab-indicator]]:hidden [&_[data-slot=tab-button][data-state=active]]:bg-surface-elevation-3 [&_[data-slot=tab-button][data-state=active]]:shadow-base'
const EVALUATOR = 'Batch Evaluator'

// The Import menu opens on the tool question to show where existing courses come in. A
// spreadsheet tool lights its import; starting from nothing points at New Course instead.
const root = ref(null)
const onToolStep = computed(() => props.step?.name === 'current_tool')
const fromScratch = computed(
	() => onToolStep.value && props.answers.current_tool === 'No LMS yet'
)
const importOpen = computed(() => onToolStep.value && !fromScratch.value)
// Played as a click: the button lights, is pressed, and the menu opens as it lets go.
const PRESS_AT_MS = 450
const PRESS_MS = 160
const menuShown = ref(false)
const pressing = ref(false)
let menuTimers = []
const clearMenuTimers = () => menuTimers.splice(0).forEach(clearTimeout)
watch(
	importOpen,
	(open) => {
		clearMenuTimers()
		pressing.value = false
		if (!open) return (menuShown.value = false)
		menuTimers.push(
			setTimeout(() => (pressing.value = true), PRESS_AT_MS),
			setTimeout(() => {
				pressing.value = false
				menuShown.value = true
			}, PRESS_AT_MS + PRESS_MS)
		)
	},
	{ immediate: true }
)
onBeforeUnmount(clearMenuTimers)
const importOptions = computed(() => [
	{
		label: __('Import from a spreadsheet'),
		icon: 'lucide-upload',
		active: SPREADSHEET_TOOLS.includes(props.answers.current_tool),
	},
	{ label: __('Import via ZIP'), icon: 'lucide-folder-plus', active: false },
])

const usage = computed(() => props.answers.usage_context || '')
const goal = computed(() => props.answers.first_milestone)
const view = computed(
	() => props.landing?.view || (goal.value === ONBOARD ? 'Batches' : 'Courses')
)
const samples = computed(() => samplesFor(usage.value))
// Before the usage question the samples are the demo course and batch setup creates. After
// it they are made up for that kind of organization, so they say so until the site's own
// rows replace them.
const examples = computed(() => Boolean(usage.value) && !props.landing)
// The preview shows the app at about two thirds of its size, so the badge is drawn a little
// larger than in the app to stay readable. Subtle, so it reads as a label and not an action.
const EXAMPLE_BADGE = {
	label: __('Example'),
	theme: 'gray',
	variant: 'subtle',
	size: 'lg',
	class:
		'absolute end-4 top-4 z-10 origin-top-right scale-110 rtl:origin-top-left',
}
const links = getSidebarLinks()

const invited = (roles) =>
	props.invitees.filter((person) => roles.includes(person.role))
const asTeachers = (people) =>
	people.map(({ email }) => teacher(nameFrom(email), email))

// Everyone invited to run the batch, evaluators too, shows on its card; each invited
// student takes a seat.
const batch = computed(() => {
	const staff = invited([...TEACHERS, EVALUATOR])
	const students = invited([STUDENT]).length
	const row = samples.value.batch
	return {
		...row,
		seats_left: Math.max(row.seat_count - students, 0),
		...(staff.length && { instructors: asTeachers(staff) }),
	}
})

const courses = computed(() => {
	let rows = samples.value.courses.map((row) => ({
		...row,
		paid_course: goal.value === PAID ? 1 : 0,
	}))
	if (goal.value === CERTIFICATE)
		rows = rows.filter((row) => row.enable_certification)
	// Course Creators and Moderators teach; students add to the enrolled count; evaluators
	// grade batches, so the course card shows neither.
	const teachers = invited(TEACHERS)
	const students = invited([STUDENT]).length
	if (rows.length && (teachers.length || students)) {
		rows[0] = {
			...rows[0],
			enrollments: rows[0].enrollments + students,
			...(teachers.length && {
				instructors: asTeachers(teachers),
			}),
		}
	}
	return rows
})

const courseTabs = computed(() => [
	{ label: __('Published'), value: 'live' },
	{ label: __('Upcoming'), value: 'upcoming' },
	{ label: __('Created'), value: 'created' },
	{ label: __('Unpublished'), value: 'unpublished' },
])

const batchTabs = computed(() => [
	{ label: __('Active'), value: 'active' },
	{ label: __('Upcoming'), value: 'upcoming' },
	{ label: __('Archived'), value: 'archived' },
	{ label: __('Unpublished'), value: 'unpublished' },
])

const loginLabels = computed(() => ({
	title: __('Sign In'),
	subtitle: __('Welcome! Please sign in to continue.'),
	email: __('Email'),
	password: __('Password'),
	forgot: __('Forgot password?'),
	submit: __('Continue'),
}))

// michelle.dsouza@example.com shows as Michelle Dsouza, as the person would once signed up.
const nameFrom = (email) =>
	email
		.split('@')[0]
		.split(/[._-]+/)
		.filter(Boolean)
		.map((part) => part[0].toUpperCase() + part.slice(1))
		.join(' ')

const iconFor = (name) => (typeof name === 'string' ? icons[name] : name)

// An invited teammate takes the sample instructor's place on the card; a short highlight on
// the instructor row shows where. Invited people are named by email, the samples are not.
const STAFF_HIGHLIGHT_MS = 1800
const staffNames = computed(() =>
	(
		(view.value === 'Batches' ? batch.value : courses.value[0])?.instructors ||
		[]
	)
		.map((person) => person.name)
		.join()
)
const staffUpdated = ref(false)
let staffTimer
watch(staffNames, async (names, before) => {
	if (props.landing || names === before || !names.includes('@')) return
	clearTimeout(staffTimer)
	staffUpdated.value = false
	// A frame without the class, so a second invite replays the highlight.
	await nextTick()
	await new Promise((resolve) => requestAnimationFrame(resolve))
	staffUpdated.value = true
	staffTimer = setTimeout(
		() => (staffUpdated.value = false),
		STAFF_HIGHLIGHT_MS
	)
})
onBeforeUnmount(() => clearTimeout(staffTimer))
</script>

<style scoped>
/* The list's columns follow the browser width, which is the whole screen here, not the
   preview. Cards take the width the app gives them on this screen: the screen less the
   224px sidebar and the list's padding and gaps, over the app's three or four columns. */
.app-columns :deep(.grid.gap-5) {
	grid-template-columns: repeat(auto-fill, calc((100vw - 304px) / 3));
}
@media (min-width: 1536px) {
	.app-columns :deep(.grid.gap-5) {
		grid-template-columns: repeat(auto-fill, calc((100vw - 324px) / 4));
	}
}

/* The app's menus open in one quick fade. The preview's Import menu opens slower, growing
   from the button it drops from, so it reads as a click beside the question. */
@media (prefers-reduced-motion: no-preference) {
	.preview-app :deep([data-slot='content'][data-state='open']) {
		transform-origin: var(--reka-popover-content-transform-origin);
		animation: preview-menu-open 380ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	/* A price shows up on the card when the goal is a paid course: it pops in inside a gray
	   border that fades, so the change is seen. The card's price is its only bold line in the
	   footer. An outline, not a border, so nothing around it moves. */
	.preview-app :deep(.gap-x-2 > .font-semibold) {
		border-radius: 0.375rem;
		outline: 1px solid transparent;
		outline-offset: 0.25rem;
		animation: preview-price-in 1800ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
	}
}

@media (prefers-reduced-motion: no-preference) {
	/* An outline, not margin, padding or a border: the batch card spaces this row with its own
	   margin, and changing it made the row jump while lit. */
	.staff-updated :deep(.flex.avatar-group) {
		border-radius: 0.375rem;
		outline: 1px solid transparent;
		outline-offset: 0.25rem;
		animation: preview-staff-in 1800ms cubic-bezier(0.16, 1, 0.3, 1);
	}
}

@keyframes preview-staff-in {
	0% {
		transform: scale(0.94);
		outline-color: var(--outline-gray-4);
	}
	25% {
		transform: scale(1.05);
	}
	40% {
		transform: scale(1);
	}
	70% {
		outline-color: var(--outline-gray-4);
	}
	100% {
		outline-color: transparent;
	}
}

@keyframes preview-menu-open {
	from {
		opacity: 0;
		transform: translateY(-8px) scale(0.94);
	}
}

@keyframes preview-price-in {
	0% {
		opacity: 0;
		transform: scale(0.6);
		outline-color: var(--outline-gray-4);
	}
	25% {
		opacity: 1;
		transform: scale(1.12);
	}
	40% {
		transform: scale(1);
	}
	70% {
		outline-color: var(--outline-gray-4);
	}
	100% {
		outline-color: transparent;
	}
}
</style>
