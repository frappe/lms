frappe.ui.form.on('AI Lesson Draft', {
  refresh(frm) {
    if (!frm.doc.__islocal) {
      // Regenerate summary/glossary (creates a new draft)
      frm.add_custom_button(__('Regenerate (AI)'), async () => {
        try {
          if (!frm.doc.lesson) {
            frappe.msgprint(__('No lesson linked to regenerate'))
            return
          }
          const res = await frappe.call({
            method: 'lms.lms.api.generate_lesson_draft',
            args: { lesson: frm.doc.lesson },
          })
          if (res.message && res.message.ok) {
            frappe.show_alert({ message: __('Regenerated Lesson Draft'), indicator: 'green' })
            if (res.message.draft) frappe.set_route('/app/ai-lesson-draft/' + res.message.draft)
          } else {
            frappe.msgprint(__('Failed to regenerate lesson draft'))
          }
        } catch (e) {
          frappe.msgprint(__('Failed to regenerate lesson draft'))
        }
      })
      frm.add_custom_button(__('Export Markdown'), async () => {
        try {
          const res = await frappe.call({
            method: 'lms.lms.api.export_lesson_draft_markdown',
            args: { draft: frm.doc.name },
          })
          const md = res.message && res.message.markdown
          if (!md) return
          const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = (frm.doc.name || 'lesson-draft') + '.md'
          a.click()
          URL.revokeObjectURL(url)
        } catch (e) {
          frappe.msgprint(__('Failed to export'))
        }
      })

      frm.add_custom_button(__('Promote to Web Page'), async () => {
        try {
          const res = await frappe.call({
            method: 'lms.lms.api.promote_lesson_draft_to_web_page',
            args: { draft: frm.doc.name, published: 0 },
          })
          if (res.message && res.message.ok) {
            frappe.show_alert({ message: __('Web Page created'), indicator: 'green' })
            const name = res.message.page
            if (name) frappe.set_route('/app/web-page/' + name)
          } else {
            frappe.msgprint(__('Failed to promote'))
          }
        } catch (e) {
          frappe.msgprint(__('Failed to promote'))
        }
      })
    }
  },
})
