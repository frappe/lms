frappe.ui.form.on('AI FAQ Draft', {
  refresh(frm) {
    if (!frm.doc.__islocal) {
      // Regenerate FAQ draft from transcripts (creates a new draft)
      frm.add_custom_button(__('Regenerate (AI)'), async () => {
        try {
          const args = { course: frm.doc.course || null, lesson: frm.doc.lesson || null, max_pairs: 20 }
          const res = await frappe.call({
            method: 'lms.lms.api.generate_faq_from_transcripts',
            args,
          })
          if (res.message && res.message.ok) {
            frappe.show_alert({ message: __('Regenerated FAQ Draft'), indicator: 'green' })
            if (res.message.draft) frappe.set_route('/app/ai-faq-draft/' + res.message.draft)
          } else {
            frappe.msgprint(__('Failed to regenerate FAQ draft'))
          }
        } catch (e) {
          frappe.msgprint(__('Failed to regenerate FAQ draft'))
        }
      })
      frm.add_custom_button(__('Export Markdown'), async () => {
        try {
          const res = await frappe.call({
            method: 'lms.lms.api.export_faq_draft_markdown',
            args: { draft: frm.doc.name },
          })
          const md = res.message && res.message.markdown
          if (!md) return
          const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = (frm.doc.name || 'faq') + '.md'
          a.click()
          URL.revokeObjectURL(url)
        } catch (e) {
          frappe.msgprint(__('Failed to export'))
        }
      })

      frm.add_custom_button(__('Promote to Web Page'), async () => {
        try {
          const res = await frappe.call({
            method: 'lms.lms.api.promote_faq_draft_to_web_page',
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
