<template>
	<svg
		v-if="who === 'lumi'"
		viewBox="0 0 120 120"
		role="img"
		:aria-label="__('Lumi')"
	>
		<g :transform="`rotate(${lumi.tilt} 60 70)`">
			<g :transform="`translate(60 20) scale(${lumi.spark})`">
				<circle r="11" :fill="LUMI_COLORS.glow" opacity=".28" />
				<path
					d="M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z"
					:fill="LUMI_COLORS.glow"
				/>
			</g>
			<path
				d="M60 32 C86 32 100 52 100 72 C100 94 82 106 60 106 C38 106 20 94 20 72 C20 52 34 32 60 32 Z"
				:fill="LUMI_COLORS.body"
			/>
			<ellipse
				cx="60"
				cy="68"
				rx="30"
				ry="25"
				:fill="LUMI_COLORS.face"
				opacity=".92"
			/>
			<circle cx="38" cy="73" r="5" :fill="LUMI_COLORS.cheek" opacity=".55" />
			<circle cx="82" cy="73" r="5" :fill="LUMI_COLORS.cheek" opacity=".55" />
			<g v-if="lumi.eyes === 'open' || lumi.eyes === 'side'">
				<circle
					:cx="lumi.eyes === 'side' ? 49 : 46"
					cy="62"
					r="5"
					:fill="LUMI_COLORS.ink"
				/>
				<circle
					:cx="lumi.eyes === 'side' ? 77 : 74"
					cy="62"
					r="5"
					:fill="LUMI_COLORS.ink"
				/>
				<circle
					:cx="lumi.eyes === 'side' ? 50.6 : 47.6"
					cy="60.4"
					r="1.6"
					:fill="LUMI_COLORS.face"
				/>
				<circle
					:cx="lumi.eyes === 'side' ? 78.6 : 75.6"
					cy="60.4"
					r="1.6"
					:fill="LUMI_COLORS.face"
				/>
			</g>
			<g
				v-else
				:stroke="LUMI_COLORS.ink"
				stroke-width="3.4"
				fill="none"
				stroke-linecap="round"
			>
				<path
					:d="lumi.eyes === 'arc' ? 'M40 63 q6 -8 12 0' : 'M41 62 q5 4 10 0'"
				/>
				<path
					:d="lumi.eyes === 'arc' ? 'M68 63 q6 -8 12 0' : 'M69 62 q5 4 10 0'"
				/>
			</g>
			<path
				v-if="lumi.mouth === 'grin'"
				d="M50 74 q10 12 20 0 z"
				:fill="LUMI_COLORS.ink"
			/>
			<ellipse
				v-else-if="lumi.mouth === 'o'"
				cx="60"
				cy="77"
				rx="4"
				ry="5"
				:fill="LUMI_COLORS.ink"
			/>
			<path
				v-else-if="lumi.mouth === 'flat'"
				d="M54 77 h12"
				:stroke="LUMI_COLORS.ink"
				stroke-width="3"
				stroke-linecap="round"
			/>
			<path
				v-else
				d="M52 76 q8 7 16 0"
				:stroke="LUMI_COLORS.ink"
				stroke-width="3"
				fill="none"
				stroke-linecap="round"
			/>
			<path
				v-if="mood === 'curious'"
				d="M68 51 q6 -4 12 0"
				:stroke="LUMI_COLORS.ink"
				stroke-width="2.6"
				fill="none"
				stroke-linecap="round"
			/>
		</g>
		<g v-if="mood === 'think'" :fill="LUMI_COLORS.ink" opacity=".4">
			<circle cx="92" cy="40" r="2.6" />
			<circle cx="99" cy="33" r="3.2" />
			<circle cx="107" cy="25" r="3.8" />
		</g>
	</svg>

	<svg v-else-if="look" viewBox="0 0 120 120" role="img" :aria-label="label">
		<circle cx="60" cy="60" r="58" :fill="look.bg" />
		<path
			d="M24 120 C26 98 42 90 60 90 C78 90 94 98 96 120 Z"
			:fill="look.shirt"
		/>
		<rect x="53" y="80" width="14" height="14" rx="4" :fill="look.skin" />
		<ellipse cx="60" cy="62" rx="26" ry="28" :fill="look.skin" />
		<g :fill="look.hair">
			<path
				v-if="look.hairStyle === 'short'"
				d="M34 46 C34 28 86 28 86 46 L86 52 C78 42 42 42 34 52 Z"
			/>
			<template v-else-if="look.hairStyle === 'bun'">
				<circle cx="60" cy="22" r="10" />
				<path d="M32 54 C30 30 90 30 88 54 C80 40 40 40 32 54 Z" />
			</template>
			<path
				v-else-if="look.hairStyle === 'side'"
				d="M33 50 C32 30 88 28 87 48 C70 36 52 44 33 50 Z"
			/>
			<template v-else-if="look.hairStyle === 'curls'">
				<circle cx="38" cy="40" r="11" />
				<circle cx="52" cy="31" r="12" />
				<circle cx="68" cy="31" r="12" />
				<circle cx="82" cy="40" r="11" />
				<circle cx="32" cy="54" r="9" />
				<circle cx="88" cy="54" r="9" />
			</template>
			<template v-else>
				<path
					d="M34 50 C34 30 60 22 80 28 C92 32 88 44 86 50 C76 38 48 38 34 50 Z"
				/>
				<path d="M58 26 C66 16 80 18 82 26 Z" />
			</template>
			<path
				v-if="look.beard"
				d="M40 70 C42 90 78 90 80 70 C74 82 46 82 40 70 Z"
				opacity=".85"
			/>
		</g>
		<g :fill="LUMI_COLORS.ink">
			<circle cx="49" cy="62" r="3.2" />
			<circle cx="71" cy="62" r="3.2" />
		</g>
		<g
			v-if="look.glasses"
			:stroke="LUMI_COLORS.ink"
			stroke-width="2"
			fill="none"
		>
			<circle cx="49" cy="62" r="7" />
			<circle cx="71" cy="62" r="7" />
			<path d="M56 62 h8" />
		</g>
		<g
			:stroke="LUMI_COLORS.ink"
			stroke-width="2.6"
			fill="none"
			stroke-linecap="round"
		>
			<path :d="BROWS[look.brows][0]" />
			<path :d="BROWS[look.brows][1]" />
			<path v-if="look.mouth === 'flat'" d="M54 76 h12" />
			<path v-else-if="look.mouth === 'small'" d="M56 76 q4 2 8 0" />
			<path v-else-if="look.mouth === 'smirk'" d="M53 76 q8 3 14 -3" />
		</g>
		<path
			v-if="look.mouth === 'grin'"
			d="M50 73 q10 11 20 0 z"
			:fill="LUMI_COLORS.ink"
		/>
	</svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
	CAST_LOOKS,
	LUMI_COLORS,
	isCastKey,
	type CharacterKey,
	type LumiMood,
} from '@/utils/characters'

const props = withDefaults(
	defineProps<{ who: CharacterKey; mood?: LumiMood; label?: string }>(),
	{
		mood: 'calm',
		label: '',
	}
)

const MOODS: Record<
	LumiMood,
	{
		eyes: 'open' | 'arc' | 'soft' | 'side'
		mouth: 'smile' | 'grin' | 'o' | 'flat'
		spark: number
		tilt: number
	}
> = {
	calm: { eyes: 'open', mouth: 'smile', spark: 1, tilt: 0 },
	curious: { eyes: 'open', mouth: 'o', spark: 1.25, tilt: -6 },
	happy: { eyes: 'arc', mouth: 'grin', spark: 1.4, tilt: 0 },
	kind: { eyes: 'soft', mouth: 'smile', spark: 1, tilt: 6 },
	think: { eyes: 'side', mouth: 'flat', spark: 0.8, tilt: -3 },
}

const BROWS: Record<string, [string, string]> = {
	down: ['M43 52 L54 55', 'M77 52 L66 55'],
	up: ['M43 53 q5 -4 10 -1', 'M67 52 q5 -3 10 1'],
	flat: ['M43 53 h11', 'M66 53 h11'],
	one: ['M43 54 h11', 'M66 52 q5 -4 11 -1'],
}

const lumi = computed(() => MOODS[props.mood] || MOODS.calm)
const look = computed(() =>
	isCastKey(props.who) ? CAST_LOOKS[props.who] : null
)
</script>
