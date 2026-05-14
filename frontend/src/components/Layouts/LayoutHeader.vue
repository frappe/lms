<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<div class="flex items-center gap-2">
			<slot name="left-header" />
		</div>
		<div class="flex items-center gap-2">
			<slot name="right-header" />
		</div>
	</header>
</template>
