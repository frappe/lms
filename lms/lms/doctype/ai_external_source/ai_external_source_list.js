frappe.listview_settings['AI External Source'] = {
  onload(listview) {
    listview.page.add_action_item(__('Re-fetch & Index Selected'), async () => {
      const selected = listview.get_checked_items() || []
      if (!selected.length) {
        frappe.msgprint(__('No rows selected'))
        return
      }
      try {
        for (const row of selected) {
          await frappe.call({ method: 'lms.lms.api.enqueue_external_source', args: { docname: row.name } })
        }
        frappe.show_alert({ message: __('Enqueued re-fetch jobs for selected'), indicator: 'green' })
      } catch (e) {
        frappe.msgprint(__('Failed to enqueue for some items'))
      }
    })
  }
}

