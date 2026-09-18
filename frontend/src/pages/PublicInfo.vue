<template>
	<div class="min-h-dvh bg-surface-gray-1 text-ink-gray-9">
		<header class="border-b bg-surface-base">
			<div
				class="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-5 py-3"
			>
				<router-link
					:to="{ name: 'Courses' }"
					class="flex items-center gap-2 rounded-md font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
				>
					<span
						class="flex size-9 items-center justify-center rounded-lg bg-surface-gray-7 text-ink-base"
						aria-hidden="true"
					>
						<span class="lucide-graduation-cap size-5" />
					</span>
					<span>{{ brand.title || __('Learning') }}</span>
				</router-link>

				<nav :aria-label="__('Public navigation')" class="hidden gap-1 sm:flex">
					<router-link
						v-for="item in navigation"
						:key="item.name"
						:to="{ name: item.name }"
						class="rounded-md px-3 py-2 text-sm text-ink-gray-6 hover:bg-surface-gray-2 hover:text-ink-gray-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
						:aria-current="route.name === item.name ? 'page' : undefined"
					>
						{{ __(item.label) }}
					</router-link>
				</nav>

				<a
					href="/login"
					class="inline-flex min-h-10 items-center rounded-md border border-outline-gray-2 bg-surface-base px-4 text-sm font-medium hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
				>
					{{ __('Log in') }}
				</a>
			</div>
		</header>

		<main id="public-content" class="mx-auto w-full max-w-4xl px-5 py-10 sm:py-16">
			<div class="mb-8 max-w-2xl">
				<div class="mb-3 text-sm font-medium text-ink-gray-5">
					{{ __('Learning platform') }}
				</div>
				<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">
					{{ __(page.title) }}
				</h1>
				<p class="mt-4 text-lg leading-7 text-ink-gray-6">
					{{ __(page.introduction) }}
				</p>
			</div>

			<div
				v-if="page.actions?.length"
				class="mb-10 flex flex-wrap gap-3"
			>
				<a
					v-for="action in page.actions"
					:key="action.label"
					:href="safeUrl(resolveAction(action.href))"
					class="inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
					:class="
						action.primary
							? 'bg-surface-gray-7 text-ink-base hover:bg-surface-gray-6'
							: 'border border-outline-gray-2 bg-surface-base hover:bg-surface-gray-2'
					"
				>
					<span :class="[action.icon, 'size-4']" aria-hidden="true" />
					{{ __(action.label) }}
				</a>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<section
					v-for="section in page.sections"
					:key="section.title"
					class="rounded-xl border border-outline-gray-2 bg-surface-base p-5 sm:p-6"
					:class="section.full ? 'sm:col-span-2' : ''"
				>
					<div class="mb-3 flex items-start gap-3">
						<span
							class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-gray-2 text-ink-gray-7"
							aria-hidden="true"
						>
							<span :class="[section.icon, 'size-4']" />
						</span>
						<h2 class="pt-1.5 text-lg font-semibold">
							{{ __(section.title) }}
						</h2>
					</div>
					<p class="leading-7 text-ink-gray-6">
						{{ __(section.body) }}
					</p>
				</section>
			</div>
		</main>

		<footer class="border-t bg-surface-base">
			<div
				class="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-6 text-sm text-ink-gray-6 sm:flex-row sm:items-center sm:justify-between"
			>
				<p>© {{ new Date().getFullYear() }} {{ brand.title || __('Learning') }}</p>
				<nav :aria-label="__('Legal')" class="flex flex-wrap gap-x-5 gap-y-2">
					<router-link :to="{ name: 'Privacy' }" class="hover:text-ink-gray-9">
						{{ __('Privacy') }}
					</router-link>
					<router-link :to="{ name: 'Terms' }" class="hover:text-ink-gray-9">
						{{ __('Terms') }}
					</router-link>
					<router-link :to="{ name: 'Contact' }" class="hover:text-ink-gray-9">
						{{ __('Contact') }}
					</router-link>
				</nav>
			</div>
		</footer>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePageMeta } from 'frappe-ui'
import { sessionStore } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { safeUrl } from '@/utils/safeUrl'

type Action = { label: string; href: string; icon: string; primary?: boolean }
type Section = { title: string; body: string; icon: string; full?: boolean }
type Page = {
	title: string
	introduction: string
	actions?: Action[]
	sections: Section[]
}

const route = useRoute()
const { brand } = sessionStore()
const { settings } = useSettings()

const navigation = [
	{ name: 'About', label: 'About' },
	{ name: 'Help', label: 'Help' },
	{ name: 'Contact', label: 'Contact' },
]

const pages: Record<string, Page> = {
	About: {
		title: 'About the platform',
		introduction:
			'A practical place to create courses, teach learners, measure progress, and recognize achievement.',
		actions: [
			{ label: 'Browse courses', href: '/lms/courses', icon: 'lucide-book-open', primary: true },
			{ label: 'Create an account', href: '/login#signup', icon: 'lucide-user-plus' },
		],
		sections: [
			{ title: 'Structured learning', body: 'Courses are organized into chapters and lessons so learners always know what comes next.', icon: 'lucide-list-tree' },
			{ title: 'Assessment', body: 'Quizzes, assignments, evaluations, and progress tracking turn content into measurable learning.', icon: 'lucide-clipboard-check' },
			{ title: 'Live teaching', body: 'Batches, announcements, live classes, and instructors keep cohorts connected.', icon: 'lucide-presentation' },
			{ title: 'Certification', body: 'Learners can receive verifiable certificates after completing the required work.', icon: 'lucide-award' },
		],
	},
	Help: {
		title: 'Help center',
		introduction: 'Start with the most common actions or contact the platform team when you need more help.',
		actions: [
			{ label: 'Browse courses', href: '/lms/courses', icon: 'lucide-search', primary: true },
			{ label: 'Reset password', href: '/login#forgot', icon: 'lucide-key-round' },
		],
		sections: [
			{ title: 'Join a course', body: 'Open the course catalog, choose a course, and use the enrollment action shown on its overview page.', icon: 'lucide-circle-plus' },
			{ title: 'Continue learning', body: 'Your home page and enrolled courses show where you stopped and which lesson comes next.', icon: 'lucide-play-circle' },
			{ title: 'Submit work', body: 'Open an assignment or quiz from the lesson, complete it, and review its submission status.', icon: 'lucide-send' },
			{ title: 'Account access', body: 'Use the login page to sign in, create an account, or request a password reset email.', icon: 'lucide-shield-check' },
		],
	},
	Contact: {
		title: 'Contact us',
		introduction: 'Questions about access, courses, certificates, or your account can be sent to the platform team.',
		actions: [
			{ label: 'Send an email', href: 'contact-email', icon: 'lucide-mail', primary: true },
			{ label: 'Open help center', href: '/lms/help', icon: 'lucide-circle-help' },
		],
		sections: [
			{ title: 'Before contacting us', body: 'Include the email address on your account, the course name, and a short description of what happened.', icon: 'lucide-file-text', full: true },
			{ title: 'Account and enrollment', body: 'We can help with sign-in problems, course access, enrollment status, and profile information.', icon: 'lucide-user-round' },
			{ title: 'Learning and certificates', body: 'Contact us about lesson progress, submissions, evaluations, and certificate availability.', icon: 'lucide-graduation-cap' },
		],
	},
	Privacy: {
		title: 'Privacy policy',
		introduction: 'This page explains the information the learning platform needs and how it is used.',
		sections: [
			{ title: 'Information we use', body: 'The platform stores account details, enrollments, learning progress, submissions, messages, and certificates needed to provide the service.', icon: 'lucide-database' },
			{ title: 'Why it is used', body: 'Information is used to provide course access, save progress, evaluate work, issue certificates, secure accounts, and support learners.', icon: 'lucide-list-checks' },
			{ title: 'Sharing and access', body: 'Authorized instructors and administrators can access information required to teach, evaluate, and operate the platform. Data is not sold.', icon: 'lucide-users' },
			{ title: 'Your choices', body: 'You may request correction or deletion of eligible personal information by contacting the platform team.', icon: 'lucide-sliders-horizontal' },
			{ title: 'Security and retention', body: 'Reasonable safeguards are used to protect information. Records are retained only while needed for learning, legal, or operational purposes.', icon: 'lucide-lock-keyhole', full: true },
		],
	},
	Terms: {
		title: 'Terms of use',
		introduction: 'These rules help keep the learning platform useful, lawful, and safe for everyone.',
		sections: [
			{ title: 'Your account', body: 'Provide accurate information, keep your credentials private, and notify the platform team if you suspect unauthorized access.', icon: 'lucide-user-check' },
			{ title: 'Acceptable use', body: 'Do not disrupt the service, bypass access controls, upload harmful material, impersonate others, or misuse another learner’s work.', icon: 'lucide-badge-check' },
			{ title: 'Course content', body: 'Course materials remain subject to their respective ownership and license terms. Do not redistribute restricted material without permission.', icon: 'lucide-copyright' },
			{ title: 'Learning records', body: 'Progress, submissions, grades, and certificates may be corrected when errors or policy violations are identified.', icon: 'lucide-scroll-text' },
			{ title: 'Availability and changes', body: 'Features and content may change as the service improves. Important policy changes should be communicated through the platform.', icon: 'lucide-refresh-cw', full: true },
		],
	},
}

const page = computed(() => pages[String(route.name)] || pages.About)

const resolveAction = (href: string) => {
	if (href !== 'contact-email') return href
	const email = settings.data?.contact_us_email
	return email ? `mailto:${email}` : '/lms/help'
}

usePageMeta(() => ({ title: __(page.value.title), icon: brand.favicon }))
</script>
