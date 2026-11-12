/**
 * Lumi, the tutor, and the role-play cast: how each one looks and sounds. The keys match
 * lms/lms/ai/characters.py, where their names and personalities live.
 */

export const TUTOR_NAME = 'Lumi'

export type CastKey = 'brannoc' | 'quilla' | 'fenwick' | 'odalie' | 'tavish'
export type CharacterKey = 'lumi' | CastKey
export type LumiMood = 'calm' | 'curious' | 'happy' | 'kind' | 'think'

export interface CastLook {
	bg: string
	skin: string
	hair: string
	shirt: string
	hairStyle: 'short' | 'bun' | 'side' | 'curls' | 'quiff'
	brows: 'down' | 'up' | 'flat' | 'one'
	mouth: 'flat' | 'small' | 'grin' | 'smirk'
	beard?: boolean
	glasses?: boolean
}

// token-exempt-start: illustration palette, kept the same in both themes like course card art
export const LUMI_COLORS = {
	body: '#1f9d74',
	face: '#ffffff',
	glow: '#ffd36b',
	cheek: '#ff9f8f',
	ink: '#1a1a1a',
}

export const CAST_LOOKS: Record<CastKey, CastLook> = {
	brannoc: { bg: '#f3c9a8', skin: '#8d5a3b', hair: '#2b1d16', shirt: '#3b4a6b', hairStyle: 'short', brows: 'down', mouth: 'flat', beard: true },
	quilla: { bg: '#cfe3f7', skin: '#f1c7a3', hair: '#5a3a2a', shirt: '#8fb7a5', hairStyle: 'bun', brows: 'up', mouth: 'small' },
	fenwick: { bg: '#e4e0f5', skin: '#e8b48a', hair: '#9a9a9a', shirt: '#4d5560', hairStyle: 'side', brows: 'flat', mouth: 'flat', glasses: true },
	odalie: { bg: '#ffe2b8', skin: '#5e3b28', hair: '#1c1410', shirt: '#d9745b', hairStyle: 'curls', brows: 'up', mouth: 'grin' },
	tavish: { bg: '#d6efe4', skin: '#c99772', hair: '#3a2a20', shirt: '#2f2f38', hairStyle: 'quiff', brows: 'one', mouth: 'smirk' },
}
// token-exempt-end

export interface VoiceProfile {
	/** Which group of browser voices to draw from. */
	family: 'female' | 'male'
	/** Characters in the same family take different voices by slot, so no two sound alike. */
	slot: number
	pitch: number
	rate: number
}

export const VOICES: Record<CharacterKey, VoiceProfile> = {
	lumi: { family: 'female', slot: 0, pitch: 1.05, rate: 0.98 },
	quilla: { family: 'female', slot: 1, pitch: 1.12, rate: 0.92 },
	odalie: { family: 'female', slot: 2, pitch: 1.04, rate: 1.1 },
	brannoc: { family: 'male', slot: 0, pitch: 0.82, rate: 1.08 },
	fenwick: { family: 'male', slot: 1, pitch: 0.95, rate: 0.94 },
	tavish: { family: 'male', slot: 2, pitch: 1.0, rate: 1.03 },
}

export const isCastKey = (value: unknown): value is CastKey =>
	typeof value === 'string' && value in CAST_LOOKS
