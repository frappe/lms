<template>
	<HoverCard side="right" align="start" class="flex w-full">
		<template #trigger>
			<button
				:class="[
					'group w-full flex h-7 items-center justify-between rounded px-2 text-base text-ink-gray-7 hover:bg-surface-gray-2',
				]"
			>
				<div class="flex gap-2">
					<span class="lucide-layout-grid size-4" />
					<span class="whitespace-nowrap">
						{{ __('Apps') }}
					</span>
				</div>
				<span class="lucide-chevron-right h-4 w-4" />
			</button>
		</template>
		<template #default>
			<div class="grid grid-cols-3 justify-between">
				<div v-for="app in apps.data" key="name">
					<a
						:href="app.route"
						class="flex flex-col gap-1.5 rounded justify-center items-center py-2 px-3 hover:bg-surface-gray-2"
					>
						<img class="size-8" :src="app.logo" />
						<div class="text-sm text-ink-gray-7" @click="app.onClick">
							{{ app.title }}
						</div>
					</a>
				</div>
			</div>
		</template>
	</HoverCard>
</template>
<script setup>
import { HoverCard, createResource } from 'frappe-ui'

const apps = createResource({
	url: 'frappe.apps.get_apps',
	cache: 'apps',
	auto: true,
	transform: (data) => {
		let _apps = [
			{
				name: 'frappe',
				logo: '/assets/lms/images/desk.png',
				title: __('Desk'),
				route: '/desk/learning',
			},
		]
		data.map((app) => {
			if (app.name === 'lms') return
			_apps.push({
				name: app.name,
				logo: app.logo,
				title: __(app.title),
				route: app.route,
			})
		})
		return _apps
	},
})
</script>
