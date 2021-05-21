import frappe
from . import utils
from community.lms.doctype.lms_batch.lms_batch import get_messages

def get_context(context):
    utils.get_common_context(context)

    context.members = utils.get_batch_members(context.batch.name)
    context.member_count = len(context.members)
