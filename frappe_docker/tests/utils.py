import os
import ssl
import subprocess
import sys
import time
from contextlib import suppress
from typing import Callable, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

CI = os.getenv("CI")


class Compose:
    def __init__(self, project_name: str, env_file: str):
        self.project_name = project_name
        self.base_cmd = (
            "docker",
            "compose",
            "-p",
            project_name,
            "--env-file",
            env_file,
        )

    def __call__(self, *cmd: str) -> None:
        file_args = [
            "-f",
            "compose.yaml",
            "-f",
            "overrides/compose.proxy.yaml",
            "-f",
            "overrides/compose.mariadb.yaml",
            "-f",
            "overrides/compose.redis.yaml",
        ]
        if CI:
            file_args += ("-f", "tests/compose.ci.yaml")

        args = self.base_cmd + tuple(file_args) + cmd
        subprocess.check_call(args)

    def exec(self, *cmd: str) -> None:
        if sys.stdout.isatty():
            self("exec", *cmd)
        else:
            self("exec", "-T", *cmd)

    def stop(self) -> None:
        # Stop all containers in `test` project if they are running.
        # We don't care if it fails.
        with suppress(subprocess.CalledProcessError):
            subprocess.check_call(self.base_cmd + ("down", "-v", "--remove-orphans"))

    def bench(self, *cmd: str) -> None:
        self.exec("backend", "bench", *cmd)


def check_url_content(
    url: str, callback: Callable[[str], Optional[str]], site_name: str
):
    request = Request(url, headers={"Host": site_name})

    # This is needed to check https override
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    for _ in range(100):
        try:
            response = urlopen(request, context=ctx)

        except HTTPError as exc:
            if exc.code not in (404, 502):
                raise

        except URLError:
            pass

        else:
            text: str = response.read().decode()
            ret = callback(text)
            if ret:
                print(ret)
                return

        time.sleep(0.1)

    raise RuntimeError(f"Couldn't ping {url}")
