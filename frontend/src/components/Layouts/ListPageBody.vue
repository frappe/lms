<template>
	<!-- The shell every list page puts under its header. `min-h-0` is what lets
	     the rows inside own the scroll box instead of growing the page: a flex
	     child otherwise refuses to shrink below its content, so the page grows
	     and takes the header with it out of view. Said once here rather than as
	     a breakpoint variant on every list page. -->
	<div class="flex min-h-0 flex-1 flex-col">
		<slot />
		<!-- Sits under the rows, which scroll behind it, rather than at the end
		     of them. shrink-0 so a long list cannot squeeze it away. -->
		<div v-if="$slots.footer" class="shrink-0">
			<slot name="footer" />
		</div>
	</div>
</template>
