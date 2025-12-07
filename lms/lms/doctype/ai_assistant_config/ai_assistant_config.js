frappe.ui.form.on('AI Assistant Config', {
  refresh(frm) {
    set_preset_preview(frm);
  },
  prompt_preset(frm) {
    set_preset_preview(frm);
  }
});

function set_preset_preview(frm) {
  const preset = frm.doc.prompt_preset;
  if (!preset) {
    frm.set_value('preset_description', '');
    return;
  }
  frappe.db.get_value('AI Prompt Preset', preset, ['description', 'prompt'])
    .then(r => {
      if (!r || !r.message) return;
      const { description, prompt } = r.message;
      let preview = '';
      if (description) preview += `Description: ${description}\n`;
      if (prompt) {
        const snippet = String(prompt).slice(0, 300);
        preview += `Prompt Preview: ${snippet}${prompt.length > 300 ? '…' : ''}`;
      }
      frm.set_value('preset_description', preview || '');
    });
}

