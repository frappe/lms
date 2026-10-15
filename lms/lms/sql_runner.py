"""Runs a learner's SQL against an exercise's test cases on a separate MariaDB
sandbox, never on the site's own database.

Each run gets a throwaway database and a user that can only touch it. The
exercise's setup SQL and the case's input (extra seed rows) run first as that
user, then the learner's code; the last result set is the output. The database
and user are dropped afterwards, whatever happened.

The sandbox is configured in site_config.json:
	sql_sandbox_host, sql_sandbox_port, sql_sandbox_root_password"""

import secrets
from contextlib import contextmanager

import frappe
import MySQLdb
from frappe import _
from MySQLdb.constants import CLIENT

STATEMENT_TIMEOUT = 5  # seconds, the scratch user's MAX_STATEMENT_TIME
READ_TIMEOUT = 15  # seconds, a backstop for statements max_statement_time misses
MAX_ROWS = 1000
MAX_OUTPUT = 64 * 1024
PREVIEW_ROWS = 50

GRANTS = (
	"SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, "
	"CREATE VIEW, SHOW VIEW, CREATE TEMPORARY TABLES"
)


class SandboxUnavailable(Exception):
	pass


def run_test_cases(doc, code: str) -> list[str]:
	"""Return each case's output, in the order of `doc.test_cases`. A run that
	errored has no output, as on the exercise page, which shows the error in its
	console; the output column is always a result table or empty."""
	outputs = []
	for case in doc.test_cases:
		stdout, stderr = run_sql_or_throw(doc.sql_setup, case.input, code, doc.sql_ordered)
		outputs.append("" if stderr else stdout)
	return outputs


def run_sql_or_throw(setup: str | None, seed: str | None, code: str, ordered) -> tuple[str, str]:
	try:
		return run_sql(setup, seed, code, bool(ordered))
	except SandboxUnavailable:
		frappe.throw(_("The SQL sandbox could not be reached, so nothing was run. Please try again."))


def run_sql(setup: str | None, seed: str | None, code: str, ordered: bool) -> tuple[str, str]:
	"""Return (stdout, stderr). A mistake in the learner's SQL is reported in
	stderr; only a sandbox that cannot be reached raises."""
	with _scratch() as learner:
		error = _run_setup(learner, setup, seed)
		if error:
			return "", _("Exercise setup failed: {0}").format(error)
		return _run_learner_code(learner, code, ordered)


def describe_tables(setup: str | None) -> list[dict]:
	"""The tables the exercise's setup creates, each with its rows (up to
	PREVIEW_ROWS), for the exercise page to show learners as tables."""
	with _scratch() as conn:
		error = _run_setup(conn, setup, None)
		if error:
			frappe.throw(_("Exercise setup failed: {0}").format(error))
		with conn.cursor() as cursor:
			cursor.execute("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")
			names = [row[0] for row in cursor.fetchall()]
			tables = []
			for name in names:
				quoted = name.replace("`", "``")
				cursor.execute(f"SELECT COUNT(*) FROM `{quoted}`")
				total = cursor.fetchone()[0]
				cursor.execute(f"SELECT * FROM `{quoted}` LIMIT {PREVIEW_ROWS}")
				tables.append(
					{
						"name": name,
						"columns": [column[0] for column in cursor.description],
						"rows": [[_cell(value) for value in row] for row in cursor.fetchall()],
						"total": total,
					}
				)
			return tables


@contextmanager
def _scratch():
	"""Yield a connection, as a throwaway user, to a throwaway database; both are
	dropped on the way out."""
	name = f"sqlx_{secrets.token_hex(8)}"
	password = secrets.token_urlsafe(24)

	admin = _admin_connection()
	try:
		_create_scratch(admin, name, password)
		try:
			conn = _connect(name, password, name)
		except MySQLdb.Error as e:
			raise SandboxUnavailable from e
		try:
			yield conn
		finally:
			_close(conn)
	finally:
		_drop_scratch(admin, name)
		_close(admin)


def _sandbox_settings() -> dict:
	password = frappe.conf.get("sql_sandbox_root_password")
	if not password:
		frappe.throw(_("The SQL sandbox is not configured on this site."))
	return {
		"host": frappe.conf.get("sql_sandbox_host") or "sql-sandbox",
		"port": int(frappe.conf.get("sql_sandbox_port") or 3306),
		"password": password,
	}


def _connect(user: str, password: str, db: str | None = None):
	settings = _sandbox_settings()
	kwargs = {
		"host": settings["host"],
		"port": settings["port"],
		"user": user,
		"passwd": password,
		"charset": "utf8mb4",
		"client_flag": CLIENT.MULTI_STATEMENTS,
		"connect_timeout": 5,
		"read_timeout": READ_TIMEOUT,
		"autocommit": True,
	}
	if db:
		kwargs["db"] = db
	return MySQLdb.connect(**kwargs)


def _admin_connection():
	try:
		return _connect("root", _sandbox_settings()["password"])
	except MySQLdb.Error as e:
		raise SandboxUnavailable from e


def _create_scratch(admin, name: str, password: str):
	try:
		with admin.cursor() as cursor:
			cursor.execute(f"CREATE DATABASE `{name}`")
			cursor.execute(
				f"CREATE USER '{name}'@'%%' IDENTIFIED BY %s"
				f" WITH MAX_USER_CONNECTIONS 1 MAX_STATEMENT_TIME {STATEMENT_TIMEOUT}",
				(password,),
			)
			cursor.execute(f"GRANT {GRANTS} ON `{name}`.* TO '{name}'@'%'")
	except MySQLdb.Error as e:
		raise SandboxUnavailable from e


def _drop_scratch(admin, name: str):
	"""Kill whatever the scratch user still runs (a timed-out query would otherwise
	hold locks on the database), then drop the database and the user."""
	try:
		with admin.cursor() as cursor:
			cursor.execute("SELECT id FROM information_schema.processlist WHERE user = %s", (name,))
			for (process_id,) in cursor.fetchall():
				try:
					cursor.execute(f"KILL {int(process_id)}")
				except MySQLdb.Error:
					pass
			cursor.execute(f"DROP DATABASE IF EXISTS `{name}`")
			cursor.execute(f"DROP USER IF EXISTS '{name}'@'%'")
	except MySQLdb.Error:
		frappe.log_error(title="SQL sandbox cleanup failed", message=name)


def _run_setup(conn, setup: str | None, seed: str | None) -> str | None:
	for script in (setup, seed):
		if not (script or "").strip():
			continue
		try:
			with conn.cursor() as cursor:
				cursor.execute(script)
				_drain(cursor)
		except MySQLdb.Error as e:
			return _error_text(e)
	return None


def _run_learner_code(conn, code: str, ordered: bool) -> tuple[str, str]:
	if not (code or "").strip():
		return "", _("Write a query to run.")
	try:
		with conn.cursor() as cursor:
			cursor.execute(code)
			columns, rows, truncated = None, [], False
			while True:
				if cursor.description:
					columns = [column[0] for column in cursor.description]
					rows = list(cursor.fetchmany(MAX_ROWS + 1))
					truncated = len(rows) > MAX_ROWS
					rows = rows[:MAX_ROWS]
				if not cursor.nextset():
					break
	except MySQLdb.OperationalError as e:
		if e.args and e.args[0] in (2013, 2006):
			return "", _("Your query took too long and was stopped.")
		return "", _error_text(e)
	except MySQLdb.Error as e:
		return "", _error_text(e)

	if columns is None:
		return "", _("Your SQL ran but returned no result. End it with a SELECT.")
	if truncated:
		return "", _("Your query returned more than {0} rows.").format(MAX_ROWS)

	output = format_result(columns, rows, ordered)
	if len(output) > MAX_OUTPUT:
		return "", _("Your query's result is too large.")
	return output, ""


def _close(conn):
	try:
		conn.close()
	except MySQLdb.Error:
		pass


def _drain(cursor):
	while True:
		if cursor.description:
			cursor.fetchall()
		if not cursor.nextset():
			break


def format_result(columns: list[str], rows: list, ordered: bool) -> str:
	"""A header line of column names, then one tab-separated line per row. Without
	`ordered` the rows are sorted, so a correct query need not use ORDER BY."""
	lines = ["\t".join(_cell(value) for value in row) for row in rows]
	if not ordered:
		lines.sort()
	return "\n".join(["\t".join(columns), *lines])


def _cell(value) -> str:
	if value is None:
		return "NULL"
	if isinstance(value, bytes | bytearray):
		return value.decode("utf-8", errors="replace")
	return str(value)


def _hint(code: int) -> str | None:
	"""A plain-language hint for mistakes learners new to SQL make, shown under
	MariaDB's own message."""
	if code == 1050:
		return _("The tables are already created for you. Write only the query that answers the question.")
	if code in (1044, 1142):
		return _("You can only read and change the tables of this exercise.")
	return None


def _error_text(error: MySQLdb.Error) -> str:
	if len(error.args) < 2:
		return str(error)
	text = f"ERROR {error.args[0]}: {error.args[1]}"
	hint = _hint(error.args[0])
	return f"{text}\n{hint}" if hint else text
