"""Hooks that are executed during and after install.
"""
import os
import frappe

APP_LOGO_URL = os.getenv("APP_LOGO_URL") or "/files/logo.png"

def after_install():
    set_app_name()
    disable_signup()
    add_header_items()
    add_footer_items()

def set_app_name():
    app_name = os.getenv("FRAPPE_APP_NAME")
    if app_name:
        frappe.db.set_value('System Settings', None, 'app_name', app_name)

def disable_signup():
    frappe.db.set_value("Website Settings", None, "disable_signup", 1)

def add_header_items():
    items = [
        {"label": "Sketches", "url": "/sketches"},
    ]
    doc = frappe.get_doc("Website Settings", None)
    doc.update({
        "top_bar_items": items
    })
    doc.save()

def add_footer_items():
    items = [
        {"label": "About", "url": "/about"},
        {"label": "Blog", "url": "/blog"},
        {"label": "Github", "url": "https://github.com/fossunited/community"}
    ]
    doc = frappe.get_doc("Website Settings", None)
    doc.update({
        "footer_items": items
    })
    doc.save()
