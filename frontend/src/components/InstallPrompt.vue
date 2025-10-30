<template>
	<Dialog v-model="showDialog">
		<template #body-title>
			<h2 class="text-lg font-bold">{{ __('Install Frappe Learning') }}</h2>
		</template>
		<template #body-content>
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
				<template #prefix><FeatherIcon name="download" class="w-4" /></template>
				{{ __('Install') }}
			</Button>
		</template>
	</Dialog>

	<Popover :show="iosInstallMessage" placement="top">
		<template #body>
			<div
				class="fixed bottom-[4rem] left-1/2 -translate-x-1/2 z-20 w-[90%] flex flex-col gap-3 rounded bg-blue-100 py-5 drop-shadow-xl"
			>
				<div
					class="mb-1 flex flex-row items-center justify-between px-3 text-center"
				>
					<span class="text-base font-bold text-gray-900">
						{{ __('Install Frappe Learning') }}
					</span>
					<span class="inline-flex items-baseline">
						<FeatherIcon
							name="x"
							class="ml-auto h-4 w-4 text-gray-700"
							@click="iosInstallMessage = false"
						/>
					</span>
				</div>
				<div class="px-3 text-xs text-gray-800">
					<span class="flex flex-col gap-2">
						<span>
							{{
								__(
									'Get the app on your iPhone for easy access & a better experience'
								)
							}}
						</span>
						<span class="inline-flex items-start whitespace-nowrap">
							<span>{{ __('Tap') }}&nbsp;</span>
							<FeatherIcon name="share" class="h-4 w-4 text-blue-600" />
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
import { Button, Dialog, FeatherIcon, Popover } from 'frappe-ui'

const deferredPrompt = ref(null)
const showDialog = ref(false)
const iosInstallMessage = ref(false)

const isIos = () => {
	const userAgent = window.navigator.userAgent.toLowerCase()
	return /iphone|ipad|ipod/.test(userAgent)
}

const isInStandaloneMode = () =>
	'standalone' in window.navigator && window.navigator.standalone

if (isIos() && !isInStandaloneMode()) iosInstallMessage.value = true

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
