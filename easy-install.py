#!/usr/bin/env python3

import argparse
import base64
import logging
import os
import platform
import shutil
import subprocess
import sys
import time
import urllib.request
from shutil import move, unpack_archive, which
from typing import Dict, List

logging.basicConfig(
    filename="easy-install.log",
    filemode="w",
    format="%(asctime)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)


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
        print(CRED, message, reset)
    if level == 2:
        print(CGRN, message, reset)
    if level == 3:
        print(CYLW, message, reset)


def clone_frappe_docker_repo() -> None:
    try:
        urllib.request.urlretrieve(
            "https://github.com/frappe/frappe_docker/archive/refs/heads/main.zip",
            "frappe_docker.zip",
        )
        logging.info("Downloaded frappe_docker zip file from GitHub")
        unpack_archive("frappe_docker.zip", ".")
        # Unzipping the frappe_docker.zip creates a folder "frappe_docker-main"
        move("frappe_docker-main", "frappe_docker")
        logging.info("Unzipped and Renamed frappe_docker")
        os.remove("frappe_docker.zip")
        logging.info("Removed the downloaded zip file")
    except Exception as e:
        logging.error("Download and unzip failed", exc_info=True)
        cprint("\nCloning frappe_docker Failed\n\n", "[ERROR]: ", e, level=1)


def get_from_env(dir, file) -> Dict:
    env_vars = {}
    with open(os.path.join(dir, file)) as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            key, value = line.strip().split("=", 1)
            env_vars[key] = value
    return env_vars


def write_to_env(
    frappe_docker_dir: str,
    out_file: str,
    sites: List[str],
    db_pass: str,
    admin_pass: str,
    email: str,
    cronstring: str,
    erpnext_version: str = None,
    http_port: str = None,
    custom_image: str = None,
    custom_tag: str = None,
) -> None:
    quoted_sites = ",".join([f"`{site}`" for site in sites]).strip(",")
    example_env = get_from_env(frappe_docker_dir, "example.env")
    erpnext_version = erpnext_version or example_env["ERPNEXT_VERSION"]
    env_file_lines = [
        # defaults to latest version of ERPNext
        f"ERPNEXT_VERSION={erpnext_version}\n",
        f"DB_PASSWORD={db_pass}\n",
        "DB_HOST=db\n",
        "DB_PORT=3306\n",
        "REDIS_CACHE=redis-cache:6379\n",
        "REDIS_QUEUE=redis-queue:6379\n",
        "REDIS_SOCKETIO=redis-socketio:6379\n",
        f"LETSENCRYPT_EMAIL={email}\n",
        f"SITE_ADMIN_PASS={admin_pass}\n",
        f"SITES={quoted_sites}\n",
        "PULL_POLICY=missing\n",
        f'BACKUP_CRONSTRING="{cronstring}"\n',
    ]

    if http_port:
        env_file_lines.append(f"HTTP_PUBLISH_PORT={http_port}\n")

    if custom_image:
        env_file_lines.append(f"CUSTOM_IMAGE={custom_image}\n")

    if custom_tag:
        env_file_lines.append(f"CUSTOM_TAG={custom_tag}\n")

    with open(os.path.join(out_file), "w") as f:
        f.writelines(env_file_lines)


def generate_pass(length: int = 12) -> str:
    """Generate random hash using best available randomness source."""
    import math
    import secrets

    if not length:
        length = 56

    return secrets.token_hex(math.ceil(length / 2))[:length]


def get_frappe_docker_path():
    return os.path.join(os.getcwd(), "frappe_docker")


def check_repo_exists() -> bool:
    return os.path.exists(get_frappe_docker_path())


def start_prod(
    project: str,
    sites: List[str] = [],
    email: str = None,
    cronstring: str = None,
    version: str = None,
    image: str = None,
    is_https: bool = True,
    http_port: str = None,
):
    if not check_repo_exists():
        clone_frappe_docker_repo()
    install_container_runtime()

    compose_file_name = os.path.join(
        os.path.expanduser("~"),
        f"{project}-compose.yml",
    )

    env_file_dir = os.path.expanduser("~")
    env_file_name = f"{project}.env"
    env_file_path = os.path.join(
        os.path.expanduser("~"),
        env_file_name,
    )

    frappe_docker_dir = get_frappe_docker_path()

    cprint(
        f"\nPlease refer to {env_file_path} to know which keys to set\n\n",
        level=3,
    )
    admin_pass = ""
    db_pass = ""
    custom_image = None
    custom_tag = None

    if image:
        custom_image = image
        custom_tag = version

    with open(compose_file_name, "w") as f:
        # Writing to compose file
        if not os.path.exists(env_file_path):
            admin_pass = generate_pass()
            db_pass = generate_pass(9)
            write_to_env(
                frappe_docker_dir=frappe_docker_dir,
                out_file=env_file_path,
                sites=sites,
                db_pass=db_pass,
                admin_pass=admin_pass,
                email=email,
                cronstring=cronstring,
                erpnext_version=version,
                http_port=http_port if not is_https and http_port else None,
                custom_image=custom_image,
                custom_tag=custom_tag,
            )
            cprint(
                "\nA .env file is generated with basic configs. Please edit it to fit to your needs \n",
                level=3,
            )
            with open(
                os.path.join(os.path.expanduser("~"), f"{project}-passwords.txt"), "w"
            ) as en:
                en.writelines(f"ADMINISTRATOR_PASSWORD={admin_pass}\n")
                en.writelines(f"MARIADB_ROOT_PASSWORD={db_pass}\n")
        else:
            env = get_from_env(env_file_dir, env_file_name)
            sites = env["SITES"].replace("`", "").split(",") if env["SITES"] else []
            db_pass = env["DB_PASSWORD"]
            admin_pass = env["SITE_ADMIN_PASS"]
            email = env["LETSENCRYPT_EMAIL"]
            custom_image = env.get("CUSTOM_IMAGE")
            custom_tag = env.get("CUSTOM_TAG")

            version = env.get("ERPNEXT_VERSION", version)
            write_to_env(
                frappe_docker_dir=frappe_docker_dir,
                out_file=env_file_path,
                sites=sites,
                db_pass=db_pass,
                admin_pass=admin_pass,
                email=email,
                cronstring=cronstring,
                erpnext_version=version,
                http_port=http_port if not is_https and http_port else None,
                custom_image=custom_image,
                custom_tag=custom_tag,
            )

        try:
            command = [
                "docker",
                "compose",
                "--project-name",
                project,
                "-f",
                "compose.yaml",
                "-f",
                "overrides/compose.mariadb.yaml",
                "-f",
                "overrides/compose.redis.yaml",
                "-f",
                (
                    "overrides/compose.https.yaml"
                    if is_https
                    else "overrides/compose.noproxy.yaml"
                ),
                "-f",
                "overrides/compose.backup-cron.yaml",
                "--env-file",
                env_file_path,
                "config",
            ]

            subprocess.run(
                command,
                cwd=frappe_docker_dir,
                stdout=f,
                check=True,
            )

        except Exception:
            logging.error("Docker Compose generation failed", exc_info=True)
            cprint("\nGenerating Compose File failed\n")
            sys.exit(1)

    try:
        # Starting with generated compose file
        command = [
            "docker",
            "compose",
            "-p",
            project,
            "-f",
            compose_file_name,
            "up",
            "--force-recreate",
            "--remove-orphans",
            "-d",
        ]
        subprocess.run(
            command,
            check=True,
        )
        logging.info(f"Docker Compose file generated at ~/{project}-compose.yml")

    except Exception as e:
        logging.error("Prod docker-compose failed", exc_info=True)
        cprint(" Docker Compose failed, please check the container logs\n", e)
        sys.exit(1)

    return db_pass, admin_pass


def setup_prod(
    project: str,
    sites: List[str],
    email: str,
    cronstring: str,
    version: str = None,
    image: str = None,
    apps: List[str] = [],
    is_https: bool = False,
    http_port: str = None,
) -> None:
    if len(sites) == 0:
        sites = ["site1.localhost"]

    db_pass, admin_pass = start_prod(
        project=project,
        sites=sites,
        email=email,
        cronstring=cronstring,
        version=version,
        image=image,
        is_https=is_https,
        http_port=http_port,
    )

    for sitename in sites:
        create_site(sitename, project, db_pass, admin_pass, apps)

    cprint(
        f"MariaDB root password is {db_pass}",
        level=2,
    )
    cprint(
        f"Site administrator password is {admin_pass}",
        level=2,
    )
    passwords_file_path = os.path.join(
        os.path.expanduser("~"),
        f"{project}-passwords.txt",
    )
    cprint(f"Passwords are stored in {passwords_file_path}", level=3)


def update_prod(
    project: str,
    version: str = None,
    image: str = None,
    cronstring: str = None,
    is_https: bool = False,
    http_port: str = None,
) -> None:
    start_prod(
        project=project,
        version=version,
        image=image,
        cronstring=cronstring,
        is_https=is_https,
        http_port=http_port,
    )
    migrate_site(project=project)


def setup_dev_instance(project: str):
    if not check_repo_exists():
        clone_frappe_docker_repo()
    install_container_runtime()

    try:
        command = [
            "docker",
            "compose",
            "-f",
            "devcontainer-example/docker-compose.yml",
            "--project-name",
            project,
            "up",
            "-d",
        ]
        subprocess.run(
            command,
            cwd=get_frappe_docker_path(),
            check=True,
        )
        cprint(
            "Please go through the Development Documentation: https://github.com/frappe/frappe_docker/tree/main/docs/development.md to fully complete the setup.",
            level=2,
        )
        logging.info("Development Setup completed")
    except Exception as e:
        logging.error("Dev Environment setup failed", exc_info=True)
        cprint("Setting Up Development Environment Failed\n", e)


def install_docker():
    cprint("Docker is not installed, Installing Docker...", level=3)
    logging.info("Docker not found, installing Docker")
    if platform.system() == "Darwin" or platform.system() == "Windows":
        cprint(
            f"""
            This script doesn't install Docker on {"Mac" if platform.system()=="Darwin" else "Windows"}.

            Please go through the Docker Installation docs for your system and run this script again"""
        )
        logging.debug("Docker setup failed due to platform is not Linux")
        sys.exit(1)
    try:
        ps = subprocess.run(
            ["curl", "-fsSL", "https://get.docker.com"],
            capture_output=True,
            check=True,
        )
        subprocess.run(["/bin/bash"], input=ps.stdout, capture_output=True)
        subprocess.run(
            [
                "sudo",
                "usermod",
                "-aG",
                "docker",
                str(os.getenv("USER")),
            ],
            check=True,
        )
        cprint("Waiting Docker to start", level=3)
        time.sleep(10)
        subprocess.run(
            [
                "sudo",
                "systemctl",
                "restart",
                "docker.service",
            ],
            check=True,
        )
    except Exception as e:
        logging.error("Installing Docker failed", exc_info=True)
        cprint("Failed to Install Docker\n", e)
        cprint("\n Try Installing Docker Manually and re-run this script again\n")
        sys.exit(1)


def install_container_runtime(runtime="docker"):
    if which(runtime) is not None:
        cprint(runtime.title() + " is already installed", level=2)
        return
    if runtime == "docker":
        install_docker()


def create_site(
    sitename: str,
    project: str,
    db_pass: str,
    admin_pass: str,
    apps: List[str] = [],
):
    apps = apps or []
    cprint(f"\nCreating site: {sitename} \n", level=3)
    command = [
        "docker",
        "compose",
        "-p",
        project,
        "exec",
        "backend",
        "bench",
        "new-site",
        "--no-mariadb-socket",
        f"--db-root-password={db_pass}",
        f"--admin-password={admin_pass}",
    ]

    for app in apps:
        command.append("--install-app")
        command.append(app)

    command.append(sitename)

    try:
        subprocess.run(
            command,
            check=True,
        )
        logging.info("New site creation completed")
    except Exception as e:
        logging.error(f"Bench site creation failed for {sitename}", exc_info=True)
        cprint(f"Bench Site creation failed for {sitename}\n", e)


def migrate_site(project: str):
    cprint(f"\nMigrating sites for {project}", level=3)

    exec_command(
        project=project,
        command=[
            "bench",
            "--site",
            "all",
            "migrate",
        ],
    )


def exec_command(project: str, command: List[str] = [], interactive_terminal=False):
    if not command:
        command = ["echo", '"Please execute a command"']

    cprint(f"\nExecuting Command:\n{' '.join(command)}", level=3)
    exec_command = [
        "docker",
        "compose",
        "-p",
        project,
        "exec",
    ]

    if interactive_terminal:
        exec_command.append("-it")

    exec_command.append("backend")
    exec_command += command

    try:
        subprocess.run(
            exec_command,
            check=True,
        )
        logging.info("New site creation completed")
    except Exception as e:
        logging.error(f"Exec command failed for {project}", exc_info=True)
        cprint(f"Exec command failed for {project}\n", e)


def add_project_option(parser: argparse.ArgumentParser):
    parser.add_argument(
        "-n",
        "--project",
        help="Project Name",
        default="frappe",
    )
    return parser


def add_setup_options(parser: argparse.ArgumentParser):
    parser.add_argument(
        "-a",
        "--app",
        dest="apps",
        default=[],
        help="list of app(s) to be installed",
        action="append",
    )
    parser.add_argument(
        "-s",
        "--sitename",
        help="Site Name(s) for your production bench",
        default=[],
        action="append",
        dest="sites",
    )
    parser.add_argument("-e", "--email", help="Add email for the SSL.")

    return parser


def add_common_parser(parser: argparse.ArgumentParser):
    parser = add_project_option(parser)
    parser.add_argument(
        "-g",
        "--backup-schedule",
        help='Backup schedule cronstring, default: "@every 6h"',
        default="@every 6h",
    )
    parser.add_argument("-i", "--image", help="Full Image Name")
    parser.add_argument(
        "-m", "--http-port", help="Http port in case of no-ssl", default="8080"
    )
    parser.add_argument("-q", "--no-ssl", action="store_true", help="No https")
    parser.add_argument(
        "-v",
        "--version",
        help="ERPNext or image version to install, defaults to latest stable",
    )
    parser.add_argument(
        "-l",
        "--force-pull",
        action="store_true",
        help="Force pull frappe_docker",
    )
    return parser


def add_build_parser(subparsers: argparse.ArgumentParser):
    parser = subparsers.add_parser("build", help="Build custom images")
    parser = add_common_parser(parser)
    parser = add_setup_options(parser)
    parser.add_argument(
        "-p",
        "--push",
        help="Push the built image to registry",
        action="store_true",
    )
    parser.add_argument(
        "-r",
        "--frappe-path",
        help="Frappe Repository to use, default: https://github.com/frappe/frappe",
        default="https://github.com/frappe/frappe",
    )
    parser.add_argument(
        "-b",
        "--frappe-branch",
        help="Frappe branch to use, default: version-15",
        default="version-15",
    )
    parser.add_argument(
        "-j",
        "--apps-json",
        help="Path to apps json, default: frappe_docker/development/apps-example.json",
        default="frappe_docker/development/apps-example.json",
    )
    parser.add_argument(
        "-t",
        "--tag",
        dest="tags",
        help="Full Image Name(s), default: custom-apps:latest",
        action="append",
    )
    parser.add_argument(
        "-c",
        "--containerfile",
        help="Path to Containerfile: images/custom/Containerfile",
        default="images/custom/Containerfile",
    )
    parser.add_argument(
        "-y",
        "--python-version",
        help="Python Version, default: 3.11.6",
        default="3.11.6",
    )
    parser.add_argument(
        "-d",
        "--node-version",
        help="NodeJS Version, default: 18.18.2",
        default="18.18.2",
    )
    parser.add_argument(
        "-x",
        "--deploy",
        help="Deploy after build",
        action="store_true",
    )
    parser.add_argument(
        "-u",
        "--upgrade",
        help="Upgrade after build",
        action="store_true",
    )


def add_deploy_parser(subparsers: argparse.ArgumentParser):
    parser = subparsers.add_parser("deploy", help="Deploy using compose")
    parser = add_common_parser(parser)
    parser = add_setup_options(parser)


def add_develop_parser(subparsers: argparse.ArgumentParser):
    parser = subparsers.add_parser("develop", help="Development setup using compose")
    parser.add_argument(
        "-n", "--project", default="frappe", help="Compose project name"
    )


def add_upgrade_parser(subparsers: argparse.ArgumentParser):
    parser = subparsers.add_parser("upgrade", help="Upgrade existing project")
    parser = add_common_parser(parser)


def add_exec_parser(subparsers: argparse.ArgumentParser):
    parser = subparsers.add_parser("exec", help="Exec into existing project")
    parser = add_project_option(parser)


def build_image(
    push: bool,
    frappe_path: str,
    frappe_branch: str,
    containerfile_path: str,
    apps_json_path: str,
    tags: List[str],
    python_version: str,
    node_version: str,
):
    if not check_repo_exists():
        clone_frappe_docker_repo()
    install_container_runtime()

    if not tags:
        tags = ["custom-apps:latest"]

    apps_json_base64 = None
    try:
        with open(apps_json_path, "rb") as file_text:
            file_read = file_text.read()
            apps_json_base64 = (
                base64.encodebytes(file_read).decode("utf-8").replace("\n", "")
            )
    except Exception as e:
        logging.error("Unable to base64 encode apps.json", exc_info=True)
        cprint("\nUnable to base64 encode apps.json\n\n", "[ERROR]: ", e, level=1)

    command = [
        which("docker"),
        "build",
        "--progress=plain",
    ]

    for tag in tags:
        command.append(f"--tag={tag}")

    command += [
        f"--file={containerfile_path}",
        f"--build-arg=FRAPPE_PATH={frappe_path}",
        f"--build-arg=FRAPPE_BRANCH={frappe_branch}",
        f"--build-arg=PYTHON_VERSION={python_version}",
        f"--build-arg=NODE_VERSION={node_version}",
        f"--build-arg=APPS_JSON_BASE64={apps_json_base64}",
        ".",
    ]

    try:
        subprocess.run(
            command,
            check=True,
            cwd="frappe_docker",
        )
    except Exception as e:
        logging.error("Image build failed", exc_info=True)
        cprint("\nImage build failed\n\n", "[ERROR]: ", e, level=1)

    if push:
        try:
            for tag in tags:
                subprocess.run(
                    [which("docker"), "push", tag],
                    check=True,
                )
        except Exception as e:
            logging.error("Image push failed", exc_info=True)
            cprint("\nImage push failed\n\n", "[ERROR]: ", e, level=1)


def get_args_parser():
    parser = argparse.ArgumentParser(
        description="Easy install script for Frappe Framework"
    )
    # Setup sub-commands
    subparsers = parser.add_subparsers(dest="subcommand")
    # Build command
    add_build_parser(subparsers)
    # Deploy command
    add_deploy_parser(subparsers)
    # Upgrade command
    add_upgrade_parser(subparsers)
    # Develop command
    add_develop_parser(subparsers)
    # Exec command
    add_exec_parser(subparsers)

    return parser


if __name__ == "__main__":
    parser = get_args_parser()
    if len(sys.argv) == 1:
        parser.print_help(sys.stderr)
        sys.exit(1)

    args = parser.parse_args()

    if (
        args.subcommand != "exec"
        and args.force_pull
        and os.path.exists(get_frappe_docker_path())
    ):
        cprint("\nForce pull frappe_docker again\n", level=2)
        shutil.rmtree(get_frappe_docker_path(), ignore_errors=True)

    if args.subcommand == "build":
        build_image(
            push=args.push,
            frappe_path=args.frappe_path,
            frappe_branch=args.frappe_branch,
            apps_json_path=args.apps_json,
            tags=args.tags,
            containerfile_path=args.containerfile,
            python_version=args.python_version,
            node_version=args.node_version,
        )
        if args.deploy:
            setup_prod(
                project=args.project,
                sites=args.sites,
                email=args.email,
                cronstring=args.backup_schedule,
                version=args.version,
                image=args.image,
                apps=args.apps,
                is_https=not args.no_ssl,
                http_port=args.http_port,
            )
        elif args.upgrade:
            update_prod(
                project=args.project,
                version=args.version,
                image=args.image,
                cronstring=args.backup_schedule,
                is_https=not args.no_ssl,
                http_port=args.http_port,
            )

    elif args.subcommand == "deploy":
        cprint("\nSetting Up Production Instance\n", level=2)
        logging.info("Running Production Setup")
        if args.email and "example.com" in args.email:
            cprint("Emails with example.com not acceptable", level=1)
            sys.exit(1)
        setup_prod(
            project=args.project,
            sites=args.sites,
            email=args.email,
            version=args.version,
            cronstring=args.backup_schedule,
            image=args.image,
            apps=args.apps,
            is_https=not args.no_ssl,
            http_port=args.http_port,
        )
    elif args.subcommand == "develop":
        cprint("\nSetting Up Development Instance\n", level=2)
        logging.info("Running Development Setup")
        setup_dev_instance(args.project)
    elif args.subcommand == "upgrade":
        cprint("\nUpgrading Production Instance\n", level=2)
        logging.info("Upgrading Development Setup")
        update_prod(
            project=args.project,
            version=args.version,
            image=args.image,
            is_https=not args.no_ssl,
            cronstring=args.backup_schedule,
            http_port=args.http_port,
        )
    elif args.subcommand == "exec":
        cprint(f"\nExec into {args.project} backend\n", level=2)
        logging.info(f"Exec into {args.project} backend")
        exec_command(
            project=args.project,
            command=["bash"],
            interactive_terminal=True,
        )
