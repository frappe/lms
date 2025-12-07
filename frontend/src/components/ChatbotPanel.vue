<template>
  <div class="rounded-md border bg-white">
    <div class="flex items-center justify-between border-b px-3 py-2">
      <div class="text-sm font-semibold text-ink-gray-9">Assistant</div>
      <div class="text-[11px] text-ink-gray-5 flex gap-2 items-center">
        <span v-if="limitsDisplay">{{ limitsDisplay }}</span>
        <span v-else>Lesson-aware (MVP)</span>
      </div>
    </div>
    <div ref="scrollEl" class="max-h-96 overflow-y-auto p-3 space-y-3">
      <div v-for="(m, i) in messages" :key="i" class="flex flex-col" :class="m.role === 'user' ? 'items-end' : 'items-start'">
        <div class="rounded-md px-3 py-2 text-sm"
             :class="[
               m.role === 'user' ? 'bg-surface-gray-2 text-ink-gray-9' : 'bg-surface-menu-bar text-ink-gray-8',
               m.role === 'user' ? 'whitespace-pre-wrap' : ''
             ]">
          <div v-if="m.role === 'assistant'" 
               v-html="formatContent(m.content, m.role)"
               class="markdown-content">
          </div>
          <div v-else class="whitespace-pre-wrap">
            {{ m.content }}
          </div>
        </div>
        <div v-if="m.role === 'assistant' && m.citations && m.citations.length" class="mt-1 text-[10px] text-ink-gray-6">
          Sources:
          <span v-for="(c, idx) in m.citations" :key="idx" class="mr-2">
            [{{ idx + 1 }}] <a :href="c.anchor ? ('#' + c.anchor) : '#'" class="underline" @click.prevent="jumpTo(c.anchor)">{{ c.title }}</a> <span v-if="c.snippet">— {{ c.snippet }}</span>
          </span>
        </div>
      </div>
      <div v-if="loading" class="text-xs text-ink-gray-5">Thinking…</div>
    </div>
    <div class="border-t p-2">
      <div class="flex items-end space-x-2">
        <textarea
          v-model="input"
          class="flex-1 resize-none rounded-md border px-3 py-2 text-sm focus:outline-none"
          rows="2"
          :placeholder="placeholder"
          @keydown.enter.exact.prevent="send"
        />
        <Button size="sm" :disabled="!canSend" @click="send">Send</Button>
      </div>
      <div class="mt-2 flex flex-wrap gap-2">
        <Badge class="cursor-pointer" @click="quick('Summarize this lesson')">Summarize</Badge>
        <Badge class="cursor-pointer" @click="quick('Explain with an example')">Explain</Badge>
        <Badge class="cursor-pointer" @click="quick('Quiz me with 3 questions')">Quiz me</Badge>
      </div>
    </div>
  </div>
  
</template>

<script setup>
import { ref, watch, onMounted, nextTick, computed, inject } from 'vue'
import { Button, Badge, createResource } from 'frappe-ui'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false, // Disable raw HTML for security
  breaks: true, // Convert line breaks to <br>
  linkify: true, // Auto-convert URLs to links
  typographer: true // Enable smart quotes and dashes
})

const props = defineProps({
  course: { type: String, required: true },
  chapter: { type: [String, Number], required: true },
  lesson: { type: [String, Number], required: true },
  lessonTitle: { type: String, default: '' },
  lessonId: { type: String, default: '' },
})

const messages = ref([
  {
    role: 'assistant',
    content: `Hi! I’m your lesson assistant for “${props.lessonTitle || 'this lesson'}”. Ask me to summarize, explain, or quiz you.`,
  },
])
const input = ref('')
const loading = ref(false)
const scrollEl = ref(null)
const sessionName = ref(null)
const user = inject('$user')

const placeholder = computed(() => `Ask about "${props.lessonTitle || 'this lesson'}"…`)
const canSend = computed(() => !loading.value && input.value.trim().length > 0)

// Format content with markdown for assistant messages only
const formatContent = (content, role) => {
  if (role === 'assistant') {
    return md.render(content || '')
  }
  return content || ''
}

const chatReply = createResource({
  url: 'lms.lms.api.chatbot_reply',
  makeParams() {
    return {
      course: props.course,
      chapter: props.chapter,
      lesson: props.lesson,
      messages: messages.value,
      session: sessionName.value,
    }
  },
  onSuccess(data) {
    if (data && data.message) {
      if (useStreaming.value) {
        renderStream(data.message.content)
      } else {
        const msg = { ...data.message }
        if (data.citations) msg.citations = data.citations
        messages.value.push(msg)
      }
      if (data.session) sessionName.value = data.session
      queueScroll()
    }
  },
  onError() {
    messages.value.push({ role: 'assistant', content: 'Sorry, something went wrong. Please try again.' })
  },
  auto: false,
})

const send = async () => {
  if (!canSend.value) return
  const content = input.value.trim()
  input.value = ''
  messages.value.push({ role: 'user', content })
  loading.value = true
  queueScroll()
  try {
    if (useStreaming.value) {
      await streamReply()
    } else {
      await chatReply.submit()
    }
    limits.reload()
  } finally {
    loading.value = false
  }
}

const quick = (prompt) => {
  input.value = prompt
  send()
}

const queueScroll = () => {
  nextTick(() => {
    const el = scrollEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

watch(() => [props.course, props.chapter, props.lesson, props.lessonId], () => {
  // Reload history and reset input on lesson change
  input.value = ''
  history.reload()
})

onMounted(() => {
  queueScroll()
})

// Settings for streaming UX
const modeSetting = createResource({
  url: 'lms.lms.api.get_lms_setting',
  makeParams: () => ({ field: 'assistant_mode' }),
  auto: true,
})
const streamingSetting = createResource({
  url: 'lms.lms.api.get_lms_setting',
  makeParams: () => ({ field: 'assistant_enable_streaming' }),
  auto: true,
})
const mode = computed(() => (modeSetting.data || '').toString())
const streamingEnabled = computed(() => {
  const val = streamingSetting.data
  if (typeof val === 'string') return val === '1' || val.toLowerCase() === 'true'
  if (typeof val === 'number') return val === 1
  if (typeof val === 'boolean') return val
  return false
})
const useStreaming = computed(() => streamingEnabled.value && mode.value.toLowerCase() === 'proxy')

// Limits badge (messages/cost remaining)
const limits = createResource({
  url: 'lms.lms.api.get_assistant_limits',
  makeParams: () => ({ course: props.course }),
  auto: true,
})
const limitsDisplay = computed(() => {
  const l = limits.data || {}
  const parts = []
  if (l.max_messages_per_user_per_day && typeof l.messages_left === 'number') {
    parts.push(`${l.messages_left} msgs left`)
  }
  if (typeof l.cost_left === 'number') {
    const val = Math.max(0, l.cost_left).toFixed(2)
    parts.push(`$${val} left`)
  }
  return parts.length ? parts.join(' • ') : ''
})

// Typewriter streaming render (used when backend returns non-streamed content in Proxy mode)
let streamTimer = null
const renderStream = (text) => {
  const msg = { role: 'assistant', content: '' }
  messages.value.push(msg)
  const chars = Array.from(text || '')
  const chunk = () => {
    if (!chars.length) {
      clearInterval(streamTimer)
      streamTimer = null
      return
    }
    msg.content += chars.shift()
    // Force reactivity
    messages.value = [...messages.value]
    queueScroll()
  }
  // Faster on desktop, slower on mobile could be considered later
  streamTimer = setInterval(chunk, 15)
}

// Real streaming via fetch ReadableStream (SSE)
const streamReply = async () => {
  const url = '/api/method/lms.lms.api.chatbot_reply_stream'
  const body = {
    course: props.course,
    chapter: props.chapter,
    lesson: props.lesson,
    messages: messages.value,
    session: sessionName.value,
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    throw new Error('Streaming request failed')
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  // Create assistant message to append to
  const assistantMsg = { role: 'assistant', content: '', citations: [] }
  messages.value.push(assistantMsg)
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const packet = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      if (packet.startsWith('data: ')) {
        const jsonStr = packet.slice(6)
        if (jsonStr.trim() === '[DONE]') {
          break
        }
        try {
          const obj = JSON.parse(jsonStr)
          if (obj.type === 'meta') {
            if (obj.session) sessionName.value = obj.session
            if (obj.citations) assistantMsg.citations = obj.citations
          }
          const delta = obj?.choices?.[0]?.delta?.content
          if (delta) {
            assistantMsg.content += delta
            // Force update
            messages.value = [...messages.value]
            queueScroll()
          }
        } catch (e) {
          // ignore malformed
        }
      }
    }
  }
}

// History resource (session resume)
const history = createResource({
  url: 'lms.lms.api.get_chat_history',
  makeParams() {
    return {
      course: props.course,
      chapter: props.chapter,
      lesson: props.lesson,
      limit: 40,
    }
  },
  onSuccess(data) {
    if (data?.session) sessionName.value = data.session
    if (Array.isArray(data?.messages) && data.messages.length) {
      messages.value = data.messages
    } else {
      // keep default welcome seeded earlier
      messages.value = [
        {
          role: 'assistant',
          content: `Hi! I’m your lesson assistant for “${props.lessonTitle || 'this lesson'}”. Ask me to summarize, explain, or quiz you.`,
        },
      ]
    }
    queueScroll()
  },
  auto: true,
})
</script>

<style scoped>
.markdown-content {
  line-height: 1.5;
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4,
.markdown-content h5,
.markdown-content h6 {
  font-weight: 600;
  margin: 0.75em 0 0.5em 0;
  line-height: 1.25;
}

.markdown-content h1 { font-size: 1.125em; }
.markdown-content h2 { font-size: 1.1em; }
.markdown-content h3 { font-size: 1.05em; }
.markdown-content h4,
.markdown-content h5,
.markdown-content h6 { font-size: 1em; }

.markdown-content p {
  margin: 0.5em 0;
}

.markdown-content p:first-child {
  margin-top: 0;
}

.markdown-content p:last-child {
  margin-bottom: 0;
}

.markdown-content strong {
  font-weight: 600;
}

.markdown-content em {
  font-style: italic;
}

.markdown-content code {
  background-color: rgba(0, 0, 0, 0.08);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.markdown-content pre {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.75rem;
  border-radius: 0.375rem;
  overflow-x: auto;
  margin: 0.5em 0;
}

.markdown-content pre code {
  background-color: transparent;
  padding: 0;
}

.markdown-content ul,
.markdown-content ol {
  margin: 0.5em 0;
  padding-left: 1.25rem;
}

.markdown-content li {
  margin: 0.25em 0;
}

.markdown-content blockquote {
  border-left: 3px solid rgba(0, 0, 0, 0.1);
  margin: 0.5em 0;
  padding-left: 1rem;
  font-style: italic;
}

.markdown-content a {
  color: #3b82f6;
  text-decoration: underline;
}

.markdown-content a:hover {
  color: #1d4ed8;
}
</style>
