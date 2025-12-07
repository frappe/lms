frappe.ui.form.on('AI External Source', {
  refresh(frm) {
    if (!frm.doc.__islocal) {
      frm.add_custom_button(__('Re-fetch & Index'), async () => {
        try {
          const res = await frappe.call({
            method: 'lms.lms.api.enqueue_external_source',
            args: { docname: frm.doc.name },
          })
          if (res.message) {
            frappe.show_alert({ message: __('Enqueued re-fetch job'), indicator: 'green' })
          }
        } catch (e) {
          frappe.msgprint(__('Failed to enqueue re-fetch'))
        }
      })
    }
  },
})

