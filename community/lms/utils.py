import re

RE_SLUG_NOTALLOWED = re.compile("[^a-z0-9]+")

def slugify(title, used_slugs=[]):
    """Converts title to a slug.

    If a list of used slugs is specified, it will make sure the generated slug
    is not one of them.

        >>> slugify("Hello World!")
        'hello-world'
        >>> slugify("Hello World!", ['hello-world'])
        'hello-world-2'
        >>> slugify("Hello World!", ['hello-world', 'hello-world-2'])
        'hello-world-3'
    """
    slug = RE_SLUG_NOTALLOWED.sub('-', title.lower()).strip('-')
    used_slugs = set(used_slugs)

    if slug not in used_slugs:
        return slug

    count = 2
    while True:
        new_slug = f"{slug}-{count}"
        if new_slug not in used_slugs:
            return new_slug
        count = count+1

