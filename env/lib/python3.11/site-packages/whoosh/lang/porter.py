"""
Reimplementation of the
`Porter stemming algorithm <http://tartarus.org/~martin/PorterStemmer/>`_
in Python.

In my quick tests, this implementation about 3.5 times faster than the
seriously weird Python linked from the official page.
"""

import re

# Suffix replacement lists

_step2list = {
              "ational": "ate",
              "tional": "tion",
              "enci": "ence",
              "anci": "ance",
              "izer": "ize",
              "bli": "ble",
              "alli": "al",
              "entli": "ent",
              "eli": "e",
              "ousli": "ous",
              "ization": "ize",
              "ation": "ate",
              "ator": "ate",
              "alism": "al",
              "iveness": "ive",
              "fulness": "ful",
              "ousness": "ous",
              "aliti": "al",
              "iviti": "ive",
              "biliti": "ble",
              "logi": "log",
              }

_step3list = {
              "icate": "ic",
              "ative": "",
              "alize": "al",
              "iciti": "ic",
              "ical": "ic",
              "ful": "",
              "ness": "",
              }


_cons = "[^aeiou]"
_vowel = "[aeiouy]"
_cons_seq = "[^aeiouy]+"
_vowel_seq = "[aeiou]+"

# m > 0
_mgr0 = re.compile("^(" + _cons_seq + ")?" + _vowel_seq + _cons_seq)
# m == 0
_meq1 = re.compile("^(" + _cons_seq + ")?" + _vowel_seq + _cons_seq + "(" + _vowel_seq + ")?$")
# m > 1
_mgr1 = re.compile("^(" + _cons_seq + ")?" + _vowel_seq + _cons_seq + _vowel_seq + _cons_seq)
# vowel in stem
_s_v = re.compile("^(" + _cons_seq + ")?" + _vowel)
# ???
_c_v = re.compile("^" + _cons_seq + _vowel + "[^aeiouwxy]$")

# Patterns used in the rules

_ed_ing = re.compile("^(.*)(ed|ing)$")
_at_bl_iz = re.compile("(at|bl|iz)$")
_step1b = re.compile("([^aeiouylsz])\\1$")
_step2 = re.compile("^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$")
_step3 = re.compile("^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$")
_step4_1 = re.compile("^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$")
_step4_2 = re.compile("^(.+?)(s|t)(ion)$")
_step5 = re.compile("^(.+?)e$")


# Stemming function

def stem(w):
    """Uses the Porter stemming algorithm to remove suffixes from English
    words.

    >>> stem("fundamentally")
    "fundament"
    """

    if len(w) < 3:
        return w

    first_is_y = w[0] == "y"
    if first_is_y:
        w = "Y" + w[1:]

    # Step 1a
    if w.endswith("s"):
        if w.endswith("sses"):
            w = w[:-2]
        elif w.endswith("ies"):
            w = w[:-2]
        elif w[-2] != "s":
            w = w[:-1]

    # Step 1b

    if w.endswith("eed"):
        s = w[:-3]
        if _mgr0.match(s):
            w = w[:-1]
    else:
        m = _ed_ing.match(w)
        if m:
            stem = m.group(1)
            if _s_v.match(stem):
                w = stem
                if _at_bl_iz.match(w):
                    w += "e"
                elif _step1b.match(w):
                    w = w[:-1]
                elif _c_v.match(w):
                    w += "e"

    # Step 1c

    if w.endswith("y"):
        stem = w[:-1]
        if _s_v.match(stem):
            w = stem + "i"

    # Step 2

    m = _step2.match(w)
    if m:
        stem = m.group(1)
        suffix = m.group(2)
        if _mgr0.match(stem):
            w = stem + _step2list[suffix]

    # Step 3

    m = _step3.match(w)
    if m:
        stem = m.group(1)
        suffix = m.group(2)
        if _mgr0.match(stem):
            w = stem + _step3list[suffix]

    # Step 4

    m = _step4_1.match(w)
    if m:
        stem = m.group(1)
        if _mgr1.match(stem):
            w = stem
    else:
        m = _step4_2.match(w)
        if m:
            stem = m.group(1) + m.group(2)
            if _mgr1.match(stem):
                w = stem

    # Step 5

    m = _step5.match(w)
    if m:
        stem = m.group(1)
        if _mgr1.match(stem) or (_meq1.match(stem) and not _c_v.match(stem)):
            w = stem

    if w.endswith("ll") and _mgr1.match(w):
        w = w[:-1]

    if first_is_y:
        w = "y" + w[1:]

    return w
