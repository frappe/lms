"""An implementation of the Porter2 stemming algorithm.
See http://snowball.tartarus.org/algorithms/english/stemmer.html

Adapted from pyporter2 by Michael Dirolf.

This algorithm is more correct but (at least in this implementation)
several times slower than the original porter algorithm as implemented
in stemming.porter.
"""

import re

r_exp = re.compile(r"[^aeiouy]*[aeiouy]+[^aeiouy](\w*)")
ewss_exp1 = re.compile(r"^[aeiouy][^aeiouy]$")
ewss_exp2 = re.compile(r".*[^aeiouy][aeiouy][^aeiouywxY]$")
ccy_exp = re.compile(r"([aeiouy])y")
s1a_exp = re.compile(r"[aeiouy].")
s1b_exp = re.compile(r"[aeiouy]")


def get_r1(word):
    # exceptional forms
    if word.startswith('gener') or word.startswith('arsen'):
        return 5
    if word.startswith('commun'):
        return 6

    # normal form
    match = r_exp.match(word)
    if match:
        return match.start(1)
    return len(word)


def get_r2(word):
    match = r_exp.match(word, get_r1(word))
    if match:
        return match.start(1)
    return len(word)


def ends_with_short_syllable(word):
    if len(word) == 2:
        if ewss_exp1.match(word):
            return True
    if ewss_exp2.match(word):
        return True
    return False


def is_short_word(word):
    if ends_with_short_syllable(word):
        if get_r1(word) == len(word):
            return True
    return False


def remove_initial_apostrophe(word):
    if word.startswith("'"):
        return word[1:]
    return word


def capitalize_consonant_ys(word):
    if word.startswith('y'):
        word = 'Y' + word[1:]
    return ccy_exp.sub('\g<1>Y', word)


def step_0(word):
    if word.endswith("'s'"):
        return word[:-3]
    if word.endswith("'s"):
        return word[:-2]
    if word.endswith("'"):
        return word[:-1]
    return word


def step_1a(word):
    if word.endswith('sses'):
        return word[:-4] + 'ss'
    if word.endswith('ied') or word.endswith('ies'):
        if len(word) > 4:
            return word[:-3] + 'i'
        else:
            return word[:-3] + 'ie'
    if word.endswith('us') or word.endswith('ss'):
        return word
    if word.endswith('s'):
        preceding = word[:-1]
        if s1a_exp.search(preceding):
            return preceding
        return word
    return word


doubles = ('bb', 'dd', 'ff', 'gg', 'mm', 'nn', 'pp', 'rr', 'tt')


def ends_with_double(word):
    for double in doubles:
        if word.endswith(double):
            return True
    return False


def step_1b_helper(word):
    if word.endswith('at') or word.endswith('bl') or word.endswith('iz'):
        return word + 'e'
    if ends_with_double(word):
        return word[:-1]
    if is_short_word(word):
        return word + 'e'
    return word


s1b_suffixes = ('ed', 'edly', 'ing', 'ingly')


def step_1b(word, r1):
    if word.endswith('eedly'):
        if len(word) - 5 >= r1:
            return word[:-3]
        return word
    if word.endswith('eed'):
        if len(word) - 3 >= r1:
            return word[:-1]
        return word

    for suffix in s1b_suffixes:
        if word.endswith(suffix):
            preceding = word[:-len(suffix)]
            if s1b_exp.search(preceding):
                return step_1b_helper(preceding)
            return word

    return word


def step_1c(word):
    if word.endswith('y') or word.endswith('Y') and len(word) > 1:
        if word[-2] not in 'aeiouy':
            if len(word) > 2:
                return word[:-1] + 'i'
    return word


def step_2_helper(word, r1, end, repl, prev):
        if word.endswith(end):
            if len(word) - len(end) >= r1:
                if prev == []:
                    return word[:-len(end)] + repl
                for p in prev:
                    if word[:-len(end)].endswith(p):
                        return word[:-len(end)] + repl
            return word
        return None


s2_triples = (('ization', 'ize', []),
               ('ational', 'ate', []),
               ('fulness', 'ful', []),
               ('ousness', 'ous', []),
               ('iveness', 'ive', []),
               ('tional', 'tion', []),
               ('biliti', 'ble', []),
               ('lessli', 'less', []),
               ('entli', 'ent', []),
               ('ation', 'ate', []),
               ('alism', 'al', []),
               ('aliti', 'al', []),
               ('ousli', 'ous', []),
               ('iviti', 'ive', []),
               ('fulli', 'ful', []),
               ('enci', 'ence', []),
               ('anci', 'ance', []),
               ('abli', 'able', []),
               ('izer', 'ize', []),
               ('ator', 'ate', []),
               ('alli', 'al', []),
               ('bli', 'ble', []),
               ('ogi', 'og', ['l']),
               ('li', '', ['c', 'd', 'e', 'g', 'h', 'k', 'm', 'n', 'r', 't']))


def step_2(word, r1):
    for trip in s2_triples:
        attempt = step_2_helper(word, r1, trip[0], trip[1], trip[2])
        if attempt:
            return attempt
    return word


def step_3_helper(word, r1, r2, end, repl, r2_necessary):
    if word.endswith(end):
        if len(word) - len(end) >= r1:
            if not r2_necessary:
                return word[:-len(end)] + repl
            else:
                if len(word) - len(end) >= r2:
                    return word[:-len(end)] + repl
        return word
    return None


s3_triples = (('ational', 'ate', False),
               ('tional', 'tion', False),
               ('alize', 'al', False),
               ('icate', 'ic', False),
               ('iciti', 'ic', False),
               ('ative', '', True),
               ('ical', 'ic', False),
               ('ness', '', False),
               ('ful', '', False))


def step_3(word, r1, r2):
    for trip in s3_triples:
        attempt = step_3_helper(word, r1, r2, trip[0], trip[1], trip[2])
        if attempt:
            return attempt
    return word


s4_delete_list = ('al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement',
                  'ment', 'ent', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize')


def step_4(word, r2):
    for end in s4_delete_list:
        if word.endswith(end):
            if len(word) - len(end) >= r2:
                return word[:-len(end)]
            return word

    if word.endswith('sion') or word.endswith('tion'):
        if len(word) - 3 >= r2:
            return word[:-3]

    return word


def step_5(word, r1, r2):
    if word.endswith('l'):
        if len(word) - 1 >= r2 and word[-2] == 'l':
            return word[:-1]
        return word

    if word.endswith('e'):
        if len(word) - 1 >= r2:
            return word[:-1]
        if len(word) - 1 >= r1 and not ends_with_short_syllable(word[:-1]):
            return word[:-1]

    return word


def normalize_ys(word):
    return word.replace('Y', 'y')


exceptional_forms = {'skis': 'ski',
                    'skies': 'sky',
                    'dying': 'die',
                    'lying': 'lie',
                    'tying': 'tie',
                    'idly': 'idl',
                    'gently': 'gentl',
                    'ugly': 'ugli',
                    'early': 'earli',
                    'only': 'onli',
                    'singly': 'singl',
                    'sky': 'sky',
                    'news': 'news',
                    'howe': 'howe',
                    'atlas': 'atlas',
                    'cosmos': 'cosmos',
                    'bias': 'bias',
                    'andes': 'andes'}

exceptional_early_exit_post_1a = frozenset(['inning', 'outing', 'canning', 'herring',
                                            'earring', 'proceed', 'exceed', 'succeed'])


def stem(word):
    if len(word) <= 2:
        return word
    word = remove_initial_apostrophe(word)

    # handle some exceptional forms
    if word in exceptional_forms:
        return exceptional_forms[word]

    word = capitalize_consonant_ys(word)
    r1 = get_r1(word)
    r2 = get_r2(word)
    word = step_0(word)
    word = step_1a(word)

    # handle some more exceptional forms
    if word in exceptional_early_exit_post_1a:
        return word

    word = step_1b(word, r1)
    word = step_1c(word)
    word = step_2(word, r1)
    word = step_3(word, r1, r2)
    word = step_4(word, r2)
    word = step_5(word, r1, r2)
    word = normalize_ys(word)

    return word
