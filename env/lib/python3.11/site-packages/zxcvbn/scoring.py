from math import log, factorial

import re

from .adjacency_graphs import ADJACENCY_GRAPHS

from decimal import Decimal


def calc_average_degree(graph):
    average = 0

    for key, neighbors in graph.items():
        average += len([n for n in neighbors if n])
    average /= float(len(graph.items()))

    return average


BRUTEFORCE_CARDINALITY = 10
MIN_GUESSES_BEFORE_GROWING_SEQUENCE = 10000
MIN_SUBMATCH_GUESSES_SINGLE_CHAR = 10
MIN_SUBMATCH_GUESSES_MULTI_CHAR = 50

MIN_YEAR_SPACE = 20
REFERENCE_YEAR = 2017


def nCk(n, k):
    """http://blog.plover.com/math/choose.html"""
    if k > n:
        return 0
    if k == 0:
        return 1

    r = 1
    for d in range(1, k + 1):
        r *= n
        r /= d
        n -= 1

    return r


# ------------------------------------------------------------------------------
# search --- most guessable match sequence -------------------------------------
# ------------------------------------------------------------------------------
#
# takes a sequence of overlapping matches, returns the non-overlapping sequence with
# minimum guesses. the following is a O(l_max * (n + m)) dynamic programming algorithm
# for a length-n password with m candidate matches. l_max is the maximum optimal
# sequence length spanning each prefix of the password. In practice it rarely exceeds 5 and the
# search terminates rapidly.
#
# the optimal "minimum guesses" sequence is here defined to be the sequence that
# minimizes the following function:
#
#    g = l! * Product(m.guesses for m in sequence) + D^(l - 1)
#
# where l is the length of the sequence.
#
# the factorial term is the number of ways to order l patterns.
#
# the D^(l-1) term is another length penalty, roughly capturing the idea that an
# attacker will try lower-length sequences first before trying length-l sequences.
#
# for example, consider a sequence that is date-repeat-dictionary.
#  - an attacker would need to try other date-repeat-dictionary combinations,
#    hence the product term.
#  - an attacker would need to try repeat-date-dictionary, dictionary-repeat-date,
#    ..., hence the factorial term.
#  - an attacker would also likely try length-1 (dictionary) and length-2 (dictionary-date)
#    sequences before length-3. assuming at minimum D guesses per pattern type,
#    D^(l-1) approximates Sum(D^i for i in [1..l-1]
#
# ------------------------------------------------------------------------------
def most_guessable_match_sequence(password, matches, _exclude_additive=False):
    n = len(password)

    # partition matches into sublists according to ending index j
    matches_by_j = [[] for _ in range(n)]
    try:
        for m in matches:
            matches_by_j[m['j']].append(m)
    except TypeError:
        pass
    # small detail: for deterministic output, sort each sublist by i.
    for lst in matches_by_j:
        lst.sort(key=lambda m1: m1['i'])

    optimal = {
        # optimal.m[k][l] holds final match in the best length-l match sequence
        # covering the password prefix up to k, inclusive.
        # if there is no length-l sequence that scores better (fewer guesses)
        # than a shorter match sequence spanning the same prefix,
        # optimal.m[k][l] is undefined.
        'm': [{} for _ in range(n)],

        # same structure as optimal.m -- holds the product term Prod(m.guesses
        # for m in sequence). optimal.pi allows for fast (non-looping) updates
        # to the minimization function.
        'pi': [{} for _ in range(n)],

        # same structure as optimal.m -- holds the overall metric.
        'g': [{} for _ in range(n)],
    }

    # helper: considers whether a length-l sequence ending at match m is better
    # (fewer guesses) than previously encountered sequences, updating state if
    # so.
    def update(m, l):
        k = m['j']
        pi = estimate_guesses(m, password)
        if l > 1:
            # we're considering a length-l sequence ending with match m:
            # obtain the product term in the minimization function by
            # multiplying m's guesses by the product of the length-(l-1)
            # sequence ending just before m, at m.i - 1.
            pi = pi * Decimal(optimal['pi'][m['i'] - 1][l - 1])
        # calculate the minimization func
        g = factorial(l) * pi
        if not _exclude_additive:
            g += MIN_GUESSES_BEFORE_GROWING_SEQUENCE ** (l - 1)

        # update state if new best.
        # first see if any competing sequences covering this prefix, with l or
        # fewer matches, fare better than this sequence. if so, skip it and
        # return.
        for competing_l, competing_g in optimal['g'][k].items():
            if competing_l > l:
                continue
            if competing_g <= g:
                return

        # this sequence might be part of the final optimal sequence.
        optimal['g'][k][l] = g
        optimal['m'][k][l] = m
        optimal['pi'][k][l] = pi

    # helper: evaluate bruteforce matches ending at k.
    def bruteforce_update(k):
        # see if a single bruteforce match spanning the k-prefix is optimal.
        m = make_bruteforce_match(0, k)
        update(m, 1)
        for i in range(1, k + 1):
            # generate k bruteforce matches, spanning from (i=1, j=k) up to
            # (i=k, j=k). see if adding these new matches to any of the
            # sequences in optimal[i-1] leads to new bests.
            m = make_bruteforce_match(i, k)
            for l, last_m in optimal['m'][i - 1].items():
                l = int(l)

                # corner: an optimal sequence will never have two adjacent
                # bruteforce matches. it is strictly better to have a single
                # bruteforce match spanning the same region: same contribution
                # to the guess product with a lower length.
                # --> safe to skip those cases.
                if last_m.get('pattern', False) == 'bruteforce':
                    continue

                # try adding m to this length-l sequence.
                update(m, l + 1)

    # helper: make bruteforce match objects spanning i to j, inclusive.
    def make_bruteforce_match(i, j):
        return {
            'pattern': 'bruteforce',
            'token': password[i:j + 1],
            'i': i,
            'j': j,
        }

    # helper: step backwards through optimal.m starting at the end,
    # constructing the final optimal match sequence.
    def unwind(n):
        optimal_match_sequence = []
        k = n - 1
        # find the final best sequence length and score
        l = None
        g = float('inf')
        for candidate_l, candidate_g in optimal['g'][k].items():
            if candidate_g < g:
                l = candidate_l
                g = candidate_g

        while k >= 0:
            m = optimal['m'][k][l]
            optimal_match_sequence.insert(0, m)
            k = m['i'] - 1
            l -= 1

        return optimal_match_sequence

    for k in range(n):
        for m in matches_by_j[k]:
            if m['i'] > 0:
                for l in optimal['m'][m['i'] - 1]:
                    l = int(l)
                    update(m, l + 1)
            else:
                update(m, 1)
        bruteforce_update(k)

    optimal_match_sequence = unwind(n)
    optimal_l = len(optimal_match_sequence)

    # corner: empty password
    if len(password) == 0:
        guesses = 1
    else:
        guesses = optimal['g'][n - 1][optimal_l]

    # final result object
    return {
        'password': password,
        'guesses': guesses,
        'guesses_log10': log(guesses, 10),
        'sequence': optimal_match_sequence,
    }


def estimate_guesses(match, password):
    if match.get('guesses', False):
        return Decimal(match['guesses'])

    min_guesses = 1
    if len(match['token']) < len(password):
        if len(match['token']) == 1:
            min_guesses = MIN_SUBMATCH_GUESSES_SINGLE_CHAR
        else:
            min_guesses = MIN_SUBMATCH_GUESSES_MULTI_CHAR

    estimation_functions = {
        'bruteforce': bruteforce_guesses,
        'dictionary': dictionary_guesses,
        'spatial': spatial_guesses,
        'repeat': repeat_guesses,
        'sequence': sequence_guesses,
        'regex': regex_guesses,
        'date': date_guesses,
    }

    guesses = estimation_functions[match['pattern']](match)
    match['guesses'] = max(guesses, min_guesses)
    match['guesses_log10'] = log(match['guesses'], 10)

    return Decimal(match['guesses'])


def bruteforce_guesses(match):
    guesses = BRUTEFORCE_CARDINALITY ** len(match['token'])
    # small detail: make bruteforce matches at minimum one guess bigger than
    # smallest allowed submatch guesses, such that non-bruteforce submatches
    # over the same [i..j] take precedence.
    if len(match['token']) == 1:
        min_guesses = MIN_SUBMATCH_GUESSES_SINGLE_CHAR + 1
    else:
        min_guesses = MIN_SUBMATCH_GUESSES_MULTI_CHAR + 1

    return max(guesses, min_guesses)


def dictionary_guesses(match):
    # keep these as properties for display purposes
    match['base_guesses'] = match['rank']
    match['uppercase_variations'] = uppercase_variations(match)
    match['l33t_variations'] = l33t_variations(match)
    reversed_variations = match.get('reversed', False) and 2 or 1

    return match['base_guesses'] * match['uppercase_variations'] * \
        match['l33t_variations'] * reversed_variations


def repeat_guesses(match):
    return match['base_guesses'] * Decimal(match['repeat_count'])


def sequence_guesses(match):
    first_chr = match['token'][:1]
    # lower guesses for obvious starting points
    if first_chr in ['a', 'A', 'z', 'Z', '0', '1', '9']:
        base_guesses = 4
    else:
        if re.compile(r'\d').match(first_chr):
            base_guesses = 10  # digits
        else:
            # could give a higher base for uppercase,
            # assigning 26 to both upper and lower sequences is more
            # conservative.
            base_guesses = 26
    if not match['ascending']:
        base_guesses *= 2

    return base_guesses * len(match['token'])


def regex_guesses(match):
    char_class_bases = {
        'alpha_lower': 26,
        'alpha_upper': 26,
        'alpha': 52,
        'alphanumeric': 62,
        'digits': 10,
        'symbols': 33,
    }
    if match['regex_name'] in char_class_bases:
        return char_class_bases[match['regex_name']] ** len(match['token'])
    elif match['regex_name'] == 'recent_year':
        # conservative estimate of year space: num years from REFERENCE_YEAR.
        # if year is close to REFERENCE_YEAR, estimate a year space of
        # MIN_YEAR_SPACE.
        year_space = abs(int(match['regex_match'].group(0)) - REFERENCE_YEAR)
        year_space = max(year_space, MIN_YEAR_SPACE)

        return year_space


def date_guesses(match):
    year_space = max(abs(match['year'] - REFERENCE_YEAR), MIN_YEAR_SPACE)
    guesses = year_space * 365
    if match.get('separator', False):
        guesses *= 4

    return guesses


KEYBOARD_AVERAGE_DEGREE = calc_average_degree(ADJACENCY_GRAPHS['qwerty'])
# slightly different for keypad/mac keypad, but close enough
KEYPAD_AVERAGE_DEGREE = calc_average_degree(ADJACENCY_GRAPHS['keypad'])

KEYBOARD_STARTING_POSITIONS = len(ADJACENCY_GRAPHS['qwerty'].keys())
KEYPAD_STARTING_POSITIONS = len(ADJACENCY_GRAPHS['keypad'].keys())


def spatial_guesses(match):
    if match['graph'] in ['qwerty', 'dvorak']:
        s = KEYBOARD_STARTING_POSITIONS
        d = KEYBOARD_AVERAGE_DEGREE
    else:
        s = KEYPAD_STARTING_POSITIONS
        d = KEYPAD_AVERAGE_DEGREE
    guesses = 0
    L = len(match['token'])
    t = match['turns']
    # estimate the number of possible patterns w/ length L or less with t turns
    # or less.
    for i in range(2, L + 1):
        possible_turns = min(t, i - 1) + 1
        for j in range(1, possible_turns):
            guesses += nCk(i - 1, j - 1) * s * pow(d, j)
    # add extra guesses for shifted keys. (% instead of 5, A instead of a.)
    # math is similar to extra guesses of l33t substitutions in dictionary
    # matches.
    if match['shifted_count']:
        S = match['shifted_count']
        U = len(match['token']) - match['shifted_count']  # unshifted count
        if S == 0 or U == 0:
            guesses *= 2
        else:
            shifted_variations = 0
            for i in range(1, min(S, U) + 1):
                shifted_variations += nCk(S + U, i)
            guesses *= shifted_variations

    return guesses


START_UPPER = re.compile(r'^[A-Z][^A-Z]+$')
END_UPPER = re.compile(r'^[^A-Z]+[A-Z]$')
ALL_UPPER = re.compile(r'^[^a-z]+$')
ALL_LOWER = re.compile(r'^[^A-Z]+$')


def uppercase_variations(match):
    word = match['token']

    if ALL_LOWER.match(word) or word.lower() == word:
        return 1

    for regex in [START_UPPER, END_UPPER, ALL_UPPER]:
        if regex.match(word):
            return 2

    U = sum(1 for c in word if c.isupper())
    L = sum(1 for c in word if c.islower())
    variations = 0
    for i in range(1, min(U, L) + 1):
        variations += nCk(U + L, i)

    return variations


def l33t_variations(match):
    if not match.get('l33t', False):
        return 1

    variations = 1

    for subbed, unsubbed in match['sub'].items():
        # lower-case match.token before calculating: capitalization shouldn't
        # affect l33t calc.
        chrs = list(match['token'].lower())
        S = sum(1 for chr in chrs if chr == subbed)
        U = sum(1 for chr in chrs if chr == unsubbed)
        if S == 0 or U == 0:
            # for this sub, password is either fully subbed (444) or fully
            # unsubbed (aaa) treat that as doubling the space (attacker needs
            # to try fully subbed chars in addition to unsubbed.)
            variations *= 2
        else:
            # this case is similar to capitalization:
            # with aa44a, U = 3, S = 2, attacker needs to try unsubbed + one
            # sub + two subs
            p = min(U, S)
            possibilities = 0
            for i in range(1, p + 1):
                possibilities += nCk(U + S, i)
            variations *= possibilities

    return variations
