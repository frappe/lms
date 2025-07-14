from zxcvbn import scoring
from . import adjacency_graphs
from zxcvbn.frequency_lists import FREQUENCY_LISTS
import re

from zxcvbn.scoring import most_guessable_match_sequence


def build_ranked_dict(ordered_list):
    return {word: idx for idx, word in enumerate(ordered_list, 1)}

RANKED_DICTIONARIES = {}


def add_frequency_lists(frequency_lists_):
    for name, lst in frequency_lists_.items():
        RANKED_DICTIONARIES[name] = build_ranked_dict(lst)


add_frequency_lists(FREQUENCY_LISTS)

GRAPHS = {
    'qwerty': adjacency_graphs.ADJACENCY_GRAPHS['qwerty'],
    'dvorak': adjacency_graphs.ADJACENCY_GRAPHS['dvorak'],
    'keypad': adjacency_graphs.ADJACENCY_GRAPHS['keypad'],
    'mac_keypad': adjacency_graphs.ADJACENCY_GRAPHS['mac_keypad'],
}

L33T_TABLE = {
    'a': ['4', '@'],
    'b': ['8'],
    'c': ['(', '{', '[', '<'],
    'e': ['3'],
    'g': ['6', '9'],
    'i': ['1', '!', '|'],
    'l': ['1', '|', '7'],
    'o': ['0'],
    's': ['$', '5'],
    't': ['+', '7'],
    'x': ['%'],
    'z': ['2'],
}

REGEXEN = {
    'recent_year': re.compile(r'19\d\d|200\d|201\d'),
}

DATE_MAX_YEAR = 2050
DATE_MIN_YEAR = 1000
DATE_SPLITS = {
    4: [  # for length-4 strings, eg 1191 or 9111, two ways to split:
        [1, 2],  # 1 1 91 (2nd split starts at index 1, 3rd at index 2)
        [2, 3],  # 91 1 1
    ],
    5: [
        [1, 3],  # 1 11 91
        [2, 3],  # 11 1 91
    ],
    6: [
        [1, 2],  # 1 1 1991
        [2, 4],  # 11 11 91
        [4, 5],  # 1991 1 1
    ],
    7: [
        [1, 3],  # 1 11 1991
        [2, 3],  # 11 1 1991
        [4, 5],  # 1991 1 11
        [4, 6],  # 1991 11 1
    ],
    8: [
        [2, 4],  # 11 11 1991
        [4, 6],  # 1991 11 11
    ],
}


# omnimatch -- perform all matches
def omnimatch(password, _ranked_dictionaries=RANKED_DICTIONARIES):
    matches = []
    for matcher in [
        dictionary_match,
        reverse_dictionary_match,
        l33t_match,
        spatial_match,
        repeat_match,
        sequence_match,
        regex_match,
        date_match,
    ]:
        matches.extend(matcher(password, _ranked_dictionaries=_ranked_dictionaries))

    return sorted(matches, key=lambda x: (x['i'], x['j']))


# dictionary match (common passwords, english, last names, etc)
def dictionary_match(password, _ranked_dictionaries=RANKED_DICTIONARIES):
    matches = []
    length = len(password)
    password_lower = password.lower()
    for dictionary_name, ranked_dict in _ranked_dictionaries.items():
        for i in range(length):
            for j in range(i, length):
                if password_lower[i:j + 1] in ranked_dict:
                    word = password_lower[i:j + 1]
                    rank = ranked_dict[word]
                    matches.append({
                        'pattern': 'dictionary',
                        'i': i,
                        'j': j,
                        'token': password[i:j + 1],
                        'matched_word': word,
                        'rank': rank,
                        'dictionary_name': dictionary_name,
                        'reversed': False,
                        'l33t': False,
                    })

    return sorted(matches, key=lambda x: (x['i'], x['j']))


def reverse_dictionary_match(password,
                             _ranked_dictionaries=RANKED_DICTIONARIES):
    reversed_password = ''.join(reversed(password))
    matches = dictionary_match(reversed_password, _ranked_dictionaries)
    for match in matches:
        match['token'] = ''.join(reversed(match['token']))
        match['reversed'] = True
        match['i'], match['j'] = len(password) - 1 - match['j'], \
                                 len(password) - 1 - match['i']

    return sorted(matches, key=lambda x: (x['i'], x['j']))


def relevant_l33t_subtable(password, table):
    password_chars = {}
    for char in list(password):
        password_chars[char] = True

    subtable = {}
    for letter, subs in table.items():
        relevant_subs = [sub for sub in subs if sub in password_chars]
        if len(relevant_subs) > 0:
            subtable[letter] = relevant_subs

    return subtable


def enumerate_l33t_subs(table):
    keys = list(table.keys())
    subs = [[]]

    def dedup(subs):
        deduped = []
        members = {}
        for sub in subs:
            assoc = [(k, v) for v, k in sub]
            assoc.sort()
            label = '-'.join([k + ',' + str(v) for k, v in assoc])
            if label not in members:
                members[label] = True
                deduped.append(sub)

        return deduped

    def helper(keys, subs):
        if not len(keys):
            return subs

        first_key = keys[0]
        rest_keys = keys[1:]
        next_subs = []
        for l33t_chr in table[first_key]:
            for sub in subs:
                dup_l33t_index = -1
                for i in range(len(sub)):
                    if sub[i][0] == l33t_chr:
                        dup_l33t_index = i
                        break
                if dup_l33t_index == -1:
                    sub_extension = list(sub)
                    sub_extension.append([l33t_chr, first_key])
                    next_subs.append(sub_extension)
                else:
                    sub_alternative = list(sub)
                    sub_alternative.pop(dup_l33t_index)
                    sub_alternative.append([l33t_chr, first_key])
                    next_subs.append(sub)
                    next_subs.append(sub_alternative)

        subs = dedup(next_subs)
        return helper(rest_keys, subs)

    subs = helper(keys, subs)
    sub_dicts = []  # convert from assoc lists to dicts
    for sub in subs:
        sub_dict = {}
        for l33t_chr, chr in sub:
            sub_dict[l33t_chr] = chr
        sub_dicts.append(sub_dict)

    return sub_dicts


def translate(string, chr_map):
    chars = []
    for char in list(string):
        if chr_map.get(char, False):
            chars.append(chr_map[char])
        else:
            chars.append(char)

    return ''.join(chars)


def l33t_match(password, _ranked_dictionaries=RANKED_DICTIONARIES,
               _l33t_table=L33T_TABLE):
    matches = []

    for sub in enumerate_l33t_subs(
            relevant_l33t_subtable(password, _l33t_table)):
        if not len(sub):
            break

        subbed_password = translate(password, sub)
        for match in dictionary_match(subbed_password, _ranked_dictionaries):
            token = password[match['i']:match['j'] + 1]
            if token.lower() == match['matched_word']:
                # only return the matches that contain an actual substitution
                continue

            # subset of mappings in sub that are in use for this match
            match_sub = {}
            for subbed_chr, chr in sub.items():
                if subbed_chr in token:
                    match_sub[subbed_chr] = chr
            match['l33t'] = True
            match['token'] = token
            match['sub'] = match_sub
            match['sub_display'] = ', '.join(
                ["%s -> %s" % (k, v) for k, v in match_sub.items()]
            )
            matches.append(match)

    matches = [match for match in matches if len(match['token']) > 1]

    return sorted(matches, key=lambda x: (x['i'], x['j']))


# repeats (aaa, abcabcabc) and sequences (abcdef)
def repeat_match(password, _ranked_dictionaries=RANKED_DICTIONARIES):
    matches = []
    greedy = re.compile(r'(.+)\1+')
    lazy = re.compile(r'(.+?)\1+')
    lazy_anchored = re.compile(r'^(.+?)\1+$')
    last_index = 0
    while last_index < len(password):
        greedy_match = greedy.search(password, pos=last_index)
        lazy_match = lazy.search(password, pos=last_index)

        if not greedy_match:
            break

        if len(greedy_match.group(0)) > len(lazy_match.group(0)):
            # greedy beats lazy for 'aabaab'
            #   greedy: [aabaab, aab]
            #   lazy:   [aa,     a]
            match = greedy_match
            # greedy's repeated string might itself be repeated, eg.
            # aabaab in aabaabaabaab.
            # run an anchored lazy match on greedy's repeated string
            # to find the shortest repeated string
            base_token = lazy_anchored.search(match.group(0)).group(1)
        else:
            match = lazy_match
            base_token = match.group(1)

        i, j = match.span()[0], match.span()[1] - 1

        # recursively match and score the base string
        base_analysis = most_guessable_match_sequence(
            base_token,
            omnimatch(base_token)
        )
        base_matches = base_analysis['sequence']
        base_guesses = base_analysis['guesses']
        matches.append({
            'pattern': 'repeat',
            'i': i,
            'j': j,
            'token': match.group(0),
            'base_token': base_token,
            'base_guesses': base_guesses,
            'base_matches': base_matches,
            'repeat_count': len(match.group(0)) / len(base_token),
        })
        last_index = j + 1

    return matches


def spatial_match(password, _graphs=GRAPHS, _ranked_dictionaries=RANKED_DICTIONARIES):
    matches = []
    for graph_name, graph in _graphs.items():
        matches.extend(spatial_match_helper(password, graph, graph_name))

    return sorted(matches, key=lambda x: (x['i'], x['j']))


SHIFTED_RX = re.compile(r'[~!@#$%^&*()_+QWERTYUIOP{}|ASDFGHJKL:"ZXCVBNM<>?]')


def spatial_match_helper(password, graph, graph_name):
    matches = []
    i = 0
    while i < len(password) - 1:
        j = i + 1
        last_direction = None
        turns = 0
        if graph_name in ['qwerty', 'dvorak', ] and \
                SHIFTED_RX.search(password[i]):
            # initial character is shifted
            shifted_count = 1
        else:
            shifted_count = 0

        while True:
            prev_char = password[j - 1]
            found = False
            found_direction = -1
            cur_direction = -1
            try:
                adjacents = graph[prev_char] or []
            except KeyError:
                adjacents = []
            # consider growing pattern by one character if j hasn't gone
            # over the edge.
            if j < len(password):
                cur_char = password[j]
                for adj in adjacents:
                    cur_direction += 1
                    if adj and cur_char in adj:
                        found = True
                        found_direction = cur_direction
                        if adj.index(cur_char) == 1:
                            # index 1 in the adjacency means the key is shifted,
                            # 0 means unshifted: A vs a, % vs 5, etc.
                            # for example, 'q' is adjacent to the entry '2@'.
                            # @ is shifted w/ index 1, 2 is unshifted.
                            shifted_count += 1
                        if last_direction != found_direction:
                            # adding a turn is correct even in the initial case
                            # when last_direction is null:
                            # every spatial pattern starts with a turn.
                            turns += 1
                            last_direction = found_direction
                        break
            # if the current pattern continued, extend j and try to grow again
            if found:
                j += 1
            # otherwise push the pattern discovered so far, if any...
            else:
                if j - i > 2:  # don't consider length 1 or 2 chains.
                    matches.append({
                        'pattern': 'spatial',
                        'i': i,
                        'j': j - 1,
                        'token': password[i:j],
                        'graph': graph_name,
                        'turns': turns,
                        'shifted_count': shifted_count,
                    })
                # ...and then start a new search for the rest of the password.
                i = j
                break

    return matches


MAX_DELTA = 5


def sequence_match(password, _ranked_dictionaries=RANKED_DICTIONARIES):
    # Identifies sequences by looking for repeated differences in unicode codepoint.
    # this allows skipping, such as 9753, and also matches some extended unicode sequences
    # such as Greek and Cyrillic alphabets.
    #
    # for example, consider the input 'abcdb975zy'
    #
    # password: a   b   c   d   b    9   7   5   z   y
    # index:    0   1   2   3   4    5   6   7   8   9
    # delta:      1   1   1  -2  -41  -2  -2  69   1
    #
    # expected result:
    # [(i, j, delta), ...] = [(0, 3, 1), (5, 7, -2), (8, 9, 1)]
    if len(password) == 1:
        return []

    def update(i, j, delta):
        if j - i > 1 or (delta and abs(delta) == 1):
            if 0 < abs(delta) <= MAX_DELTA:
                token = password[i:j + 1]
                if re.compile(r'^[a-z]+$').match(token):
                    sequence_name = 'lower'
                    sequence_space = 26
                elif re.compile(r'^[A-Z]+$').match(token):
                    sequence_name = 'upper'
                    sequence_space = 26
                elif re.compile(r'^\d+$').match(token):
                    sequence_name = 'digits'
                    sequence_space = 10
                else:
                    sequence_name = 'unicode'
                    sequence_space = 26
                result.append({
                    'pattern': 'sequence',
                    'i': i,
                    'j': j,
                    'token': password[i:j + 1],
                    'sequence_name': sequence_name,
                    'sequence_space': sequence_space,
                    'ascending': delta > 0
                })

    result = []
    i = 0
    last_delta = None

    for k in range(1, len(password)):
        delta = ord(password[k]) - ord(password[k - 1])
        if last_delta is None:
            last_delta = delta
        if delta == last_delta:
            continue
        j = k - 1
        update(i, j, last_delta)
        i = j
        last_delta = delta
    update(i, len(password) - 1, last_delta)

    return result


def regex_match(password, _regexen=REGEXEN, _ranked_dictionaries=RANKED_DICTIONARIES):
    matches = []
    for name, regex in _regexen.items():
        for rx_match in regex.finditer(password):
            matches.append({
                'pattern': 'regex',
                'token': rx_match.group(0),
                'i': rx_match.start(),
                'j': rx_match.end()-1,
                'regex_name': name,
                'regex_match': rx_match,
            })

    return sorted(matches, key=lambda x: (x['i'], x['j']))


def date_match(password, _ranked_dictionaries=RANKED_DICTIONARIES):
    # a "date" is recognized as:
    #   any 3-tuple that starts or ends with a 2- or 4-digit year,
    #   with 2 or 0 separator chars (1.1.91 or 1191),
    #   maybe zero-padded (01-01-91 vs 1-1-91),
    #   a month between 1 and 12,
    #   a day between 1 and 31.
    #
    # note: this isn't true date parsing in that "feb 31st" is allowed,
    # this doesn't check for leap years, etc.
    #
    # recipe:
    # start with regex to find maybe-dates, then attempt to map the integers
    # onto month-day-year to filter the maybe-dates into dates.
    # finally, remove matches that are substrings of other matches to reduce noise.
    #
    # note: instead of using a lazy or greedy regex to find many dates over the full string,
    # this uses a ^...$ regex against every substring of the password -- less performant but leads
    # to every possible date match.
    matches = []
    maybe_date_no_separator = re.compile(r'^\d{4,8}$')
    maybe_date_with_separator = re.compile(
        r'^(\d{1,4})([\s/\\_.-])(\d{1,2})\2(\d{1,4})$'
    )

    # dates without separators are between length 4 '1191' and 8 '11111991'
    for i in range(len(password) - 3):
        for j in range(i + 3, i + 8):
            if j >= len(password):
                break

            token = password[i:j + 1]
            if not maybe_date_no_separator.match(token):
                continue
            candidates = []
            for k, l in DATE_SPLITS[len(token)]:
                dmy = map_ints_to_dmy([
                    int(token[0:k]),
                    int(token[k:l]),
                    int(token[l:])
                ])
                if dmy:
                    candidates.append(dmy)
            if not len(candidates) > 0:
                continue
            # at this point: different possible dmy mappings for the same i,j
            # substring. match the candidate date that likely takes the fewest
            # guesses: a year closest to 2000. (scoring.REFERENCE_YEAR).
            #
            # ie, considering '111504', prefer 11-15-04 to 1-1-1504
            # (interpreting '04' as 2004)
            best_candidate = candidates[0]

            def metric(candidate_):
                return abs(candidate_['year'] - scoring.REFERENCE_YEAR)

            min_distance = metric(candidates[0])
            for candidate in candidates[1:]:
                distance = metric(candidate)
                if distance < min_distance:
                    best_candidate, min_distance = candidate, distance
            matches.append({
                'pattern': 'date',
                'token': token,
                'i': i,
                'j': j,
                'separator': '',
                'year': best_candidate['year'],
                'month': best_candidate['month'],
                'day': best_candidate['day'],
            })

    # dates with separators are between length 6 '1/1/91' and 10 '11/11/1991'
    for i in range(len(password) - 5):
        for j in range(i + 5, i + 10):
            if j >= len(password):
                break
            token = password[i:j + 1]
            rx_match = maybe_date_with_separator.match(token)
            if not rx_match:
                continue
            dmy = map_ints_to_dmy([
                int(rx_match.group(1)),
                int(rx_match.group(3)),
                int(rx_match.group(4)),
            ])
            if not dmy:
                continue
            matches.append({
                'pattern': 'date',
                'token': token,
                'i': i,
                'j': j,
                'separator': rx_match.group(2),
                'year': dmy['year'],
                'month': dmy['month'],
                'day': dmy['day'],
            })

    # matches now contains all valid date strings in a way that is tricky to
    # capture with regexes only. while thorough, it will contain some
    # unintuitive noise:
    #
    # '2015_06_04', in addition to matching 2015_06_04, will also contain
    # 5(!) other date matches: 15_06_04, 5_06_04, ..., even 2015
    # (matched as 5/1/2020)
    #
    # to reduce noise, remove date matches that are strict substrings of others
    def filter_fun(match):
        is_submatch = False
        for other in matches:
            if match == other:
                continue
            if other['i'] <= match['i'] and other['j'] >= match['j']:
                is_submatch = True
                break
        return not is_submatch

    return sorted(filter(filter_fun, matches), key=lambda x: (x['i'], x['j']))


def map_ints_to_dmy(ints):
    # given a 3-tuple, discard if:
    #   middle int is over 31 (for all dmy formats, years are never allowed in
    #   the middle)
    #   middle int is zero
    #   any int is over the max allowable year
    #   any int is over two digits but under the min allowable year
    #   2 ints are over 31, the max allowable day
    #   2 ints are zero
    #   all ints are over 12, the max allowable month
    if ints[1] > 31 or ints[1] <= 0:
        return
    over_12 = 0
    over_31 = 0
    under_1 = 0
    for int in ints:
        if 99 < int < DATE_MIN_YEAR or int > DATE_MAX_YEAR:
            return
        if int > 31:
            over_31 += 1
        if int > 12:
            over_12 += 1
        if int <= 0:
            under_1 += 1
    if over_31 >= 2 or over_12 == 3 or under_1 >= 2:
        return

    # first look for a four digit year: yyyy + daymonth or daymonth + yyyy
    possible_four_digit_splits = [
        (ints[2], ints[0:2]),
        (ints[0], ints[1:3]),
    ]
    for y, rest in possible_four_digit_splits:
        if DATE_MIN_YEAR <= y <= DATE_MAX_YEAR:
            dm = map_ints_to_dm(rest)
            if dm:
                return {
                    'year': y,
                    'month': dm['month'],
                    'day': dm['day'],
                }
            else:
                # for a candidate that includes a four-digit year,
                # when the remaining ints don't match to a day and month,
                # it is not a date.
                return

    # given no four-digit year, two digit years are the most flexible int to
    # match, so try to parse a day-month out of ints[0..1] or ints[1..0]
    for y, rest in possible_four_digit_splits:
        dm = map_ints_to_dm(rest)
        if dm:
            y = two_to_four_digit_year(y)
            return {
                'year': y,
                'month': dm['month'],
                'day': dm['day'],
            }


def map_ints_to_dm(ints):
    for d, m in [ints, reversed(ints)]:
        if 1 <= d <= 31 and 1 <= m <= 12:
            return {
                'day': d,
                'month': m,
            }


def two_to_four_digit_year(year):
    if year > 99:
        return year
    elif year > 50:
        # 87 -> 1987
        return year + 1900
    else:
        # 15 -> 2015
        return year + 2000
