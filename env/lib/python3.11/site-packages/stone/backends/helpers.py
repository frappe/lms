import re

_split_words_capitalization_re = re.compile(
    '^[a-z0-9]+|[A-Z][a-z0-9]+|[A-Z]+(?=[A-Z][a-z0-9])|[A-Z]+$'
)
_split_words_dashes_re = re.compile('[-_/]+')


def split_words(name):
    """
    Splits name based on capitalization, dashes, and underscores.
        Example: 'GetFile' -> ['Get', 'File']
        Example: 'get_file' -> ['get', 'file']
    """
    all_words = []
    for word in re.split(_split_words_dashes_re, name):
        vals = _split_words_capitalization_re.findall(word)
        if vals:
            all_words.extend(vals)
        else:
            all_words.append(word)
    return all_words


def fmt_camel(name):
    """
    Converts name to lower camel case. Words are identified by capitalization,
    dashes, and underscores.
    """
    words = split_words(name)
    assert len(words) > 0
    first = words.pop(0).lower()
    return first + ''.join([word.capitalize() for word in words])


def fmt_dashes(name):
    """
    Converts name to words separated by dashes. Words are identified by
    capitalization, dashes, and underscores.
    """
    return '-'.join([word.lower() for word in split_words(name)])


def fmt_pascal(name):
    """
    Converts name to pascal case. Words are identified by capitalization,
    dashes, and underscores.
    """
    return ''.join([word.capitalize() for word in split_words(name)])


def fmt_underscores(name):
    """
    Converts name to words separated by underscores. Words are identified by
    capitalization, dashes, and underscores.
    """
    return '_'.join([word.lower() for word in split_words(name)])
