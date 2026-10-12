<template>
	<SettingsRowGroup
		v-for="group in groups"
		:key="group.key"
		:label="group.label ? __(group.label) : undefined"
	>
		<SettingsRow
			v-for="row in group.rows"
			:key="row.key"
			:label="__(row.label)"
			:icon="row.icon"
			:description="row.description"
			:value="row.value"
			:href="safeUrl(row.href)"
			:navigates="Boolean(row.to || row.action)"
			:chevron="Boolean(row.to || row.href)"
			@click="activate(row)"
		>
			<template v-if="row.selected" #control>
				<span
					data-testid="row-selected"
					class="lucide-check size-4.5 shrink-0 text-ink-gray-8"
				/>
			</template>
		</SettingsRow>
	</SettingsRowGroup>
</template>

<script setup lang="ts">
// The only component that knows how a settings row is drawn. A row either
// navigates (`to`), reports a choice (`action`, emitted upward), or is an
// external `href` drawn as a real <a> and left for the browser to follow.
import { useRouter } from 'vue-router'
import { safeUrl } from '@/utils/safeUrl'
import SettingsRow from '@/components/Layouts/settings/mobile/SettingsRow.vue'
import SettingsRowGroup from '@/components/Layouts/settings/mobile/SettingsRowGroup.vue'
import type {
	MobileRow,
	MobileRowGroup,
} from '@/components/Settings/Mobile/mobileRows'

defineProps<{ groups: MobileRowGroup[] }>()

const emit = defineEmits<{ action: [value: string] }>()

const router = useRouter()

const activate = (row: MobileRow): void => {
	if (row.to) router.push(row.to)
	else if (row.action) emit('action', row.action)
}
</script>
