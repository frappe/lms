#encoding: utf-8

"""
This module contains quasi-phonetic encoders for words in different languages.
"""

import re

from whoosh.compat import iteritems

# This soundex implementation is adapted from the recipe here:
# http://code.activestate.com/recipes/52213/

english_codes = '01230120022455012623010202'


def soundex_en(word):
    # digits holds the soundex values for the alphabet
    r = ""
    if word:
        # Remember first character
        fc = None
        prevcode = None
        for char in word.lower():
            c = ord(char)
            if c >= 97 and c <= 122:  # a-z
                if not fc:
                    fc = char
                code = english_codes[c - 97]
                # Don't append the code if it's the same as the previous
                if code != prevcode:
                    r += code
                prevcode = code

        # Replace first digit with first alpha character
        r = fc + r[1:]

    return r


# Quasi-phonetic coder for Spanish, translated to Python from Sebastian
# Ferreyra's version here:
# http://www.javalobby.org/java/forums/t16936.html

_esp_codes = (("\\Aw?[uh]?([aeiou])", ""),
              ("c[eiéí]|z|ll|sh|ch|sch|cc|y[aeiouáéíóú]|ps|bs|x|j|g[eiéí]", "s"),
              ("[aeiouhwáéíóúü]+", ""),
              ("y", ""),
              ("ñ|gn", "n"),
              ("[dpc]t", "t"),
              ("c[aouáóú]|ck|q", "k"),
              ("v", "b"),
              ("d$", "t"), # Change a trailing d to a t
              )
_esp_codes = tuple((re.compile(pat), repl) for pat, repl in _esp_codes)


def soundex_esp(word):
    word = word.lower()
    r = ""

    prevcode = None
    i = 0
    while i < len(word):
        code = None
        for expr, ecode in _esp_codes:
            match = expr.match(word, i)
            if match:
                i = match.end()
                code = ecode
                break

        if code is None:
            code = word[i]
            i += 1

        if code != prevcode:
            r += code
        prevcode = code

    return r


# This version of soundex for Arabic is translated to Python from Tammam
# Koujan's C# version here:
# http://www.codeproject.com/KB/recipes/ArabicSoundex.aspx

# Create a dictionary mapping arabic characters to digits
_arabic_codes = {}
for chars, code in iteritems({'\u0627\u0623\u0625\u0622\u062d\u062e\u0647\u0639\u063a\u0634\u0648\u064a': "0",
                    '\u0641\u0628': "1",
                    '\u062c\u0632\u0633\u0635\u0638\u0642\u0643': "2",
                    '\u062a\u062b\u062f\u0630\u0636\u0637': "3",
                    '\u0644': "4",
                    '\u0645\u0646': "5",
                    '\u0631': "6",
                    }):
    for char in chars:
        _arabic_codes[char] = code


def soundex_ar(word):
    if word[0] in "\u0627\u0623\u0625\u0622":
        word = word[1:]

    r = "0"
    prevcode = "0"
    if len(word) > 1:
        # Discard the first character
        for char in word[1:]:
            if char in _arabic_codes:
                code = _arabic_codes.get(char, "0")
            # Don't append the code if it's the same as the previous
            if code != prevcode:
                # If the code is a 0 (vowel), don't process it
                if code != "0":
                    r += code
            prevcode = code
    return r
