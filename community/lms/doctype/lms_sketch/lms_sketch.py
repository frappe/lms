# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import hashlib
from urllib.parse import urlparse
import frappe
from frappe.model.document import Document
from . import livecode

class LMSSketch(Document):
    def get_owner_name(self):
        return get_userinfo(self.owner)['full_name']

    def get_livecode_url(self):
        doc = frappe.get_cached_doc("LMS Settings")
        return doc.livecode_url

    def get_livecode_ws_url(self):
        url = urlparse(self.get_livecode_url())
        protocol = "wss" if url.scheme == "https" else "ws"
        return protocol + "://" + url.netloc + "/livecode"

    def to_svg(self):
        return self.svg or self.render_svg()

    def render_svg(self):
        h = hashlib.md5(self.code.encode('utf-8')).hexdigest()
        cache = frappe.cache()
        key = "sketch-" + h
        value = cache.get(key)
        if value:
            value = value.decode('utf-8')
        else:
            ws_url = self.get_livecode_ws_url()
            value = livecode.livecode_to_svg(ws_url, self.code)
            cache.set(key, value)
        return value

    def __repr__(self):
        return f"<LMSSketch {self.name}>"

@frappe.whitelist()
def save_sketch(name, title, code):
    if not name or name == "new":
        doc = frappe.new_doc('LMS Sketch')
        doc.title = title
        doc.code = code
        doc.runtime = 'python-canvas'
        doc.insert()
        status = "created"
    else:
        doc = frappe.get_doc("LMS Sketch", name)

        if doc.owner != frappe.session.user:
            return {
                "ok": False,
                "error": "Permission Denied"
            }
        doc.title = title
        doc.code = code
        doc.svg = ''
        doc.save()
        status = "updated"
    return {
        "ok": True,
        "status": status,
        "name": doc.name,
    }

def get_recent_sketches():
    """Returns the recent sketches.

    The return value will be a list of dicts with each entry containing
    the following fields:
        - name
        - title
        - owner
        - owner_name
        - modified
    """
    sketches = frappe.get_all(
        "LMS Sketch",
        fields='*',
        order_by='modified desc',
        page_length=100
    )
    for s in sketches:
        s['owner_name'] = get_userinfo(s['owner'])['full_name']
    return [frappe.get_doc(doctype='LMS Sketch', **doc) for doc in sketches]

def get_userinfo(email):
    """Returns the username and fullname of a user.

    Please note that the email could be "Administrator" or "Guest"
    as a special case to denote the system admin and guest user respectively.
    """
    user = frappe.get_doc("User", email)
    return {
        "full_name": user.full_name,
        "username": user.username
    }
