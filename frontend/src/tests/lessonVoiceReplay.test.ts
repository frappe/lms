/**
 * A whole spoken lesson replayed through the real chat, turn by turn, with the shape of a real
 * session that went wrong: a reply held to one question, replies after hidden exercise answers,
 * a turn that ends on an empty message after its exercise, two exercises shown in one turn (one
 * a near-copy of the other), and a last turn that asked nothing.
 *
 * FlowChat and useFlowChat run for real: how rows become messages, the voice feed, which
 * exercise the stage shows, the turn check and pause. Only the transport (Flow's log and its
 * socket events), the voice and the microphone are stand-ins that record what they were asked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

type Moment = { id: string; moment: Record<string, unknown> }
type Reply = { text: string; moments?: Moment[] }
type Turn = {
	learner: string | null
	replies: Reply[]
	/** What the server's one-question check made of a reply. */
	shown?: Record<string, string>
	stalled?: boolean
}

// Flow's log for one session, and the socket that streams it.
const flow = vi.hoisted(() => ({
	rows: [] as Record<string, unknown>[],
	seq: 0,
	running: false,
	handlers: {} as Record<string, (event: unknown) => void>,
	sent: [] as string[],
	shown: {} as Record<string, string>,
	stalled: false,
}))
const voice = vi.hoisted(() => ({ said: [] as string[], listen: null as null | ((text: string) => void) }))

vi.mock('frappe-ui', () => {
	const stub = (name: string) =>
		defineComponent({ name, setup: (_, { slots }) => () => h('div', slots.default?.()) })
	return {
		Avatar: stub('Avatar'),
		Button: defineComponent({
			name: 'Button',
			props: ['ariaLabel'],
			emits: ['click'],
			setup: (props, { emit, slots }) => () =>
				h('button', { 'aria-label': props.ariaLabel, onClick: () => emit('click') }, slots.default?.()),
		}),
		ErrorMessage: stub('ErrorMessage'),
		TabButtons: stub('TabButtons'),
		Textarea: stub('Textarea'),
		call: vi.fn(async (method: string, args: Record<string, any>) => {
			if (method === 'frappe.flow.api.api.entries')
				return {
					entries: flow.rows.filter((row) => (row.seq as number) > (args.since || 0)),
					running: flow.running,
				}
			if (method === 'lms.lms.ai.api.checked_turn')
				return { shown: flow.shown, stalled: flow.stalled }
			if (method === 'lms.lms.ai.api.lesson_reply') {
				flow.sent.push(args.message)
				flow.running = true
				row({ type: 'user_message', content: args.message })
				return {}
			}
			return null
		}),
	}
})
vi.mock('@/composables/useSpeech', async () => {
	const { ref } = await import('vue')
	const actual = await vi.importActual<typeof import('@/composables/useSpeech')>(
		'@/composables/useSpeech'
	)
	return {
		...actual,
		useSpeech: () => ({
			speaking: ref(false),
			caption: ref(''),
			remaining: ref(0),
			enqueue: (text: string) => voice.said.push(text),
			stop: vi.fn(),
		}),
	}
})
vi.mock('@/composables/useVoice', async () => {
	const { ref } = await import('vue')
	return {
		preferredMode: () => 'speak',
		rememberMode: vi.fn(),
		setTranscribeSession: vi.fn(),
		useVoice: () => ({
			canListen: true,
			listening: ref(false),
			transcribing: ref(false),
			transcript: ref(''),
			error: ref(null),
			listen: (cb: (text: string) => void) => {
				voice.listen = cb
			},
			stopListening: vi.fn(),
		}),
	}
})
vi.mock('@/utils/dayjs', () => ({ default: () => ({ format: () => '' }) }))

/** A row in Flow's log, as the entries call and the socket both carry it. */
function row(fields: Record<string, unknown>) {
	const entry = { ...fields, seq: ++flow.seq, session_id: 'S1' }
	flow.rows.push(entry)
	return entry
}
const emit = (event: Record<string, unknown>) =>
	flow.handlers['flow:event']?.({ session_id: 'S1', ...event })

const socket = {
	on: (name: string, handler: (event: unknown) => void) => {
		flow.handlers[name] = handler
	},
	off: vi.fn(),
	emit: (name: string, _session: string, ack?: (r: unknown) => void) => {
		if (name === 'flow:subscribe') ack?.({ subscribed: true })
	},
}

const VoiceStage = defineComponent({
	name: 'VoiceStage',
	props: ['moment', 'result'],
	emits: ['answer'],
	setup: (props) => () => h('div', { 'data-moment': props.moment?.id ?? '' }),
})

const exercise = (id: string, prompt: string): Moment => ({
	id,
	moment: { kind: 'spot', prompt, segments: [{ text: 'A', is_issue: true }] },
})

const OPENING =
	"Hello Asha, lovely to meet you. I'm Lumi, your tutor. Where does safety show up in your work, and who checks it?"
const LESSON: Turn[] = [
	{
		learner: 'I work on the warehouse floor and lift boxes all day',
		replies: [
			{
				text: 'Good, the warehouse floor gives us a real starting point. Lifting is where most strains happen. Are you ready to try a few quick exercises?',
			},
		],
	},
	{
		learner: "yes, let's go ahead",
		replies: [{ text: '', moments: [exercise('m1', 'Pick the safe lift.')] }],
	},
	{
		learner: 'answer:m1',
		replies: [
			{
				text: "Spot on, you picked the safe lift. Now, which of these is a warning sign?",
				moments: [exercise('m2', 'Tap the hazards.')],
			},
			{ text: '', moments: [exercise('m3', 'Tap the hazards.')] },
		],
	},
	{
		learner: 'answer:m3',
		replies: [{ text: 'Right, you caught all three hazards.', moments: [exercise('m4', 'Put the steps in order.')] }],
	},
	{
		learner: 'answer:m4',
		replies: [{ text: 'You got the first two steps down. Report it before you fix it [Safety Manual · p.12].' }],
		stalled: true,
	},
]

/** The server writing one turn, as Flow streams it: deltas, then each saved message and the
 * results of its tool calls, then an empty closing message after an exercise. */
async function serverTurn(turn: Turn) {
	flow.shown = turn.shown ?? {}
	flow.stalled = !!turn.stalled
	emit({ type: 'run_started' })
	await flushPromises()
	for (const reply of turn.replies) {
		for (let i = 0; i < reply.text.length; i += 11) {
			emit({ type: 'text_delta', text: reply.text.slice(i, i + 11) })
			await flushPromises()
		}
		const content: Record<string, unknown>[] = []
		if (reply.text) content.push({ type: 'text', text: reply.text })
		for (const m of reply.moments ?? [])
			content.push({ type: 'tool_call', id: m.id, name: 'lms__show_moment', arguments: { moment: m.moment } })
		emit(row({ type: 'assistant_message', content }))
		for (const m of reply.moments ?? [])
			emit(row({ type: 'tool_result', tool_call_id: m.id, content: 'Shown to the learner.' }))
		await flushPromises()
	}
	if (turn.replies.some((reply) => reply.moments?.length))
		emit(row({ type: 'assistant_message', content: [] }))
	flow.running = false
	emit({ type: 'run_ended' })
	await flushPromises()
}

async function learnerTurn(wrapper: ReturnType<typeof mount>, learner: string) {
	if (learner.startsWith('answer:')) {
		wrapper.findComponent(VoiceStage).vm.$emit('answer', { id: learner.slice(7), correct: true })
	} else {
		expect(voice.listen, "the microphone opens when it is the learner's turn").toBeTruthy()
		voice.listen!(learner)
	}
	voice.listen = null
	await flushPromises()
}

async function openLesson(opening = OPENING, shown: Record<string, string> = {}) {
	row({ type: 'user_message', content: 'BRIEF {}' })
	row({ type: 'assistant_message', content: [{ type: 'text', text: opening }] })
	flow.shown = shown
	const { default: FlowChat } = await import('@/components/Goals/FlowChat.vue')
	const wrapper = mount(FlowChat, {
		props: {
			session: 'S1',
			voice: true,
			character: 'lumi',
			oneQuestion: true,
			hideFirstMessage: true,
			assistantName: 'Lumi',
			runMethod: 'lms.lms.ai.api.lesson_reply',
		},
		global: {
			stubs: { VoiceStage },
			mocks: { __: (globalThis as any).__ },
			provide: { $socket: socket },
		},
	})
	mounted.push(wrapper)
	await flushPromises()
	return wrapper
}
const mounted: ReturnType<typeof mount>[] = []

const stageMoment = (wrapper: ReturnType<typeof mount>) =>
	wrapper.find('[data-moment]').attributes('data-moment')

const sentences = (said: string[]) =>
	said
		.join(' ')
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter(Boolean)

afterEach(() => {
	mounted.splice(0).forEach((wrapper) => wrapper.unmount())
	flow.rows = []
	flow.seq = 0
	flow.running = false
	flow.stalled = false
	flow.shown = {}
	flow.sent = []
	flow.handlers = {}
	voice.said = []
	voice.listen = null
})

describe('a spoken lesson, replayed', () => {
	it('says every sentence of each turn once, shows only the newest exercise and nudges a dead end', async () => {
		const wrapper = await openLesson(OPENING, {
			[OPENING]: "Hello Asha, lovely to meet you. I'm Lumi, your tutor. Where does safety show up in your work?",
		})
		expect(sentences(voice.said)).toEqual([
			'Hello Asha, lovely to meet you.',
			"I'm Lumi, your tutor.",
			'Where does safety show up in your work?',
		])

		for (const [i, turn] of LESSON.entries()) {
			voice.said = []
			await learnerTurn(wrapper, turn.learner!)
			await serverTurn(turn)

			const said = sentences(voice.said)
			expect(new Set(said).size, `turn ${i + 1} said a sentence twice: ${said.join(' | ')}`).toBe(
				said.length
			)
			const written = turn.replies
				.map((reply) => reply.text)
				.filter(Boolean)
				.join(' ')
				.replace(/ \[[^\]]*\]/g, '')
			expect(said.join(' '), `turn ${i + 1} said something other than what was written`).toBe(written)
		}

		// Turn 3 showed two exercises and the learner answered the newer one. The older one was
		// replaced before it was answered, so it never comes back.
		const answers = flow.sent.filter((text) => text.startsWith('MOMENT_RESULT'))
		expect(answers.map((text) => JSON.parse(text.slice('MOMENT_RESULT '.length)).id)).toEqual([
			'm1',
			'm3',
			'm4',
		])
		// The last turn asked nothing and showed nothing: the tutor is nudged once to carry on.
		expect(flow.sent.filter((text) => text === 'KEEP_GOING')).toHaveLength(1)
		// The answered exercise stays up, marked, while the nudged turn is still being written.
		expect(stageMoment(wrapper)).toBe('m4')
		// Hidden messages stay hidden.
		expect(wrapper.text()).not.toContain('MOMENT_RESULT')
		expect(wrapper.text()).not.toContain('KEEP_GOING')
	})

	it('never brings back an older unanswered exercise once a newer one is answered', async () => {
		const wrapper = await openLesson('Ready for an exercise?')
		await learnerTurn(wrapper, 'yes I am ready to try one now')
		await serverTurn({
			learner: null,
			replies: [
				{ text: 'Look at the signs.', moments: [exercise('m2', 'Tap the hazards.')] },
				{ text: '', moments: [exercise('m3', 'Tap the hazards.')] },
			],
		})
		expect(stageMoment(wrapper)).toBe('m3')

		// Answered, it stays up while the tutor reacts, and the older copy never takes its place.
		await learnerTurn(wrapper, 'answer:m3')
		expect(stageMoment(wrapper)).toBe('m3')
		await serverTurn({ learner: null, replies: [{ text: 'Right. What do you do next?' }] })
		expect(stageMoment(wrapper)).toBe('')
	})

	it('says the question as soon as it is written, not after the turn ends and is checked', async () => {
		const wrapper = await openLesson('Where do you work?')
		await learnerTurn(wrapper, 'In the warehouse, lifting boxes most days')
		voice.said = []
		emit({ type: 'run_started' })
		const reply = 'Good. Which lift do you do most, and how heavy is it? Take a guess.'
		for (let i = 0; i < reply.length; i += 7) {
			emit({ type: 'text_delta', text: reply.slice(i, i + 7) })
			await flushPromises()
		}
		// Still running: no saved message, no check yet.
		expect(sentences(voice.said)).toEqual(['Good.', 'Which lift do you do most?'])

		emit(row({ type: 'assistant_message', content: [{ type: 'text', text: reply }] }))
		flow.running = false
		emit({ type: 'run_ended' })
		await flushPromises()
		expect(sentences(voice.said)).toEqual(['Good.', 'Which lift do you do most?'])
		expect(wrapper.text()).not.toContain('how heavy')
	})

	it('brings back an exercise still waiting for its answer when the lesson is reopened', async () => {
		row({ type: 'user_message', content: 'BRIEF {}' })
		row({ type: 'assistant_message', content: [{ type: 'text', text: 'Ready for an exercise?' }] })
		row({ type: 'user_message', content: 'yes' })
		const m = exercise('m9', 'Tap the hazards.')
		row({
			type: 'assistant_message',
			content: [{ type: 'tool_call', id: 'm9', name: 'lms__show_moment', arguments: { moment: m.moment } }],
		})
		row({ type: 'tool_result', tool_call_id: 'm9', content: 'Shown to the learner.' })
		row({ type: 'assistant_message', content: [] })
		const { default: FlowChat } = await import('@/components/Goals/FlowChat.vue')
		const wrapper = mount(FlowChat, {
			props: { session: 'S1', voice: true, character: 'lumi', oneQuestion: true, hideFirstMessage: true, runMethod: 'lms.lms.ai.api.lesson_reply' },
			global: { stubs: { VoiceStage }, mocks: { __: (globalThis as any).__ }, provide: { $socket: socket } },
		})
		mounted.push(wrapper)
		await flushPromises()

		expect(stageMoment(wrapper)).toBe('m9')
		expect(voice.listen, 'the microphone waits while an exercise is up').toBeNull()
	})

	it('ends a pause when the learner answers an exercise, so they hear the reaction', async () => {
		const wrapper = await openLesson('Ready for an exercise?')
		await learnerTurn(wrapper, 'yes I am ready to try one now')
		// Paused while the tutor is still writing; the exercise comes up during the pause.
		await wrapper.find('button[aria-label]').trigger('click')
		await serverTurn({ learner: null, replies: [{ text: '', moments: [exercise('m5', 'Tap the hazards.')] }] })
		expect(stageMoment(wrapper)).toBe('m5')
		voice.said = []

		await learnerTurn(wrapper, 'answer:m5')
		await serverTurn({ learner: null, replies: [{ text: 'Spot on. What do you do next?' }] })
		expect(sentences(voice.said)).toEqual(['Spot on.', 'What do you do next?'])
	})

	it('stays silent while paused and says what arrived meanwhile once resumed', async () => {
		const wrapper = await openLesson('Where do you work?')
		await learnerTurn(wrapper, 'In the warehouse, lifting boxes most days')
		voice.said = []

		const pause = wrapper.find('button[aria-label]')
		await pause.trigger('click')
		await serverTurn({ learner: null, replies: [{ text: 'Good. Lifting is where strains happen.' }] })
		expect(voice.said).toEqual([])

		await pause.trigger('click')
		expect(sentences(voice.said)).toEqual(['Good.', 'Lifting is where strains happen.'])
	})
})
