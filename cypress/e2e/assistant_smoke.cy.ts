// Basic UI smoke tests for the in-lesson Assistant and LessonForm actions.

describe('In-Lesson Assistant — Smoke', () => {
  const base = Cypress.config('baseUrl') || 'http://learning.test:8000/lms'

  beforeEach(() => {
    // Stub current user as Moderator so edit/actions are visible
    cy.intercept('POST', '**/api/method/lms.lms.api.get_user_info', {
      statusCode: 200,
      body: {
        message: {
          name: 'Administrator',
          full_name: 'Administrator',
          is_moderator: 1,
          is_instructor: 1,
        },
      },
    }).as('getUser')

    // Enable global assistant toggle
    cy.intercept('POST', '**/api/method/lms.lms.api.get_lms_setting', (req) => {
      const field = req.body?.params?.field
      if (field === 'enable_lesson_assistant') {
        req.reply({ statusCode: 200, body: { message: 1 } })
      } else if (field === 'assistant_mode') {
        req.reply({ statusCode: 200, body: { message: 'Heuristic' } })
      } else if (field === 'assistant_enable_streaming') {
        req.reply({ statusCode: 200, body: { message: 0 } })
      } else {
        req.reply({ statusCode: 200, body: { message: null } })
      }
    }).as('getSetting')

    // Course-level enable
    cy.intercept('POST', '**/api/method/lms.lms.api.is_assistant_enabled', {
      statusCode: 200,
      body: { message: true },
    }).as('isEnabled')

    // Minimal lesson payload the page expects
    cy.intercept('POST', '**/api/method/lms.lms.utils.get_lesson', {
      statusCode: 200,
      body: {
        message: {
          name: 'LESSON-1',
          title: 'Intro Lesson',
          chapter_title: 'Chapter 1',
          course_title: 'Course 1',
          membership: { progress: 0 },
          content: JSON.stringify({ blocks: [{ type: 'header', data: { text: 'Heading' } }, { type: 'paragraph', data: { text: 'Body' } }] }),
        },
      },
    }).as('getLesson')

    // Chat reply (heuristic mode)
    cy.intercept('POST', '**/api/method/lms.lms.api.chatbot_reply', {
      statusCode: 200,
      body: { message: { role: 'assistant', content: 'Hello from stub' }, session: 'S1' },
    }).as('chatReply')
  })

  it('renders assistant panel and replies', () => {
    cy.visit(base + '/courses/COURSE-1/learn/1-1')
    cy.contains('Assistant').should('be.visible')
    // Send a prompt
    cy.get('textarea').type('Summarize this lesson{enter}')
    cy.wait('@chatReply')
    cy.contains('Hello from stub').should('be.visible')
  })
})

describe('LessonForm — Actions Visible', () => {
  const base = Cypress.config('baseUrl') || 'http://learning.test:8000/lms'

  beforeEach(() => {
    // Moderator
    cy.intercept('POST', '**/api/method/lms.lms.api.get_user_info', {
      statusCode: 200,
      body: { message: { name: 'Administrator', is_moderator: 1, is_instructor: 1 } },
    })
    // Minimal lesson payload
    cy.intercept('POST', '**/api/method/lms.lms.utils.get_lesson', {
      statusCode: 200,
      body: { message: { name: 'LESSON-1', title: 'Intro Lesson', chapter_title: 'Chapter 1', course_title: 'Course 1', membership: { progress: 0 }, content: JSON.stringify({ blocks: [] }) } },
    })
    // RAG summary and others used by LessonForm can be no-op to keep UI rendering
    cy.intercept('POST', '**/api/method/lms.lms.api.get_rag_index_summary', { statusCode: 200, body: { message: { total_chunks: 0, embedded_chunks: 0, by_source: {} } } })
    cy.intercept('POST', '**/api/method/lms.lms.api.get_lesson_attachment_status', { statusCode: 200, body: { message: [] } })
    cy.intercept('POST', '**/api/method/lms.lms.api.get_last_lesson_draft', { statusCode: 200, body: { message: [] } })
    cy.intercept('POST', '**/api/method/lms.lms.api.get_last_faq_draft', { statusCode: 200, body: { message: [] } })
    cy.intercept('POST', '**/api/method/lms.lms.api.get_external_sources', { statusCode: 200, body: { message: [] } })
  })

  it('shows key AI actions for moderators', () => {
    cy.visit(base + '/courses/COURSE-1/learn/1-1/edit')
    cy.contains('Generate Quiz (AI)').should('be.visible')
    cy.contains('Regenerate Quiz (Last)').should('exist') // may be disabled if no last params
    cy.contains('Generate Summary/Glossary').should('be.visible')
    cy.contains('Generate FAQ Draft').should('be.visible')
    cy.contains('Index This Lesson').should('be.visible')
    cy.contains('Compute Embeddings').should('be.visible')
    cy.contains('Rebuild Index').should('be.visible')
  })
})

