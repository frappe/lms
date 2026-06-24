<template>
	<Dialog v-model:open="showDialog">
		<template #title>
			<h2 class="text-xl-bold">{{ __('Install Frappe Learning') }}</h2>
		</template>
		<template #default>
			<p>
				{{
					__(
						'Get the app on your device for easy access & a better experience!'
					)
				}}
			</p>
		</template>
		<template #actions>
			<Button variant="solid" class="w-full py-5" @click="install">
				<template #prefix><span class="lucide-download size-4" /></template>
				{{ __('Install') }}
			</Button>
		</template>
	</Dialog>

	<Popover :show="iosInstallMessage" placement="top-start">
		<template #body>
			<div
				class="fixed top-[20rem] translate-x-1/3 z-20 flex flex-col gap-3 rounded bg-surface-base py-5 drop-shadow-xl"
			>
				<div
					class="mb-1 flex flex-row items-center justify-between px-3 text-center"
				>
					<span class="text-base-bold text-ink-gray-9">
						{{ __('Install Frappe Learning') }}
					</span>
					<span class="inline-flex items-baseline">
						<span
							class="lucide-x ms-auto size-4 text-ink-gray-7"
							@click="iosInstallMessage = false"
						/>
					</span>
				</div>
				<div class="px-3 text-xs text-ink-gray-8">
					<span class="flex flex-col gap-2">
						<span class="leading-5">
							{{
								__(
									'Get the app on your iPhone for easy access & a better experience'
								)
							}}
						</span>
						<span class="inline-flex items-start whitespace-nowrap">
							<span>{{ __('Tap') }}&nbsp;</span>
							<span class="lucide-share size-4 text-blue-600" />
							<span>&nbsp;{{ __("and then 'Add to Home Screen'") }}</span>
						</span>
					</span>
				</div>
			</div>
		</template>
	</Popover>
</template>

<script setup>
import { ref } from 'vue'
import { Button, Dialog, Popover } from 'frappe-ui'

const deferredPrompt = ref(null)
const showDialog = ref(false)
const iosInstallMessage = ref(false)

const isIos = () => {
	const userAgent = window.navigator.userAgent.toLowerCase()
	return /iphone|ipad|ipod/.test(userAgent)
}

const isInStandaloneMode = () =>
	'standalone' in window.navigator && window.navigator.standalone

if (
	isIos() &&
	!isInStandaloneMode() &&
	localStorage.getItem('learningIosInstallPromptShown') !== 'true'
) {
	iosInstallMessage.value = true
	localStorage.setItem('learningIosInstallPromptShown', 'true')
}

window.addEventListener('beforeinstallprompt', (e) => {
	e.preventDefault()
	deferredPrompt.value = e
	if (isIos() && !isInStandaloneMode()) iosInstallMessage.value = true
	else showDialog.value = true
})

window.addEventListener('appinstalled', () => {
	showDialog.value = false
	deferredPrompt.value = null
})

const install = () => {
	deferredPrompt.value.prompt()
	showDialog.value = false
}
</script>
