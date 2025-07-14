# coding= utf-8

# This script implements the Double Metaphone algorythm (c) 1998, 1999 by
# Lawrence Philips. It was translated to Python from the C source written by
# Kevin Atkinson (http://aspell.net/metaphone/) By Andrew Collins - January 12,
# 2007 who claims no rights to this work.
# http://atomboy.isa-geek.com:8080/plone/Members/acoil/programing/double-metaphone

import re

from whoosh.compat import u

vowels = frozenset("AEIOUY")
slavo_germ_exp = re.compile("W|K|CZ|WITZ")
silent_starts = re.compile("GN|KN|PN|WR|PS")


def double_metaphone(text):
    text = text.upper()
    slavo_germanic = bool(slavo_germ_exp.search(text))

    length = len(text)
    text = "--" + text + "     "
    first = pos = 2
    last = first + length - 1
    primary = secondary = ""

    if silent_starts.match(text, pos):
        pos += 1

    while pos < length + 2:
        ch = text[pos]

        if ch in vowels:
            # all init vowels now map to 'A'
            if pos != first:
                next = (None, 1)
            else:
                next = ("A", 1)
        elif ch == "B":
            #"-mb", e.g", "dumb", already skipped over... see 'M' below
            if text[pos + 1] == "B":
                next = ("P", 2)
            else:
                next = ("P", 1)
        elif ch == "C":
            # various germanic
            if (pos > (first + 1) and text[pos - 2] not in vowels and text[pos - 1:pos + 2] == 'ACH' and \
               (text[pos + 2] not in ['I', 'E'] or text[pos - 2:pos + 4] in ['BACHER', 'MACHER'])):
                next = ('K', 2)
            # special case 'CAESAR'
            elif pos == first and text[first:first + 6] == 'CAESAR':
                next = ('S', 2)
            elif text[pos:pos + 4] == 'CHIA':  # italian 'chianti'
                next = ('K', 2)
            elif text[pos:pos + 2] == 'CH':
                # find 'michael'
                if pos > first and text[pos:pos + 4] == 'CHAE':
                    next = ('K', 'X', 2)
                elif pos == first and (text[pos + 1:pos + 6] in ['HARAC', 'HARIS'] or \
                   text[pos + 1:pos + 4] in ["HOR", "HYM", "HIA", "HEM"]) and text[first:first + 5] != 'CHORE':
                    next = ('K', 2)
                # germanic, greek, or otherwise 'ch' for 'kh' sound
                elif text[first:first + 4] in ['VAN ', 'VON '] or text[first:first + 3] == 'SCH' \
                   or text[pos - 2:pos + 4] in ["ORCHES", "ARCHIT", "ORCHID"] \
                   or text[pos + 2] in ['T', 'S'] \
                   or ((text[pos - 1] in ["A", "O", "U", "E"] or pos == first) \
                   and text[pos + 2] in ["L", "R", "N", "M", "B", "H", "F", "V", "W", " "]):
                    next = ('K', 1)
                else:
                    if pos > first:
                        if text[first:first + 2] == 'MC':
                            next = ('K', 2)
                        else:
                            next = ('X', 'K', 2)
                    else:
                        next = ('X', 2)
            # e.g, 'czerny'
            elif text[pos:pos + 2] == 'CZ' and text[pos - 2:pos + 2] != 'WICZ':
                next = ('S', 'X', 2)
            # e.g., 'focaccia'
            elif text[pos + 1:pos + 4] == 'CIA':
                next = ('X', 3)
            # double 'C', but not if e.g. 'McClellan'
            elif text[pos:pos + 2] == 'CC' and not (pos == (first + 1) and text[first] == 'M'):
                # 'bellocchio' but not 'bacchus'
                if text[pos + 2] in ["I", "E", "H"] and text[pos + 2:pos + 4] != 'HU':
                    # 'accident', 'accede' 'succeed'
                    if (pos == (first + 1) and text[first] == 'A') or \
                       text[pos - 1:pos + 4] in ['UCCEE', 'UCCES']:
                        next = ('KS', 3)
                    # 'bacci', 'bertucci', other italian
                    else:
                        next = ('X', 3)
                else:
                    next = ('K', 2)
            elif text[pos:pos + 2] in ["CK", "CG", "CQ"]:
                next = ('K', 'K', 2)
            elif text[pos:pos + 2] in ["CI", "CE", "CY"]:
                # italian vs. english
                if text[pos:pos + 3] in ["CIO", "CIE", "CIA"]:
                    next = ('S', 'X', 2)
                else:
                    next = ('S', 2)
            else:
                # name sent in 'mac caffrey', 'mac gregor
                if text[pos + 1:pos + 3] in [" C", " Q", " G"]:
                    next = ('K', 3)
                else:
                    if text[pos + 1] in ["C", "K", "Q"] and text[pos + 1:pos + 3] not in ["CE", "CI"]:
                        next = ('K', 2)
                    else:  # default for 'C'
                        next = ('K', 1)
        elif ch == u('\xc7'):
            next = ('S', 1)
        elif ch == 'D':
            if text[pos:pos + 2] == 'DG':
                if text[pos + 2] in ['I', 'E', 'Y']:  # e.g. 'edge'
                    next = ('J', 3)
                else:
                    next = ('TK', 2)
            elif text[pos:pos + 2] in ['DT', 'DD']:
                next = ('T', 2)
            else:
                next = ('T', 1)
        elif ch == 'F':
            if text[pos + 1] == 'F':
                next = ('F', 2)
            else:
                next = ('F', 1)
        elif ch == 'G':
            if text[pos + 1] == 'H':
                if pos > first and text[pos - 1] not in vowels:
                    next = ('K', 2)
                elif pos < (first + 3):
                    if pos == first:  # 'ghislane', ghiradelli
                        if text[pos + 2] == 'I':
                            next = ('J', 2)
                        else:
                            next = ('K', 2)
                # Parker's rule (with some further refinements) - e.g., 'hugh'
                elif (pos > (first + 1) and text[pos - 2] in ['B', 'H', 'D']) \
                   or (pos > (first + 2) and text[pos - 3] in ['B', 'H', 'D']) \
                   or (pos > (first + 3) and text[pos - 4] in ['B', 'H']):
                    next = (None, 2)
                else:
                    # e.g., 'laugh', 'McLaughlin', 'cough', 'gough', 'rough', 'tough'
                    if pos > (first + 2) and text[pos - 1] == 'U' \
                       and text[pos - 3] in ["C", "G", "L", "R", "T"]:
                        next = ('F', 2)
                    else:
                        if pos > first and text[pos - 1] != 'I':
                            next = ('K', 2)
            elif text[pos + 1] == 'N':
                if pos == (first + 1) and text[first] in vowels and not slavo_germanic:
                    next = ('KN', 'N', 2)
                else:
                    # not e.g. 'cagney'
                    if text[pos + 2:pos + 4] != 'EY' and text[pos + 1] != 'Y' and not slavo_germanic:
                        next = ('N', 'KN', 2)
                    else:
                        next = ('KN', 2)
            # 'tagliaro'
            elif text[pos + 1:pos + 3] == 'LI' and not slavo_germanic:
                next = ('KL', 'L', 2)
            # -ges-,-gep-,-gel-, -gie- at beginning
            elif pos == first and (text[pos + 1] == 'Y' \
               or text[pos + 1:pos + 3] in ["ES", "EP", "EB", "EL", "EY", "IB", "IL", "IN", "IE", "EI", "ER"]):
                next = ('K', 'J', 2)
            # -ger-,  -gy-
            elif (text[pos + 1:pos + 2] == 'ER' or text[pos + 1] == 'Y') \
               and text[first:first + 6] not in ["DANGER", "RANGER", "MANGER"] \
               and text[pos - 1] not in ['E', 'I'] and text[pos - 1:pos + 2] not in ['RGY', 'OGY']:
                next = ('K', 'J', 2)
            # italian e.g, 'biaggi'
            elif text[pos + 1] in ['E', 'I', 'Y'] or text[pos - 1:pos + 3] in ["AGGI", "OGGI"]:
                # obvious germanic
                if text[first:first + 4] in ['VON ', 'VAN '] or text[first:first + 3] == 'SCH' \
                   or text[pos + 1:pos + 3] == 'ET':
                    next = ('K', 2)
                else:
                    # always soft if french ending
                    if text[pos + 1:pos + 5] == 'IER ':
                        next = ('J', 2)
                    else:
                        next = ('J', 'K', 2)
            elif text[pos + 1] == 'G':
                next = ('K', 2)
            else:
                next = ('K', 1)
        elif ch == 'H':
            # only keep if first & before vowel or btw. 2 vowels
            if (pos == first or text[pos - 1] in vowels) and text[pos + 1] in vowels:
                next = ('H', 2)
            else:  # (also takes care of 'HH')
                next = (None, 1)
        elif ch == 'J':
            # obvious spanish, 'jose', 'san jacinto'
            if text[pos:pos + 4] == 'JOSE' or text[first:first + 4] == 'SAN ':
                if (pos == first and text[pos + 4] == ' ') or text[first:first + 4] == 'SAN ':
                    next = ('H',)
                else:
                    next = ('J', 'H')
            elif pos == first and text[pos:pos + 4] != 'JOSE':
                next = ('J', 'A')  # Yankelovich/Jankelowicz
            else:
                # spanish pron. of e.g. 'bajador'
                if text[pos - 1] in vowels and not slavo_germanic \
                   and text[pos + 1] in ['A', 'O']:
                    next = ('J', 'H')
                else:
                    if pos == last:
                        next = ('J', ' ')
                    else:
                        if text[pos + 1] not in ["L", "T", "K", "S", "N", "M", "B", "Z"] \
                           and text[pos - 1] not in ["S", "K", "L"]:
                            next = ('J',)
                        else:
                            next = (None,)
            if text[pos + 1] == 'J':
                next = next + (2,)
            else:
                next = next + (1,)
        elif ch == 'K':
            if text[pos + 1] == 'K':
                next = ('K', 2)
            else:
                next = ('K', 1)
        elif ch == 'L':
            if text[pos + 1] == 'L':
                # spanish e.g. 'cabrillo', 'gallegos'
                if (pos == (last - 2) and text[pos - 1:pos + 3] in ["ILLO", "ILLA", "ALLE"]) \
                   or ((text[last - 1:last + 1] in ["AS", "OS"] or text[last] in ["A", "O"]) \
                   and text[pos - 1:pos + 3] == 'ALLE'):
                    next = ('L', '', 2)
                else:
                    next = ('L', 2)
            else:
                next = ('L', 1)
        elif ch == 'M':
            if text[pos + 1:pos + 4] == 'UMB' \
               and (pos + 1 == last or text[pos + 2:pos + 4] == 'ER') \
               or text[pos + 1] == 'M':
                next = ('M', 2)
            else:
                next = ('M', 1)
        elif ch == 'N':
            if text[pos + 1] == 'N':
                next = ('N', 2)
            else:
                next = ('N', 1)
        elif ch == u('\xd1'):
            next = ('N', 1)
        elif ch == 'P':
            if text[pos + 1] == 'H':
                next = ('F', 2)
            elif text[pos + 1] in ['P', 'B']:  # also account for "campbell", "raspberry"
                next = ('P', 2)
            else:
                next = ('P', 1)
        elif ch == 'Q':
            if text[pos + 1] == 'Q':
                next = ('K', 2)
            else:
                next = ('K', 1)
        elif ch == 'R':
            # french e.g. 'rogier', but exclude 'hochmeier'
            if pos == last and not slavo_germanic \
               and text[pos - 2:pos] == 'IE' and text[pos - 4:pos - 2] not in ['ME', 'MA']:
                next = ('', 'R')
            else:
                next = ('R',)
            if text[pos + 1] == 'R':
                next = next + (2,)
            else:
                next = next + (1,)
        elif ch == 'S':
            # special cases 'island', 'isle', 'carlisle', 'carlysle'
            if text[pos - 1:pos + 2] in ['ISL', 'YSL']:
                next = (None, 1)
            # special case 'sugar-'
            elif pos == first and text[first:first + 5] == 'SUGAR':
                next = ('X', 'S', 1)
            elif text[pos:pos + 2] == 'SH':
                # germanic
                if text[pos + 1:pos + 5] in ["HEIM", "HOEK", "HOLM", "HOLZ"]:
                    next = ('S', 2)
                else:
                    next = ('X', 2)
            # italian & armenian
            elif text[pos:pos + 3] in ["SIO", "SIA"] or text[pos:pos + 4] == 'SIAN':
                if not slavo_germanic:
                    next = ('S', 'X', 3)
                else:
                    next = ('S', 3)
            # german & anglicisations, e.g. 'smith' match 'schmidt', 'snider' match 'schneider'
            # also, -sz- in slavic language altho in hungarian it is pronounced 's'
            elif (pos == first and text[pos + 1] in ["M", "N", "L", "W"]) or text[pos + 1] == 'Z':
                next = ('S', 'X')
                if text[pos + 1] == 'Z':
                    next = next + (2,)
                else:
                    next = next + (1,)
            elif text[pos:pos + 2] == 'SC':
                # Schlesinger's rule
                if text[pos + 2] == 'H':
                    # dutch origin, e.g. 'school', 'schooner'
                    if text[pos + 3:pos + 5] in ["OO", "ER", "EN", "UY", "ED", "EM"]:
                        # 'schermerhorn', 'schenker'
                        if text[pos + 3:pos + 5] in ['ER', 'EN']:
                            next = ('X', 'SK', 3)
                        else:
                            next = ('SK', 3)
                    else:
                        if pos == first and text[first + 3] not in vowels and text[first + 3] != 'W':
                            next = ('X', 'S', 3)
                        else:
                            next = ('X', 3)
                elif text[pos + 2] in ['I', 'E', 'Y']:
                    next = ('S', 3)
                else:
                    next = ('SK', 3)
            # french e.g. 'resnais', 'artois'
            elif pos == last and text[pos - 2:pos] in ['AI', 'OI']:
                next = ('', 'S', 1)
            else:
                next = ('S',)
                if text[pos + 1] in ['S', 'Z']:
                    next = next + (2,)
                else:
                    next = next + (1,)
        elif ch == 'T':
            if text[pos:pos + 4] == 'TION':
                next = ('X', 3)
            elif text[pos:pos + 3] in ['TIA', 'TCH']:
                next = ('X', 3)
            elif text[pos:pos + 2] == 'TH' or text[pos:pos + 3] == 'TTH':
                # special case 'thomas', 'thames' or germanic
                if text[pos + 2:pos + 4] in ['OM', 'AM'] or text[first:first + 4] in ['VON ', 'VAN '] \
                   or text[first:first + 3] == 'SCH':
                    next = ('T', 2)
                else:
                    next = ('0', 'T', 2)
            elif text[pos + 1] in ['T', 'D']:
                next = ('T', 2)
            else:
                next = ('T', 1)
        elif ch == 'V':
            if text[pos + 1] == 'V':
                next = ('F', 2)
            else:
                next = ('F', 1)
        elif ch == 'W':
            # can also be in middle of word
            if text[pos:pos + 2] == 'WR':
                next = ('R', 2)
            elif pos == first and (text[pos + 1] in vowels or text[pos:pos + 2] == 'WH'):
                # Wasserman should match Vasserman
                if text[pos + 1] in vowels:
                    next = ('A', 'F', 1)
                else:
                    next = ('A', 1)
            # Arnow should match Arnoff
            elif (pos == last and text[pos - 1] in vowels) \
               or text[pos - 1:pos + 5] in ["EWSKI", "EWSKY", "OWSKI", "OWSKY"] \
               or text[first:first + 3] == 'SCH':
                next = ('', 'F', 1)
            # polish e.g. 'filipowicz'
            elif text[pos:pos + 4] in ["WICZ", "WITZ"]:
                next = ('TS', 'FX', 4)
            else:  # default is to skip it
                next = (None, 1)
        elif ch == 'X':
            # french e.g. breaux
            next = (None,)
            if not(pos == last and (text[pos - 3:pos] in ["IAU", "EAU"] \
               or text[pos - 2:pos] in ['AU', 'OU'])):
                next = ('KS',)
            if text[pos + 1] in ['C', 'X']:
                next = next + (2,)
            else:
                next = next + (1,)
        elif ch == 'Z':
            # chinese pinyin e.g. 'zhao'
            if text[pos + 1] == 'H':
                next = ('J',)
            elif text[pos + 1:pos + 3] in ["ZO", "ZI", "ZA"] \
               or (slavo_germanic and pos > first and text[pos - 1] != 'T'):
                next = ('S', 'TS')
            else:
                next = ('S',)
            if text[pos + 1] == 'Z':
                next = next + (2,)
            else:
                next = next + (1,)
        else:
            next = (None, 1)

        if len(next) == 2:
            if next[0]:
                primary += next[0]
                secondary += next[0]
            pos += next[1]
        elif len(next) == 3:
            if next[0]:
                primary += next[0]
            if next[1]:
                secondary += next[1]
            pos += next[2]

    if primary == secondary:
        return (primary, None)
    else:
        return (primary, secondary)

