"""This module implements the Lovins stemming algorithm. Use the ``stem()``
function::

    stemmed_word = stem(word)
"""

from collections import defaultdict


# Conditions

def A(base):
    # A   No restrictions on stem
    return True


def B(base):
    # B  Minimum stem length = 3
    return len(base) > 2


def C(base):
    # C  Minimum stem length = 4
    return len(base) > 3


def D(base):
    # D  Minimum stem length = 5
    return len(base) > 4


def E(base):
    # E  Do not remove ending after e
    return base[-1] != "e"


def F(base):
    # F  Minimum stem length = 3 and do not remove ending after e
    return len(base) > 2 and base[-1] != "e"


def G(base):
    # G  Minimum stem length = 3 and remove ending only after f
    return len(base) > 2 and base[-1] == "f"


def H(base):
    # H  Remove ending only after t or ll
    c1, c2 = base[-2:]
    return c2 == "t" or (c2 == "l" and c1 == "l")


def I(base):
    # I  Do not remove ending after o or e
    c = base[-1]
    return c != "o" and c != "e"


def J(base):
    # J  Do not remove ending after a or e
    c = base[-1]
    return c != "a" and c != "e"


def K(base):
    # K  Minimum stem length = 3 and remove ending only after l, i or u*e
    c = base[-1]
    cc = base[-3]
    return len(base) > 2 and (c == "l" or c == "i" or (c == "e" and cc == "u"))


def L(base):
    # L  Do not remove ending after u, x or s, unless s follows o
    c1, c2 = base[-2:]
    return c2 != "u" and c2 != "x" and (c2 != "s" or c1 == "o")


def M(base):
    # M  Do not remove ending after a, c, e or m
    c = base[-1]
    return c != "a" and c != "c" and c != "e" and c != "m"


def N(base):
    # N  Minimum stem length = 4 after s**, elsewhere = 3
    return len(base) > 3 or (len(base) == 3 and base[-1] != "s")


def O(base):
    # O  Remove ending only after l or i
    c = base[-1]
    return c == "l" or c == "i"


def P(base):
    # P  Do not remove ending after c
    return base[-1] != "c"


def Q(base):
    # Q  Minimum stem length = 3 and do not remove ending after l or n
    c = base[-1]
    return len(base) > 2 and (c != "l" and c != "n")


def R(base):
    # R  Remove ending only after n or r
    c = base[-1]
    return c == "n" or c == "r"


def S(base):
    # S  Remove ending only after dr or t, unless t follows t
    l2 = base[-2]
    return l2 == "rd" or (base[-1] == "t" and l2 != "tt")


def T(base):
    # T  Remove ending only after s or t, unless t follows o
    c1, c2 = base[-2:]
    return c2 == "s" or (c2 == "t" and c1 != "o")


def U(base):
    # U  Remove ending only after l, m, n or r
    c = base[-1]
    return c == "l" or c == "m" or c == "n" or c == "r"


def V(base):
    # V  Remove ending only after c
    return base[-1] == "c"


def W(base):
    # W  Do not remove ending after s or u
    c = base[-1]
    return c != "s" and c != "u"


def X(base):
    # X  Remove ending only after l, i or u*e
    c = base[-1]
    cc = base[-3]
    return c == "l" or c == "i" or (c == "e" and cc == "u")


def Y(base):
    # Y  Remove ending only after in
    return base[-2:] == "in"


def Z(base):
    # Z  Do not remove ending after f
    return base[-1] != "f"


def a(base):
    # a  Remove ending only after d, f, ph, th, l, er, or, es or t
    c = base[-1]
    l2 = base[-2:]
    return (c == "d" or c == "f" or l2 == "ph" or l2 == "th" or c == "l"
            or l2 == "er" or l2 == "or" or l2 == "es" or c == "t")


def b(base):
    # b  Minimum stem length = 3 and do not remove ending after met or ryst
    return len(base) > 2 and not (base.endswith("met")
                                  or base.endswith("ryst"))


def c(base):
    # c  Remove ending only after l
    return base[-1] == "l"


# Endings

m = [None] * 12

m[11] = dict((
        ("alistically", B),
        ("arizability", A),
        ("izationally", B)))
m[10] = dict((
        ("antialness", A),
        ("arisations", A),
        ("arizations", A),
        ("entialness", A)))
m[9] = dict((
        ("allically", C),
        ("antaneous", A),
        ("antiality", A),
        ("arisation", A),
        ("arization", A),
        ("ationally", B),
        ("ativeness", A),
        ("eableness", E),
        ("entations", A),
        ("entiality", A),
        ("entialize", A),
        ("entiation", A),
        ("ionalness", A),
        ("istically", A),
        ("itousness", A),
        ("izability", A),
        ("izational", A)))
m[8] = dict((
        ("ableness", A),
        ("arizable", A),
        ("entation", A),
        ("entially", A),
        ("eousness", A),
        ("ibleness", A),
        ("icalness", A),
        ("ionalism", A),
        ("ionality", A),
        ("ionalize", A),
        ("iousness", A),
        ("izations", A),
        ("lessness", A)))
m[7] = dict((
        ("ability", A),
        ("aically", A),
        ("alistic", B),
        ("alities", A),
        ("ariness", E),
        ("aristic", A),
        ("arizing", A),
        ("ateness", A),
        ("atingly", A),
        ("ational", B),
        ("atively", A),
        ("ativism", A),
        ("elihood", E),
        ("encible", A),
        ("entally", A),
        ("entials", A),
        ("entiate", A),
        ("entness", A),
        ("fulness", A),
        ("ibility", A),
        ("icalism", A),
        ("icalist", A),
        ("icality", A),
        ("icalize", A),
        ("ication", G),
        ("icianry", A),
        ("ination", A),
        ("ingness", A),
        ("ionally", A),
        ("isation", A),
        ("ishness", A),
        ("istical", A),
        ("iteness", A),
        ("iveness", A),
        ("ivistic", A),
        ("ivities", A),
        ("ization", F),
        ("izement", A),
        ("oidally", A),
        ("ousness", A)))
m[6] = dict((
        ("aceous", A),
        ("acious", B),
        ("action", G),
        ("alness", A),
        ("ancial", A),
        ("ancies", A),
        ("ancing", B),
        ("ariser", A),
        ("arized", A),
        ("arizer", A),
        ("atable", A),
        ("ations", B),
        ("atives", A),
        ("eature", Z),
        ("efully", A),
        ("encies", A),
        ("encing", A),
        ("ential", A),
        ("enting", C),
        ("entist", A),
        ("eously", A),
        ("ialist", A),
        ("iality", A),
        ("ialize", A),
        ("ically", A),
        ("icance", A),
        ("icians", A),
        ("icists", A),
        ("ifully", A),
        ("ionals", A),
        ("ionate", D),
        ("ioning", A),
        ("ionist", A),
        ("iously", A),
        ("istics", A),
        ("izable", E),
        ("lessly", A),
        ("nesses", A),
        ("oidism", A)))
m[5] = dict((
        ("acies", A),
        ("acity", A),
        ("aging", B),
        ("aical", A),
        ("alist", A),
        ("alism", B),
        ("ality", A),
        ("alize", A),
        ("allic", b),
        ("anced", B),
        ("ances", B),
        ("antic", C),
        ("arial", A),
        ("aries", A),
        ("arily", A),
        ("arity", B),
        ("arize", A),
        ("aroid", A),
        ("ately", A),
        ("ating", I),
        ("ation", B),
        ("ative", A),
        ("ators", A),
        ("atory", A),
        ("ature", E),
        ("early", Y),
        ("ehood", A),
        ("eless", A),
        ("elily", A),
        ("ement", A),
        ("enced", A),
        ("ences", A),
        ("eness", E),
        ("ening", E),
        ("ental", A),
        ("ented", C),
        ("ently", A),
        ("fully", A),
        ("ially", A),
        ("icant", A),
        ("ician", A),
        ("icide", A),
        ("icism", A),
        ("icist", A),
        ("icity", A),
        ("idine", I),
        ("iedly", A),
        ("ihood", A),
        ("inate", A),
        ("iness", A),
        ("ingly", B),
        ("inism", J),
        ("inity", c),
        ("ional", A),
        ("ioned", A),
        ("ished", A),
        ("istic", A),
        ("ities", A),
        ("itous", A),
        ("ively", A),
        ("ivity", A),
        ("izers", F),
        ("izing", F),
        ("oidal", A),
        ("oides", A),
        ("otide", A),
        ("ously", A)))
m[4] = dict((
        ("able", A),
        ("ably", A),
        ("ages", B),
        ("ally", B),
        ("ance", B),
        ("ancy", B),
        ("ants", B),
        ("aric", A),
        ("arly", K),
        ("ated", I),
        ("ates", A),
        ("atic", B),
        ("ator", A),
        ("ealy", Y),
        ("edly", E),
        ("eful", A),
        ("eity", A),
        ("ence", A),
        ("ency", A),
        ("ened", E),
        ("enly", E),
        ("eous", A),
        ("hood", A),
        ("ials", A),
        ("ians", A),
        ("ible", A),
        ("ibly", A),
        ("ical", A),
        ("ides", L),
        ("iers", A),
        ("iful", A),
        ("ines", M),
        ("ings", N),
        ("ions", B),
        ("ious", A),
        ("isms", B),
        ("ists", A),
        ("itic", H),
        ("ized", F),
        ("izer", F),
        ("less", A),
        ("lily", A),
        ("ness", A),
        ("ogen", A),
        ("ward", A),
        ("wise", A),
        ("ying", B),
        ("yish", A)))
m[3] = dict((
        ("acy", A),
        ("age", B),
        ("aic", A),
        ("als", b),
        ("ant", B),
        ("ars", O),
        ("ary", F),
        ("ata", A),
        ("ate", A),
        ("eal", Y),
        ("ear", Y),
        ("ely", E),
        ("ene", E),
        ("ent", C),
        ("ery", E),
        ("ese", A),
        ("ful", A),
        ("ial", A),
        ("ian", A),
        ("ics", A),
        ("ide", L),
        ("ied", A),
        ("ier", A),
        ("ies", P),
        ("ily", A),
        ("ine", M),
        ("ing", N),
        ("ion", Q),
        ("ish", C),
        ("ism", B),
        ("ist", A),
        ("ite", a),
        ("ity", A),
        ("ium", A),
        ("ive", A),
        ("ize", F),
        ("oid", A),
        ("one", R),
        ("ous", A)))
m[2] = dict((
        ("ae", A),
        ("al", b),
        ("ar", X),
        ("as", B),
        ("ed", E),
        ("en", F),
        ("es", E),
        ("ia", A),
        ("ic", A),
        ("is", A),
        ("ly", B),
        ("on", S),
        ("or", T),
        ("um", U),
        ("us", V),
        ("yl", R),
        ("s'", A),
        ("'s", A)))
m[1] = dict((
        ("a", A),
        ("e", A),
        ("i", A),
        ("o", A),
        ("s", W),
        ("y", B)))


def remove_ending(word):
    length = len(word)
    el = 11
    while el > 0:
        if length - el > 1:
            ending = word[length - el:]
            cond = m[el].get(ending)
            if cond:
                base = word[:length - el]
                if cond(base):
                    return base
        el -= 1
    return word


_endings = (("iev", "ief"),
            ("uct", "uc"),
            ("iev", "ief"),
            ("uct", "uc"),
            ("umpt", "um"),
            ("rpt", "rb"),
            ("urs", "ur"),
            ("istr", "ister"),
            ("metr", "meter"),
            ("olv", "olut"),
            ("ul", "l", "aoi"),
            ("bex", "bic"),
            ("dex", "dic"),
            ("pex", "pic"),
            ("tex", "tic"),
            ("ax", "ac"),
            ("ex", "ec"),
            ("ix", "ic"),
            ("lux", "luc"),
            ("uad", "uas"),
            ("vad", "vas"),
            ("cid", "cis"),
            ("lid", "lis"),
            ("erid", "eris"),
            ("pand", "pans"),
            ("end", "ens", "s"),
            ("ond", "ons"),
            ("lud", "lus"),
            ("rud", "rus"),
            ("her", "hes", "pt"),
            ("mit", "mis"),
            ("ent", "ens", "m"),
            ("ert", "ers"),
            ("et", "es", "n"),
            ("yt", "ys"),
            ("yz", "ys"))


# Hash the ending rules by the last letter of the target ending
_endingrules = defaultdict(list)
for rule in _endings:
    _endingrules[rule[0][-1]].append(rule)

_doubles = frozenset(("dd", "gg", "ll", "mm", "nn", "pp", "rr", "ss", "tt"))


def fix_ending(word):
    if word[-2:] in _doubles:
        word = word[:-1]

    for endingrule in _endingrules[word[-1]]:
        target, newend = endingrule[:2]
        if word.endswith(target):
            if len(endingrule) > 2:
                exceptafter = endingrule[2]
                c = word[0 - (len(target) + 1)]
                if c in exceptafter:
                    return word

            return word[:0 - len(target)] + newend

    return word


def stem(word):
    """Returns the stemmed version of the argument string.
    """
    return fix_ending(remove_ending(word))
