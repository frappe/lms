#!/usr/bin/env python3
import argparse
import os
import subprocess


def cprint(*args, level: int = 1):
    """
    logs colorful messages
    level = 1 : RED
    level = 2 : GREEN
    level = 3 : YELLOW

    default level = 1
    """
    CRED = "\033[31m"
    CGRN = "\33[92m"
    CYLW = "\33[93m"
    reset = "\033[0m"
    message = " ".join(map(str, args))
    if level == 1:
        print(CRED, message, reset)  # noqa: T001, T201
    if level == 2:
        print(CGRN, message, reset)  # noqa: T001, T201
    if level == 3:
        print(CYLW, message, reset)  # noqa: T001, T201


def main():
    parser = get_args_parser()
    args = parser.parse_args()
    init_bench_if_not_exist(args)
    create_site_in_bench(args)


def get_args_parser():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "-j",
        "--apps-json",
        action="store",
        type=str,
        help="Path to apps.json, default: apps-example.json",
        default="apps-example.json",
    )  # noqa: E501
    parser.add_argument(
        "-b",
        "--bench-name",
        action="store",
        type=str,
        help="Bench directory name, default: frappe-bench",
        default="frappe-bench",
    )  # noqa: E501
    parser.add_argument(
        "-s",
        "--site-name",
        action="store",
        type=str,
        help="Site name, should end with .localhost, default: development.localhost",  # noqa: E501
        default="development.localhost",
    )
    parser.add_argument(
        "-r",
        "--frappe-repo",
        action="store",
        type=str,
        help="frappe repo to use, default: https://github.com/frappe/frappe",  # noqa: E501
        default="https://github.com/frappe/frappe",
    )
    parser.add_argument(
        "-t",
        "--frappe-branch",
        action="store",
        type=str,
        help="frappe repo to use, default: version-15",  # noqa: E501
        default="version-15",
    )
    parser.add_argument(
        "-p",
        "--py-version",
        action="store",
        type=str,
        help="python version, default: Not Set",  # noqa: E501
        default=None,
    )
    parser.add_argument(
        "-n",
        "--node-version",
        action="store",
        type=str,
        help="node version, default: Not Set",  # noqa: E501
        default=None,
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="verbose output",  # noqa: E501
    )
    parser.add_argument(
        "-a",
        "--admin-password",
        action="store",
        type=str,
        help="admin password for site, default: admin",  # noqa: E501
        default="admin",
    )
    parser.add_argument(
        "-d",
        "--db-type",
        action="store",
        type=str,
        help="Database type to use (e.g., mariadb or postgres)",
        default="mariadb",  # Set your default database type here
    )
    return parser


def init_bench_if_not_exist(args):
    if os.path.exists(args.bench_name):
        cprint("Bench already exists. Only site will be created", level=3)
        return
    try:
        env = os.environ.copy()
        if args.py_version:
            env["PYENV_VERSION"] = args.py_version
        init_command = ""
        if args.node_version:
            init_command = f"nvm use {args.node_version};"
        if args.py_version:
            init_command += f"PYENV_VERSION={args.py_version} "
        init_command += "bench init "
        init_command += "--skip-redis-config-generation "
        init_command += "--verbose " if args.verbose else " "
        init_command += f"--frappe-path={args.frappe_repo} "
        init_command += f"--frappe-branch={args.frappe_branch} "
        init_command += f"--apps_path={args.apps_json} "
        init_command += args.bench_name
        command = [
            "/bin/bash",
            "-i",
            "-c",
            init_command,
        ]
        subprocess.call(command, env=env, cwd=os.getcwd())
        cprint("Configuring Bench ...", level=2)
        cprint("Set db_host", level=3)
        if args.db_type:
            cprint(f"Setting db_type to {args.db_type}", level=3)
            subprocess.call(
                ["bench", "set-config", "-g", "db_type", args.db_type],
                cwd=os.path.join(os.getcwd(), args.bench_name),
            )

        cprint("Set redis_cache to redis://redis-cache:6379", level=3)
        subprocess.call(
            [
                "bench",
                "set-config",
                "-g",
                "redis_cache",
                "redis://redis-cache:6379",
            ],
            cwd=os.getcwd() + "/" + args.bench_name,
        )
        cprint("Set redis_queue to redis://redis-queue:6379", level=3)
        subprocess.call(
            [
                "bench",
                "set-config",
                "-g",
                "redis_queue",
                "redis://redis-queue:6379",
            ],
            cwd=os.getcwd() + "/" + args.bench_name,
        )
        cprint(
            "Set redis_socketio to redis://redis-queue:6379 for backward compatibility",  # noqa: E501
            level=3,
        )
        subprocess.call(
            [
                "bench",
                "set-config",
                "-g",
                "redis_socketio",
                "redis://redis-queue:6379",
            ],
            cwd=os.getcwd() + "/" + args.bench_name,
        )
        cprint("Set developer_mode", level=3)
        subprocess.call(
            ["bench", "set-config", "-gp", "developer_mode", "1"],
            cwd=os.getcwd() + "/" + args.bench_name,
        )
    except subprocess.CalledProcessError as e:
        cprint(e.output, level=1)


def create_site_in_bench(args):
    if "mariadb" == args.db_type:
        cprint("Set db_host", level=3)
        subprocess.call(
            ["bench", "set-config", "-g", "db_host", "mariadb"],
            cwd=os.getcwd() + "/" + args.bench_name,
        )
        new_site_cmd = [
            "bench",
            "new-site",
            f"--db-root-username=root",
            f"--db-host=mariadb",  # Should match the compose service name
            f"--db-type={args.db_type}",  # Add the selected database type
            f"--mariadb-user-host-login-scope=%",
            f"--db-root-password=123",  # Replace with your MariaDB password
            f"--admin-password={args.admin_password}",
        ]
    else:
        cprint("Set db_host", level=3)
        subprocess.call(
            ["bench", "set-config", "-g", "db_host", "postgresql"],
            cwd=os.getcwd() + "/" + args.bench_name,
        )
        new_site_cmd = [
            "bench",
            "new-site",
            f"--db-root-username=root",
            f"--db-host=postgresql",  # Should match the compose service name
            f"--db-type={args.db_type}",  # Add the selected database type
            f"--db-root-password=123",  # Replace with your PostgreSQL password
            f"--admin-password={args.admin_password}",
        ]
    apps = os.listdir(f"{os.getcwd()}/{args.bench_name}/apps")
    apps.remove("frappe")
    for app in apps:
        new_site_cmd.append(f"--install-app={app}")
    new_site_cmd.append(args.site_name)
    cprint(f"Creating Site {args.site_name} ...", level=2)
    subprocess.call(
        new_site_cmd,
        cwd=os.getcwd() + "/" + args.bench_name,
    )


if __name__ == "__main__":
    main()
