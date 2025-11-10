import frappe


def check_db():
    doc = frappe.get_single("System Settings")
    assert any(v is None for v in doc.as_dict().values()), "Database test didn't pass"
    print("Database works!")


def check_cache():
    key_and_name = "mytestkey", "mytestname"
    frappe.cache().hset(*key_and_name, "mytestvalue")
    assert frappe.cache().hget(*key_and_name) == "mytestvalue", "Cache test didn't pass"
    frappe.cache().hdel(*key_and_name)
    print("Cache works!")


def main() -> int:
    frappe.connect(site="tests.localhost")
    check_db()
    check_cache()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
