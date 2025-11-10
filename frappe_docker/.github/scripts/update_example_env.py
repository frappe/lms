import os
import re


def get_erpnext_version():
    erpnext_version = os.getenv("ERPNEXT_VERSION")
    assert erpnext_version, "No ERPNext version set"
    return erpnext_version


def update_env(erpnext_version: str):
    with open("example.env", "r+") as f:
        content = f.read()
        content = re.sub(
            rf"ERPNEXT_VERSION=.*", f"ERPNEXT_VERSION={erpnext_version}", content
        )
        f.seek(0)
        f.truncate()
        f.write(content)


def main() -> int:
    update_env(get_erpnext_version())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
