<template>
	<Popover transition="default">
		<template #target="{ isOpen, togglePopover }" class="flex w-full">
			<slot v-bind="{ isOpen, togglePopover }"></slot>
		</template>
		<template #body>
			<div
				class="absolute left-0 mt-3 w-[35rem] max-w-lg -translate-x-1/2 transform rounded-lg bg-white px-4 sm:px-0 lg:max-w-3xl"
			>
				<div
					class="overflow-hidden rounded-lg p-3 shadow-2xl ring-1 ring-black ring-opacity-5"
				>
					<video
						controls
						autoplay
						muted
						width="100%"
						controlsList="nodownload"
						oncontextmenu="return false;"
						class="rounded-sm"
					>
						<source src="/Youtube.mov" type="video/mp4" />
					</video>
				</div>
			</div>
		</template>
	</Popover>
</template>
<script setup>
import { Popover } from 'frappe-ui'
</script>
