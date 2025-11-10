import os
from pathlib import Path
from typing import Any

import pytest

from tests.conftest import S3ServiceResult
from tests.utils import Compose, check_url_content

BACKEND_SERVICES = (
    "backend",
    "queue-short",
    "queue-long",
    "scheduler",
)


@pytest.mark.parametrize("service", BACKEND_SERVICES)
def test_links_in_backends(service: str, compose: Compose, python_path: str):
    filename = "_check_connections.py"
    compose("cp", f"tests/{filename}", f"{service}:/tmp/")
    compose.exec(service, python_path, f"/tmp/{filename}")


def index_cb(text: str):
    if "404 page not found" not in text:
        return text[:200]


def api_cb(text: str):
    if '"message"' in text:
        return text


def assets_cb(text: str):
    if text:
        return text[:200]


@pytest.mark.parametrize(
    ("url", "callback"), (("/", index_cb), ("/api/method/ping", api_cb))
)
def test_endpoints(url: str, callback: Any, frappe_site: str):
    check_url_content(
        url=f"http://127.0.0.1{url}", callback=callback, site_name=frappe_site
    )


@pytest.mark.skipif(
    os.environ["FRAPPE_VERSION"][0:3] == "v12", reason="v12 doesn't have the asset"
)
def test_assets_endpoint(frappe_site: str):
    check_url_content(
        url=f"http://127.0.0.1/assets/frappe/images/frappe-framework-logo.svg",
        callback=assets_cb,
        site_name=frappe_site,
    )


def test_files_reachable(frappe_site: str, tmp_path: Path, compose: Compose):
    content = "lalala\n"
    file_path = tmp_path / "testfile.txt"

    with file_path.open("w") as f:
        f.write(content)

    compose(
        "cp",
        str(file_path),
        f"backend:/home/frappe/frappe-bench/sites/{frappe_site}/public/files/",
    )

    def callback(text: str):
        if text == content:
            return text

    check_url_content(
        url=f"http://127.0.0.1/files/{file_path.name}",
        callback=callback,
        site_name=frappe_site,
    )


@pytest.mark.parametrize("service", BACKEND_SERVICES)
@pytest.mark.usefixtures("frappe_site")
def test_frappe_connections_in_backends(
    service: str, python_path: str, compose: Compose
):
    filename = "_ping_frappe_connections.py"
    compose("cp", f"tests/{filename}", f"{service}:/tmp/")
    compose.exec(
        "-w",
        "/home/frappe/frappe-bench/sites",
        service,
        python_path,
        f"/tmp/{filename}",
    )


def test_push_backup(
    frappe_site: str,
    s3_service: S3ServiceResult,
    compose: Compose,
):
    restic_password = "secret"
    compose.bench("--site", frappe_site, "backup", "--with-files")
    restic_args = [
        "--env=RESTIC_REPOSITORY=s3:http://minio:9000/frappe",
        f"--env=AWS_ACCESS_KEY_ID={s3_service.access_key}",
        f"--env=AWS_SECRET_ACCESS_KEY={s3_service.secret_key}",
        f"--env=RESTIC_PASSWORD={restic_password}",
    ]
    compose.exec(*restic_args, "backend", "restic", "init")
    compose.exec(*restic_args, "backend", "restic", "backup", "sites")
    compose.exec(*restic_args, "backend", "restic", "snapshots")


def test_https(frappe_site: str, compose: Compose):
    compose("-f", "overrides/compose.https.yaml", "up", "-d")
    check_url_content(url="https://127.0.0.1", callback=index_cb, site_name=frappe_site)


@pytest.mark.usefixtures("erpnext_setup")
class TestErpnext:
    @pytest.mark.parametrize(
        ("url", "callback"),
        (
            (
                "/api/method/erpnext.templates.pages.search_help.get_help_results_sections?text=help",
                api_cb,
            ),
            ("/assets/erpnext/js/setup_wizard.js", assets_cb),
        ),
    )
    def test_endpoints(self, url: str, callback: Any, erpnext_site: str):
        check_url_content(
            url=f"http://127.0.0.1{url}", callback=callback, site_name=erpnext_site
        )


@pytest.mark.usefixtures("postgres_setup")
class TestPostgres:
    def test_site_creation(self, compose: Compose):
        compose.bench(
            "new-site",
            "test-pg-site.localhost",
            "--db-type",
            "postgres",
            "--admin-password",
            "admin",
        )
