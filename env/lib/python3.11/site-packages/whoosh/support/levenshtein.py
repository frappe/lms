"""
Contains functions implementing edit distance algorithms.
"""

from whoosh.compat import xrange


def levenshtein(seq1, seq2, limit=None):
    """Returns the Levenshtein edit distance between two strings.
    """

    oneago = None
    thisrow = list(range(1, len(seq2) + 1)) + [0]
    for x in xrange(len(seq1)):
        # Python lists wrap around for negative indices, so put the
        # leftmost column at the *end* of the list. This matches with
        # the zero-indexed strings and saves extra calculation.
        oneago, thisrow = thisrow, [0] * len(seq2) + [x + 1]
        for y in xrange(len(seq2)):
            delcost = oneago[y] + 1
            addcost = thisrow[y - 1] + 1
            subcost = oneago[y - 1] + (seq1[x] != seq2[y])
            thisrow[y] = min(delcost, addcost, subcost)

        if limit and x > limit and min(thisrow) > limit:
            return limit + 1

    return thisrow[len(seq2) - 1]


def damerau_levenshtein(seq1, seq2, limit=None):
    """Returns the Damerau-Levenshtein edit distance between two strings.
    """

    oneago = None
    thisrow = list(range(1, len(seq2) + 1)) + [0]
    for x in xrange(len(seq1)):
        # Python lists wrap around for negative indices, so put the
        # leftmost column at the *end* of the list. This matches with
        # the zero-indexed strings and saves extra calculation.
        twoago, oneago, thisrow = oneago, thisrow, [0] * len(seq2) + [x + 1]
        for y in xrange(len(seq2)):
            delcost = oneago[y] + 1
            addcost = thisrow[y - 1] + 1
            subcost = oneago[y - 1] + (seq1[x] != seq2[y])
            thisrow[y] = min(delcost, addcost, subcost)
            # This block deals with transpositions
            if (x > 0 and y > 0 and seq1[x] == seq2[y - 1]
                and seq1[x - 1] == seq2[y] and seq1[x] != seq2[y]):
                thisrow[y] = min(thisrow[y], twoago[y - 2] + 1)

        if limit and x > limit and min(thisrow) > limit:
            return limit + 1

    return thisrow[len(seq2) - 1]


def relative(a, b):
    """Returns the relative distance between two strings, in the range
    [0-1] where 1 means total equality.
    """

    d = distance(a, b)
    longer = float(max((len(a), len(b))))
    shorter = float(min((len(a), len(b))))
    r = ((longer - d) / longer) * (shorter / longer)
    return r


distance = damerau_levenshtein
