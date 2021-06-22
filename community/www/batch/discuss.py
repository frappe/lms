import frappe
from . import utils

def get_context(context):
    utils.get_common_context(context)
    context.messages = context.batch.get_messages()
    if not context.membership:
        utils.redirect_to_lesson(context.course)
