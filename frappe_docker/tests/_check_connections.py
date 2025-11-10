from __future__ import annotations

import asyncio
import json
import socket
from typing import Any, Iterable, Tuple

Address = Tuple[str, int]


async def wait_for_port(address: Address) -> None:
    # From https://github.com/clarketm/wait-for-it
    while True:
        try:
            _, writer = await asyncio.open_connection(*address)
            writer.close()
            await writer.wait_closed()
            break
        except (socket.gaierror, ConnectionError, OSError, TypeError):
            pass
        await asyncio.sleep(0.1)


def get_redis_url(addr: str) -> Address:
    result = addr.replace("redis://", "")
    result = result.split("/")[0]
    parts = result.split(":")
    assert len(parts) == 2
    return parts[0], int(parts[1])


def get_addresses(config: dict[str, Any]) -> Iterable[Address]:
    yield (config["db_host"], config["db_port"])
    for key in ("redis_cache", "redis_queue"):
        yield get_redis_url(config[key])


async def async_main(addresses: set[Address]) -> None:
    tasks = [asyncio.wait_for(wait_for_port(addr), timeout=5) for addr in addresses]
    await asyncio.gather(*tasks)


def main() -> int:
    with open("/home/frappe/frappe-bench/sites/common_site_config.json") as f:
        config = json.load(f)
    addresses = set(get_addresses(config))
    asyncio.run(async_main(addresses))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
