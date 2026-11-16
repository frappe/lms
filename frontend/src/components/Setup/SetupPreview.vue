<template>
	<div
		class="flex h-full flex-col items-center justify-center gap-5 bg-surface-gray-3 p-10"
	>
		<div
			inert
			aria-hidden="true"
			class="w-full max-w-[860px] select-none overflow-hidden rounded-8 border border-outline-gray-2 bg-surface-base shadow-2xl [zoom:0.7]"
		>
			<div
				class="flex items-center gap-3 border-b border-outline-gray-1 bg-surface-gray-1 px-4 py-3"
			>
				<div class="flex gap-1.5">
					<span
						v-for="dot in 3"
						:key="dot"
						class="size-3 rounded-full bg-surface-gray-3"
					/>
				</div>
				<div
					class="mx-auto w-80 truncate rounded-6 border border-outline-gray-1 bg-surface-base px-3 py-1 text-center text-sm text-ink-gray-6"
				>
					{{ address }}
				</div>
			</div>

			<div class="flex h-[560px]">
				<nav
					class="flex w-52 shrink-0 flex-col border-e border-outline-gray-1 bg-surface-sidebar p-2 text-base text-ink-gray-7"
				>
					<div
						class="flex items-center gap-2 px-2 pb-3 pt-1.5 font-semibold text-ink-gray-9"
					>
						<LMSLogo class="size-7" />
						<div class="min-w-0 flex-1 leading-tight">
							<div class="truncate">{{ __('Learning') }}</div>
							<div class="truncate text-sm font-normal text-ink-gray-6">
								{{ userName || __('Your site') }}
							</div>
						</div>
						<span class="lucide-chevron-down size-4 text-ink-gray-5" />
					</div>
					<div
						v-for="link in topLinks"
						:key="link.label"
						class="flex items-center gap-2 rounded-4 px-2 py-1.5"
						:class="link.active && 'bg-surface-base text-ink-gray-9 shadow-sm'"
					>
						<span :class="link.icon" class="size-4" />
						{{ link.label }}
					</div>
					<div class="px-2 pb-1 pt-4 text-sm text-ink-gray-6">
						{{ __('Learn') }}
					</div>
					<div
						v-for="link in learnLinks"
						:key="link.label"
						class="flex items-center gap-2 rounded-4 px-2 py-1.5"
					>
						<span :class="link.icon" class="size-4" />
						{{ link.label }}
					</div>
				</nav>

				<div class="flex min-w-0 flex-1 flex-col gap-6 p-7">
					<div class="flex items-end justify-between">
						<div>
							<div class="text-2xl-semibold text-ink-gray-9">
								{{ greeting }}
							</div>
							<div class="mt-1 text-base text-ink-gray-6">
								{{ __('Ten minutes today keeps you on track.') }}
							</div>
						</div>
						<Badge theme="amber" size="lg" label="4">
							<template #prefix>
								<span class="lucide-flame size-4" />
							</template>
						</Badge>
					</div>

					<div
						class="flex items-center gap-5 rounded-7 border border-outline-gray-2 p-5"
					>
						<div
							class="flex h-20 w-32 shrink-0 items-center justify-center rounded-6 bg-surface-green-1"
						>
							<span class="lucide-shield-check size-9 text-ink-green-6" />
						</div>
						<div class="min-w-0 flex-1">
							<div class="text-sm font-medium text-ink-green-6">
								{{ __('Pick up where you left off') }}
							</div>
							<div class="mt-1 text-lg-semibold text-ink-gray-9">
								{{ __('Onboarding for new hires') }}
							</div>
							<div class="mt-3 flex items-center gap-3">
								<Progress :value="60" size="sm" class="w-40 shrink-0" />
								<span class="whitespace-nowrap text-sm text-ink-gray-6">
									{{ __('3 of 5 done') }}
								</span>
							</div>
						</div>
						<Button variant="solid" :label="__('Continue')" />
					</div>

					<div class="flex items-start gap-5">
						<div class="min-w-0 flex-[1.6]">
							<div class="mb-2.5 text-base font-semibold text-ink-gray-9">
								{{ __('Your learning') }}
							</div>
							<div
								class="divide-y divide-outline-gray-1 rounded-7 border border-outline-gray-2"
							>
								<div
									v-for="item in items"
									:key="item.title"
									class="flex items-center gap-3 px-4 py-3"
								>
									<Badge
										:label="item.kind"
										:theme="item.theme"
										class="w-16 justify-center"
									/>
									<div class="min-w-0">
										<div class="truncate text-base font-medium text-ink-gray-9">
											{{ item.title }}
										</div>
										<div class="mt-0.5 truncate text-sm text-ink-gray-6">
											{{ item.meta }}
										</div>
									</div>
								</div>
							</div>
						</div>

						<div class="min-w-0 flex-1">
							<div class="mb-2.5 text-base font-semibold text-ink-gray-9">
								{{ __('Upcoming Live Classes') }}
							</div>
							<div
								class="flex flex-col gap-3 rounded-7 border border-outline-gray-2 p-3 text-base text-ink-gray-7"
							>
								<div>
									<div class="font-semibold text-ink-gray-9">
										{{ __('Meet your mentor') }}
									</div>
									<div class="mt-1 text-sm text-ink-gray-6">
										{{ __('Bring your questions from week one.') }}
									</div>
								</div>
								<div class="flex items-center gap-2">
									<span class="lucide-calendar size-4" />
									{{ __('Tuesday') }}
								</div>
								<div class="flex items-center gap-2">
									<span class="lucide-clock size-4" />
									{{ __('11:00 AM') }}
								</div>
								<Button :label="__('Join')">
									<template #prefix>
										<span class="lucide-video size-4" />
									</template>
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<p class="max-w-sm text-center text-p-sm text-ink-gray-7">
			{{
				__(
					'This is the home page your learners will see. It shows what to continue and what is coming up.'
				)
			}}
		</p>
	</div>
</template>

<script setup>
import { Badge, Button, Progress } from 'frappe-ui'
import { computed, inject } from 'vue'
import LMSLogo from '@/components/Icons/LMSLogo.vue'

const user = inject('$user')

const address = `${window.location.host}/lms`

const userName = computed(() =>
	user.data?.name === 'Administrator' ? '' : user.data?.full_name || ''
)

const greeting = computed(() => {
	const hour = new Date().getHours()
	const hello =
		hour < 12
			? __('Good morning')
			: hour < 17
			? __('Good afternoon')
			: __('Good evening')
	const name = userName.value.trim().split(/\s+/)[0]
	return name ? __('{0}, {1}', [hello, name]) : hello
})

const topLinks = [
	{ label: __('Home'), icon: 'lucide-home', active: true },
	{ label: __('Search'), icon: 'lucide-search' },
	{ label: __('Notifications'), icon: 'lucide-bell' },
]

const learnLinks = [
	{ label: __('Courses'), icon: 'lucide-book-open' },
	{ label: __('Programs'), icon: 'lucide-route' },
	{ label: __('Batches'), icon: 'lucide-users' },
	{ label: __('Certifications'), icon: 'lucide-graduation-cap' },
	{ label: __('Jobs'), icon: 'lucide-briefcase' },
]

const items = [
	{
		kind: __('Course'),
		theme: 'blue',
		title: __('Onboarding for new hires'),
		meta: __('3 of 5 done, 4 min left'),
	},
	{
		kind: __('Course'),
		theme: 'blue',
		title: __('Customer support basics'),
		meta: __('Chapter 2 of 6'),
	},
	{
		kind: __('Batch'),
		theme: 'amber',
		title: __('New manager programme'),
		meta: __('Next live class Tuesday'),
	},
]
</script>
