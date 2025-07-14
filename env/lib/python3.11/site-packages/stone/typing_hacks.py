MYPY = False
if MYPY:
    from typing import cast  # noqa # pylint: disable=unused-import,useless-suppression,import-error
else:
    def cast(typ, obj):  # pylint: disable=unused-argument
        return obj
