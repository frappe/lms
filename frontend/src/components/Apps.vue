<template>
	<Popover placement="right-start" class="flex w-full">
		<template #target="{ togglePopover }">
			<button
				:class="[
					'group w-full flex h-7 items-center justify-between rounded px-2 text-base text-ink-gray-7 hover:bg-surface-gray-2',
				]"
				@click.prevent="togglePopover()"
			>
				<div class="flex gap-2">
					<LayoutGrid class="size-4 stroke-1.5" />
					<span class="whitespace-nowrap">
						{{ __('Apps') }}
					</span>
				</div>
				<ChevronRight class="h-4 w-4 stroke-1.5" />
			</button>
		</template>
		<template #body>
			<div
				class="grid grid-cols-3 justify-between mx-3 p-2 rounded-lg border border-gray-100 bg-surface-white shadow-xl"
			>
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
	</Popover>
</template>
<script setup>
import { Popover, createResource } from 'frappe-ui'
import { LayoutGrid, ChevronRight } from 'lucide-vue-next'

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
				route: '/app',
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
