<template>
	<label
		class="flex w-full min-w-0 cursor-pointer items-center gap-x-2.5 rounded-6 border border-outline-gray-2 px-3 py-2.5 hover:bg-surface-gray-1 focus-within:border-outline-gray-4"
	>
		<slot name="control" />
		<span
			class="min-w-0 flex-1 break-words text-p-base text-ink-gray-8 [&_img]:h-auto [&_img]:max-w-full"
		>
			<slot />
		</span>
		<slot name="end" />
	</label>
</template>
