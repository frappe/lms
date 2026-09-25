<template>
	<p v-if="!tests || !tests.total" class="text-p-base text-ink-gray-5">
		{{ __('No test results yet.') }}
	</p>
	<ul v-else class="space-y-2" data-testid="copilot-tests">
		<li
			v-for="(test, index) in tests.results || []"
			:key="index"
			class="flex items-start gap-2 text-p-base"
		>
			<span
				aria-hidden="true"
				class="mt-0.5 size-4 shrink-0"
				:class="
					test.passed
						? 'lucide-circle-check text-ink-green-6'
						: 'lucide-circle-x text-ink-red-6'
				"
			/>
			<span class="sr-only">
				{{ test.passed ? __('Test passed') : __('Test did not pass') }}
			</span>
			<div class="min-w-0">
				<div class="break-words text-ink-gray-9">{{ test.name }}</div>
				<div
					v-if="test.message"
					class="whitespace-pre-wrap break-words text-p-sm text-ink-gray-5"
				>
					{{ test.message }}
				</div>
			</div>
		</li>
	</ul>
</template>

<script setup>
defineProps({
	tests: { type: Object, default: null },
})
</script>
