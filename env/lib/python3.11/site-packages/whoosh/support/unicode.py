import re
from bisect import bisect_right

from whoosh.compat import text_type, u


# http://unicode.org/Public/UNIDATA/Blocks.txt
_blockdata = '''
# Blocks-5.1.0.txt
# Date: 2008-03-20, 17:41:00 PDT [KW]
#
# Unicode Character Database
# Copyright (c) 1991-2008 Unicode, Inc.
# For terms of use, see http://www.unicode.org/terms_of_use.html
# For documentation, see UCD.html
#
# Note:   The casing of block names is not normative.
#         For example, "Basic Latin" and "BASIC LATIN" are equivalent.
#
# Format:
# Start Code..End Code; Block Name

# ================================================

# Note:   When comparing block names, casing, whitespace, hyphens,
#         and underbars are ignored.
#         For example, "Latin Extended-A" and "latin extended a" are equivalent
#         For more information on the comparison of property values,
#            see UCD.html.
#
#  All code points not explicitly listed for Block
#  have the value No_Block.

# Property: Block
#
# @missing: 0000..10FFFF; No_Block

0000..007F; Basic Latin
0080..00FF; Latin-1 Supplement
0100..017F; Latin Extended-A
0180..024F; Latin Extended-B
0250..02AF; IPA Extensions
02B0..02FF; Spacing Modifier Letters
0300..036F; Combining Diacritical Marks
0370..03FF; Greek and Coptic
0400..04FF; Cyrillic
0500..052F; Cyrillic Supplement
0530..058F; Armenian
0590..05FF; Hebrew
0600..06FF; Arabic
0700..074F; Syriac
0750..077F; Arabic Supplement
0780..07BF; Thaana
07C0..07FF; NKo
0900..097F; Devanagari
0980..09FF; Bengali
0A00..0A7F; Gurmukhi
0A80..0AFF; Gujarati
0B00..0B7F; Oriya
0B80..0BFF; Tamil
0C00..0C7F; Telugu
0C80..0CFF; Kannada
0D00..0D7F; Malayalam
0D80..0DFF; Sinhala
0E00..0E7F; Thai
0E80..0EFF; Lao
0F00..0FFF; Tibetan
1000..109F; Myanmar
10A0..10FF; Georgian
1100..11FF; Hangul Jamo
1200..137F; Ethiopic
1380..139F; Ethiopic Supplement
13A0..13FF; Cherokee
1400..167F; Unified Canadian Aboriginal Syllabics
1680..169F; Ogham
16A0..16FF; Runic
1700..171F; Tagalog
1720..173F; Hanunoo
1740..175F; Buhid
1760..177F; Tagbanwa
1780..17FF; Khmer
1800..18AF; Mongolian
1900..194F; Limbu
1950..197F; Tai Le
1980..19DF; New Tai Lue
19E0..19FF; Khmer Symbols
1A00..1A1F; Buginese
1B00..1B7F; Balinese
1B80..1BBF; Sundanese
1C00..1C4F; Lepcha
1C50..1C7F; Ol Chiki
1D00..1D7F; Phonetic Extensions
1D80..1DBF; Phonetic Extensions Supplement
1DC0..1DFF; Combining Diacritical Marks Supplement
1E00..1EFF; Latin Extended Additional
1F00..1FFF; Greek Extended
2000..206F; General Punctuation
2070..209F; Superscripts and Subscripts
20A0..20CF; Currency Symbols
20D0..20FF; Combining Diacritical Marks for Symbols
2100..214F; Letterlike Symbols
2150..218F; Number Forms
2190..21FF; Arrows
2200..22FF; Mathematical Operators
2300..23FF; Miscellaneous Technical
2400..243F; Control Pictures
2440..245F; Optical Character Recognition
2460..24FF; Enclosed Alphanumerics
2500..257F; Box Drawing
2580..259F; Block Elements
25A0..25FF; Geometric Shapes
2600..26FF; Miscellaneous Symbols
2700..27BF; Dingbats
27C0..27EF; Miscellaneous Mathematical Symbols-A
27F0..27FF; Supplemental Arrows-A
2800..28FF; Braille Patterns
2900..297F; Supplemental Arrows-B
2980..29FF; Miscellaneous Mathematical Symbols-B
2A00..2AFF; Supplemental Mathematical Operators
2B00..2BFF; Miscellaneous Symbols and Arrows
2C00..2C5F; Glagolitic
2C60..2C7F; Latin Extended-C
2C80..2CFF; Coptic
2D00..2D2F; Georgian Supplement
2D30..2D7F; Tifinagh
2D80..2DDF; Ethiopic Extended
2DE0..2DFF; Cyrillic Extended-A
2E00..2E7F; Supplemental Punctuation
2E80..2EFF; CJK Radicals Supplement
2F00..2FDF; Kangxi Radicals
2FF0..2FFF; Ideographic Description Characters
3000..303F; CJK Symbols and Punctuation
3040..309F; Hiragana
30A0..30FF; Katakana
3100..312F; Bopomofo
3130..318F; Hangul Compatibility Jamo
3190..319F; Kanbun
31A0..31BF; Bopomofo Extended
31C0..31EF; CJK Strokes
31F0..31FF; Katakana Phonetic Extensions
3200..32FF; Enclosed CJK Letters and Months
3300..33FF; CJK Compatibility
3400..4DBF; CJK Unified Ideographs Extension A
4DC0..4DFF; Yijing Hexagram Symbols
4E00..9FFF; CJK Unified Ideographs
A000..A48F; Yi Syllables
A490..A4CF; Yi Radicals
A500..A63F; Vai
A640..A69F; Cyrillic Extended-B
A700..A71F; Modifier Tone Letters
A720..A7FF; Latin Extended-D
A800..A82F; Syloti Nagri
A840..A87F; Phags-pa
A880..A8DF; Saurashtra
A900..A92F; Kayah Li
A930..A95F; Rejang
AA00..AA5F; Cham
AC00..D7AF; Hangul Syllables
D800..DB7F; High Surrogates
DB80..DBFF; High Private Use Surrogates
DC00..DFFF; Low Surrogates
E000..F8FF; Private Use Area
F900..FAFF; CJK Compatibility Ideographs
FB00..FB4F; Alphabetic Presentation Forms
FB50..FDFF; Arabic Presentation Forms-A
FE00..FE0F; Variation Selectors
FE10..FE1F; Vertical Forms
FE20..FE2F; Combining Half Marks
FE30..FE4F; CJK Compatibility Forms
FE50..FE6F; Small Form Variants
FE70..FEFF; Arabic Presentation Forms-B
FF00..FFEF; Halfwidth and Fullwidth Forms
FFF0..FFFF; Specials
10000..1007F; Linear B Syllabary
10080..100FF; Linear B Ideograms
10100..1013F; Aegean Numbers
10140..1018F; Ancient Greek Numbers
10190..101CF; Ancient Symbols
101D0..101FF; Phaistos Disc
10280..1029F; Lycian
102A0..102DF; Carian
10300..1032F; Old Italic
10330..1034F; Gothic
10380..1039F; Ugaritic
103A0..103DF; Old Persian
10400..1044F; Deseret
10450..1047F; Shavian
10480..104AF; Osmanya
10800..1083F; Cypriot Syllabary
10900..1091F; Phoenician
10920..1093F; Lydian
10A00..10A5F; Kharoshthi
12000..123FF; Cuneiform
12400..1247F; Cuneiform Numbers and Punctuation
1D000..1D0FF; Byzantine Musical Symbols
1D100..1D1FF; Musical Symbols
1D200..1D24F; Ancient Greek Musical Notation
1D300..1D35F; Tai Xuan Jing Symbols
1D360..1D37F; Counting Rod Numerals
1D400..1D7FF; Mathematical Alphanumeric Symbols
1F000..1F02F; Mahjong Tiles
1F030..1F09F; Domino Tiles
20000..2A6DF; CJK Unified Ideographs Extension B
2F800..2FA1F; CJK Compatibility Ideographs Supplement
E0000..E007F; Tags
E0100..E01EF; Variation Selectors Supplement
F0000..FFFFF; Supplementary Private Use Area-A
100000..10FFFF; Supplementary Private Use Area-B

# EOF
'''


pattern = re.compile(r'([0-9A-F]+)\.\.([0-9A-F]+);\ (\S.*\S)')
_starts = []
_ends = []
_names = []


class blocks(object):
    pass


def _init():
    count = 0
    for line in _blockdata.splitlines():
        m = pattern.match(line)
        if m:
            start, end, name = m.groups()
            _starts.append(int(start, 16))
            _ends.append(int(end, 16))
            _names.append(name)
            setattr(blocks, name.replace(" ", "_"), count)
            count += 1
_init()


def blockname(ch):
    """Return the Unicode block name for ch, or None if ch has no block.

    >>> blockname(u'a')
    'Basic Latin'
    >>> blockname(unichr(0x0b80))
    'Tamil'
    >>> block(unichr(2048))
    None
    """

    assert isinstance(ch, text_type) and len(ch) == 1, repr(ch)
    cp = ord(ch)
    i = bisect_right(_starts, cp) - 1
    end = _ends[i]
    if cp > end:
        return None
    return _names[i]


def blocknum(ch):
    """Returns the unicode block number for ch, or None if ch has no block.

    >>> blocknum(u'a')
    0
    >>> blocknum(unichr(0x0b80))
    22
    >>> blocknum(unichr(2048))
    None
    """

    cp = ord(ch)
    i = bisect_right(_starts, cp) - 1
    end = _ends[i]
    if cp > end:
        return None
    return i


digits = u('0123456789\xb2\xb3\xb9\u0660\u0661\u0662\u0663\u0664\u0665\u0666'
           '\u0667\u0668\u0669\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7'
           '\u06f8\u06f9\u07c0\u07c1\u07c2\u07c3\u07c4\u07c5\u07c6\u07c7\u07c8'
           '\u07c9\u0966\u0967\u0968\u0969\u096a\u096b\u096c\u096d\u096e\u096f'
           '\u09e6\u09e7\u09e8\u09e9\u09ea\u09eb\u09ec\u09ed\u09ee\u09ef\u0a66'
           '\u0a67\u0a68\u0a69\u0a6a\u0a6b\u0a6c\u0a6d\u0a6e\u0a6f\u0ae6\u0ae7'
           '\u0ae8\u0ae9\u0aea\u0aeb\u0aec\u0aed\u0aee\u0aef\u0b66\u0b67\u0b68'
           '\u0b69\u0b6a\u0b6b\u0b6c\u0b6d\u0b6e\u0b6f\u0be6\u0be7\u0be8\u0be9'
           '\u0bea\u0beb\u0bec\u0bed\u0bee\u0bef\u0c66\u0c67\u0c68\u0c69\u0c6a'
           '\u0c6b\u0c6c\u0c6d\u0c6e\u0c6f\u0ce6\u0ce7\u0ce8\u0ce9\u0cea\u0ceb'
           '\u0cec\u0ced\u0cee\u0cef\u0d66\u0d67\u0d68\u0d69\u0d6a\u0d6b\u0d6c'
           '\u0d6d\u0d6e\u0d6f\u0e50\u0e51\u0e52\u0e53\u0e54\u0e55\u0e56\u0e57'
           '\u0e58\u0e59\u0ed0\u0ed1\u0ed2\u0ed3\u0ed4\u0ed5\u0ed6\u0ed7\u0ed8'
           '\u0ed9\u0f20\u0f21\u0f22\u0f23\u0f24\u0f25\u0f26\u0f27\u0f28\u0f29'
           '\u1040\u1041\u1042\u1043\u1044\u1045\u1046\u1047\u1048\u1049\u1090'
           '\u1091\u1092\u1093\u1094\u1095\u1096\u1097\u1098\u1099\u1369\u136a'
           '\u136b\u136c\u136d\u136e\u136f\u1370\u1371\u17e0\u17e1\u17e2\u17e3'
           '\u17e4\u17e5\u17e6\u17e7\u17e8\u17e9\u1810\u1811\u1812\u1813\u1814'
           '\u1815\u1816\u1817\u1818\u1819\u1946\u1947\u1948\u1949\u194a\u194b'
           '\u194c\u194d\u194e\u194f\u19d0\u19d1\u19d2\u19d3\u19d4\u19d5\u19d6'
           '\u19d7\u19d8\u19d9\u19da\u1a80\u1a81\u1a82\u1a83\u1a84\u1a85\u1a86'
           '\u1a87\u1a88\u1a89\u1a90\u1a91\u1a92\u1a93\u1a94\u1a95\u1a96\u1a97'
           '\u1a98\u1a99\u1b50\u1b51\u1b52\u1b53\u1b54\u1b55\u1b56\u1b57\u1b58'
           '\u1b59\u1bb0\u1bb1\u1bb2\u1bb3\u1bb4\u1bb5\u1bb6\u1bb7\u1bb8\u1bb9'
           '\u1c40\u1c41\u1c42\u1c43\u1c44\u1c45\u1c46\u1c47\u1c48\u1c49\u1c50'
           '\u1c51\u1c52\u1c53\u1c54\u1c55\u1c56\u1c57\u1c58\u1c59\u2070\u2074'
           '\u2075\u2076\u2077\u2078\u2079\u2080\u2081\u2082\u2083\u2084\u2085'
           '\u2086\u2087\u2088\u2089\u2460\u2461\u2462\u2463\u2464\u2465\u2466'
           '\u2467\u2468\u2474\u2475\u2476\u2477\u2478\u2479\u247a\u247b\u247c'
           '\u2488\u2489\u248a\u248b\u248c\u248d\u248e\u248f\u2490\u24ea\u24f5'
           '\u24f6\u24f7\u24f8\u24f9\u24fa\u24fb\u24fc\u24fd\u24ff\u2776\u2777'
           '\u2778\u2779\u277a\u277b\u277c\u277d\u277e\u2780\u2781\u2782\u2783'
           '\u2784\u2785\u2786\u2787\u2788\u278a\u278b\u278c\u278d\u278e\u278f'
           '\u2790\u2791\u2792\ua620\ua621\ua622\ua623\ua624\ua625\ua626\ua627'
           '\ua628\ua629\ua8d0\ua8d1\ua8d2\ua8d3\ua8d4\ua8d5\ua8d6\ua8d7\ua8d8'
           '\ua8d9\ua900\ua901\ua902\ua903\ua904\ua905\ua906\ua907\ua908\ua909'
           '\ua9d0\ua9d1\ua9d2\ua9d3\ua9d4\ua9d5\ua9d6\ua9d7\ua9d8\ua9d9\uaa50'
           '\uaa51\uaa52\uaa53\uaa54\uaa55\uaa56\uaa57\uaa58\uaa59\uabf0\uabf1'
           '\uabf2\uabf3\uabf4\uabf5\uabf6\uabf7\uabf8\uabf9\uff10\uff11\uff12'
           '\uff13\uff14\uff15\uff16\uff17\uff18\uff19')
lowercase = u('abcdefghijklmnopqrstuvwxyz\xaa\xb5\xba\xdf\xe0\xe1\xe2\xe3\xe4'
              '\xe5\xe6\xe7\xe8\xe9\xea\xeb\xec\xed\xee\xef\xf0\xf1\xf2\xf3'
              '\xf4\xf5\xf6\xf8\xf9\xfa\xfb\xfc\xfd\xfe\xff\u0101\u0103\u0105'
              '\u0107\u0109\u010b\u010d\u010f\u0111\u0113\u0115\u0117\u0119'
              '\u011b\u011d\u011f\u0121\u0123\u0125\u0127\u0129\u012b\u012d'
              '\u012f\u0131\u0133\u0135\u0137\u0138\u013a\u013c\u013e\u0140'
              '\u0142\u0144\u0146\u0148\u0149\u014b\u014d\u014f\u0151\u0153'
              '\u0155\u0157\u0159\u015b\u015d\u015f\u0161\u0163\u0165\u0167'
              '\u0169\u016b\u016d\u016f\u0171\u0173\u0175\u0177\u017a\u017c'
              '\u017e\u017f\u0180\u0183\u0185\u0188\u018c\u018d\u0192\u0195'
              '\u0199\u019a\u019b\u019e\u01a1\u01a3\u01a5\u01a8\u01aa\u01ab'
              '\u01ad\u01b0\u01b4\u01b6\u01b9\u01ba\u01bd\u01be\u01bf\u01c6'
              '\u01c9\u01cc\u01ce\u01d0\u01d2\u01d4\u01d6\u01d8\u01da\u01dc'
              '\u01dd\u01df\u01e1\u01e3\u01e5\u01e7\u01e9\u01eb\u01ed\u01ef'
              '\u01f0\u01f3\u01f5\u01f9\u01fb\u01fd\u01ff\u0201\u0203\u0205'
              '\u0207\u0209\u020b\u020d\u020f\u0211\u0213\u0215\u0217\u0219'
              '\u021b\u021d\u021f\u0221\u0223\u0225\u0227\u0229\u022b\u022d'
              '\u022f\u0231\u0233\u0234\u0235\u0236\u0237\u0238\u0239\u023c'
              '\u023f\u0240\u0242\u0247\u0249\u024b\u024d\u024f\u0250\u0251'
              '\u0252\u0253\u0254\u0255\u0256\u0257\u0258\u0259\u025a\u025b'
              '\u025c\u025d\u025e\u025f\u0260\u0261\u0262\u0263\u0264\u0265'
              '\u0266\u0267\u0268\u0269\u026a\u026b\u026c\u026d\u026e\u026f'
              '\u0270\u0271\u0272\u0273\u0274\u0275\u0276\u0277\u0278\u0279'
              '\u027a\u027b\u027c\u027d\u027e\u027f\u0280\u0281\u0282\u0283'
              '\u0284\u0285\u0286\u0287\u0288\u0289\u028a\u028b\u028c\u028d'
              '\u028e\u028f\u0290\u0291\u0292\u0293\u0295\u0296\u0297\u0298'
              '\u0299\u029a\u029b\u029c\u029d\u029e\u029f\u02a0\u02a1\u02a2'
              '\u02a3\u02a4\u02a5\u02a6\u02a7\u02a8\u02a9\u02aa\u02ab\u02ac'
              '\u02ad\u02ae\u02af\u0371\u0373\u0377\u037b\u037c\u037d\u0390'
              '\u03ac\u03ad\u03ae\u03af\u03b0\u03b1\u03b2\u03b3\u03b4\u03b5'
              '\u03b6\u03b7\u03b8\u03b9\u03ba\u03bb\u03bc\u03bd\u03be\u03bf'
              '\u03c0\u03c1\u03c2\u03c3\u03c4\u03c5\u03c6\u03c7\u03c8\u03c9'
              '\u03ca\u03cb\u03cc\u03cd\u03ce\u03d0\u03d1\u03d5\u03d6\u03d7'
              '\u03d9\u03db\u03dd\u03df\u03e1\u03e3\u03e5\u03e7\u03e9\u03eb'
              '\u03ed\u03ef\u03f0\u03f1\u03f2\u03f3\u03f5\u03f8\u03fb\u03fc'
              '\u0430\u0431\u0432\u0433\u0434\u0435\u0436\u0437\u0438\u0439'
              '\u043a\u043b\u043c\u043d\u043e\u043f\u0440\u0441\u0442\u0443'
              '\u0444\u0445\u0446\u0447\u0448\u0449\u044a\u044b\u044c\u044d'
              '\u044e\u044f\u0450\u0451\u0452\u0453\u0454\u0455\u0456\u0457'
              '\u0458\u0459\u045a\u045b\u045c\u045d\u045e\u045f\u0461\u0463'
              '\u0465\u0467\u0469\u046b\u046d\u046f\u0471\u0473\u0475\u0477'
              '\u0479\u047b\u047d\u047f\u0481\u048b\u048d\u048f\u0491\u0493'
              '\u0495\u0497\u0499\u049b\u049d\u049f\u04a1\u04a3\u04a5\u04a7'
              '\u04a9\u04ab\u04ad\u04af\u04b1\u04b3\u04b5\u04b7\u04b9\u04bb'
              '\u04bd\u04bf\u04c2\u04c4\u04c6\u04c8\u04ca\u04cc\u04ce\u04cf'
              '\u04d1\u04d3\u04d5\u04d7\u04d9\u04db\u04dd\u04df\u04e1\u04e3'
              '\u04e5\u04e7\u04e9\u04eb\u04ed\u04ef\u04f1\u04f3\u04f5\u04f7'
              '\u04f9\u04fb\u04fd\u04ff\u0501\u0503\u0505\u0507\u0509\u050b'
              '\u050d\u050f\u0511\u0513\u0515\u0517\u0519\u051b\u051d\u051f'
              '\u0521\u0523\u0525\u0561\u0562\u0563\u0564\u0565\u0566\u0567'
              '\u0568\u0569\u056a\u056b\u056c\u056d\u056e\u056f\u0570\u0571'
              '\u0572\u0573\u0574\u0575\u0576\u0577\u0578\u0579\u057a\u057b'
              '\u057c\u057d\u057e\u057f\u0580\u0581\u0582\u0583\u0584\u0585'
              '\u0586\u0587\u1d00\u1d01\u1d02\u1d03\u1d04\u1d05\u1d06\u1d07'
              '\u1d08\u1d09\u1d0a\u1d0b\u1d0c\u1d0d\u1d0e\u1d0f\u1d10\u1d11'
              '\u1d12\u1d13\u1d14\u1d15\u1d16\u1d17\u1d18\u1d19\u1d1a\u1d1b'
              '\u1d1c\u1d1d\u1d1e\u1d1f\u1d20\u1d21\u1d22\u1d23\u1d24\u1d25'
              '\u1d26\u1d27\u1d28\u1d29\u1d2a\u1d2b\u1d62\u1d63\u1d64\u1d65'
              '\u1d66\u1d67\u1d68\u1d69\u1d6a\u1d6b\u1d6c\u1d6d\u1d6e\u1d6f'
              '\u1d70\u1d71\u1d72\u1d73\u1d74\u1d75\u1d76\u1d77\u1d79\u1d7a'
              '\u1d7b\u1d7c\u1d7d\u1d7e\u1d7f\u1d80\u1d81\u1d82\u1d83\u1d84'
              '\u1d85\u1d86\u1d87\u1d88\u1d89\u1d8a\u1d8b\u1d8c\u1d8d\u1d8e'
              '\u1d8f\u1d90\u1d91\u1d92\u1d93\u1d94\u1d95\u1d96\u1d97\u1d98'
              '\u1d99\u1d9a\u1e01\u1e03\u1e05\u1e07\u1e09\u1e0b\u1e0d\u1e0f'
              '\u1e11\u1e13\u1e15\u1e17\u1e19\u1e1b\u1e1d\u1e1f\u1e21\u1e23'
              '\u1e25\u1e27\u1e29\u1e2b\u1e2d\u1e2f\u1e31\u1e33\u1e35\u1e37'
              '\u1e39\u1e3b\u1e3d\u1e3f\u1e41\u1e43\u1e45\u1e47\u1e49\u1e4b'
              '\u1e4d\u1e4f\u1e51\u1e53\u1e55\u1e57\u1e59\u1e5b\u1e5d\u1e5f'
              '\u1e61\u1e63\u1e65\u1e67\u1e69\u1e6b\u1e6d\u1e6f\u1e71\u1e73'
              '\u1e75\u1e77\u1e79\u1e7b\u1e7d\u1e7f\u1e81\u1e83\u1e85\u1e87'
              '\u1e89\u1e8b\u1e8d\u1e8f\u1e91\u1e93\u1e95\u1e96\u1e97\u1e98'
              '\u1e99\u1e9a\u1e9b\u1e9c\u1e9d\u1e9f\u1ea1\u1ea3\u1ea5\u1ea7'
              '\u1ea9\u1eab\u1ead\u1eaf\u1eb1\u1eb3\u1eb5\u1eb7\u1eb9\u1ebb'
              '\u1ebd\u1ebf\u1ec1\u1ec3\u1ec5\u1ec7\u1ec9\u1ecb\u1ecd\u1ecf'
              '\u1ed1\u1ed3\u1ed5\u1ed7\u1ed9\u1edb\u1edd\u1edf\u1ee1\u1ee3'
              '\u1ee5\u1ee7\u1ee9\u1eeb\u1eed\u1eef\u1ef1\u1ef3\u1ef5\u1ef7'
              '\u1ef9\u1efb\u1efd\u1eff\u1f00\u1f01\u1f02\u1f03\u1f04\u1f05'
              '\u1f06\u1f07\u1f10\u1f11\u1f12\u1f13\u1f14\u1f15\u1f20\u1f21'
              '\u1f22\u1f23\u1f24\u1f25\u1f26\u1f27\u1f30\u1f31\u1f32\u1f33'
              '\u1f34\u1f35\u1f36\u1f37\u1f40\u1f41\u1f42\u1f43\u1f44\u1f45'
              '\u1f50\u1f51\u1f52\u1f53\u1f54\u1f55\u1f56\u1f57\u1f60\u1f61'
              '\u1f62\u1f63\u1f64\u1f65\u1f66\u1f67\u1f70\u1f71\u1f72\u1f73'
              '\u1f74\u1f75\u1f76\u1f77\u1f78\u1f79\u1f7a\u1f7b\u1f7c\u1f7d'
              '\u1f80\u1f81\u1f82\u1f83\u1f84\u1f85\u1f86\u1f87\u1f90\u1f91'
              '\u1f92\u1f93\u1f94\u1f95\u1f96\u1f97\u1fa0\u1fa1\u1fa2\u1fa3'
              '\u1fa4\u1fa5\u1fa6\u1fa7\u1fb0\u1fb1\u1fb2\u1fb3\u1fb4\u1fb6'
              '\u1fb7\u1fbe\u1fc2\u1fc3\u1fc4\u1fc6\u1fc7\u1fd0\u1fd1\u1fd2'
              '\u1fd3\u1fd6\u1fd7\u1fe0\u1fe1\u1fe2\u1fe3\u1fe4\u1fe5\u1fe6'
              '\u1fe7\u1ff2\u1ff3\u1ff4\u1ff6\u1ff7\u210a\u210e\u210f\u2113'
              '\u212f\u2134\u2139\u213c\u213d\u2146\u2147\u2148\u2149\u214e'
              '\u2184\u2c30\u2c31\u2c32\u2c33\u2c34\u2c35\u2c36\u2c37\u2c38'
              '\u2c39\u2c3a\u2c3b\u2c3c\u2c3d\u2c3e\u2c3f\u2c40\u2c41\u2c42'
              '\u2c43\u2c44\u2c45\u2c46\u2c47\u2c48\u2c49\u2c4a\u2c4b\u2c4c'
              '\u2c4d\u2c4e\u2c4f\u2c50\u2c51\u2c52\u2c53\u2c54\u2c55\u2c56'
              '\u2c57\u2c58\u2c59\u2c5a\u2c5b\u2c5c\u2c5d\u2c5e\u2c61\u2c65'
              '\u2c66\u2c68\u2c6a\u2c6c\u2c71\u2c73\u2c74\u2c76\u2c77\u2c78'
              '\u2c79\u2c7a\u2c7b\u2c7c\u2c81\u2c83\u2c85\u2c87\u2c89\u2c8b'
              '\u2c8d\u2c8f\u2c91\u2c93\u2c95\u2c97\u2c99\u2c9b\u2c9d\u2c9f'
              '\u2ca1\u2ca3\u2ca5\u2ca7\u2ca9\u2cab\u2cad\u2caf\u2cb1\u2cb3'
              '\u2cb5\u2cb7\u2cb9\u2cbb\u2cbd\u2cbf\u2cc1\u2cc3\u2cc5\u2cc7'
              '\u2cc9\u2ccb\u2ccd\u2ccf\u2cd1\u2cd3\u2cd5\u2cd7\u2cd9\u2cdb'
              '\u2cdd\u2cdf\u2ce1\u2ce3\u2ce4\u2cec\u2cee\u2d00\u2d01\u2d02'
              '\u2d03\u2d04\u2d05\u2d06\u2d07\u2d08\u2d09\u2d0a\u2d0b\u2d0c'
              '\u2d0d\u2d0e\u2d0f\u2d10\u2d11\u2d12\u2d13\u2d14\u2d15\u2d16'
              '\u2d17\u2d18\u2d19\u2d1a\u2d1b\u2d1c\u2d1d\u2d1e\u2d1f\u2d20'
              '\u2d21\u2d22\u2d23\u2d24\u2d25\ua641\ua643\ua645\ua647\ua649'
              '\ua64b\ua64d\ua64f\ua651\ua653\ua655\ua657\ua659\ua65b\ua65d'
              '\ua65f\ua663\ua665\ua667\ua669\ua66b\ua66d\ua681\ua683\ua685'
              '\ua687\ua689\ua68b\ua68d\ua68f\ua691\ua693\ua695\ua697\ua723'
              '\ua725\ua727\ua729\ua72b\ua72d\ua72f\ua730\ua731\ua733\ua735'
              '\ua737\ua739\ua73b\ua73d\ua73f\ua741\ua743\ua745\ua747\ua749'
              '\ua74b\ua74d\ua74f\ua751\ua753\ua755\ua757\ua759\ua75b\ua75d'
              '\ua75f\ua761\ua763\ua765\ua767\ua769\ua76b\ua76d\ua76f\ua771'
              '\ua772\ua773\ua774\ua775\ua776\ua777\ua778\ua77a\ua77c\ua77f'
              '\ua781\ua783\ua785\ua787\ua78c\ufb00\ufb01\ufb02\ufb03\ufb04'
              '\ufb05\ufb06\ufb13\ufb14\ufb15\ufb16\ufb17\uff41\uff42\uff43'
              '\uff44\uff45\uff46\uff47\uff48\uff49\uff4a\uff4b\uff4c\uff4d'
              '\uff4e\uff4f\uff50\uff51\uff52\uff53\uff54\uff55\uff56\uff57'
              '\uff58\uff59\uff5a')
uppercase = u('ABCDEFGHIJKLMNOPQRSTUVWXYZ\xc0\xc1\xc2\xc3\xc4\xc5\xc6\xc7\xc8'
              '\xc9\xca\xcb\xcc\xcd\xce\xcf\xd0\xd1\xd2\xd3\xd4\xd5\xd6\xd8'
              '\xd9\xda\xdb\xdc\xdd\xde\u0100\u0102\u0104\u0106\u0108\u010a'
              '\u010c\u010e\u0110\u0112\u0114\u0116\u0118\u011a\u011c\u011e'
              '\u0120\u0122\u0124\u0126\u0128\u012a\u012c\u012e\u0130\u0132'
              '\u0134\u0136\u0139\u013b\u013d\u013f\u0141\u0143\u0145\u0147'
              '\u014a\u014c\u014e\u0150\u0152\u0154\u0156\u0158\u015a\u015c'
              '\u015e\u0160\u0162\u0164\u0166\u0168\u016a\u016c\u016e\u0170'
              '\u0172\u0174\u0176\u0178\u0179\u017b\u017d\u0181\u0182\u0184'
              '\u0186\u0187\u0189\u018a\u018b\u018e\u018f\u0190\u0191\u0193'
              '\u0194\u0196\u0197\u0198\u019c\u019d\u019f\u01a0\u01a2\u01a4'
              '\u01a6\u01a7\u01a9\u01ac\u01ae\u01af\u01b1\u01b2\u01b3\u01b5'
              '\u01b7\u01b8\u01bc\u01c4\u01c7\u01ca\u01cd\u01cf\u01d1\u01d3'
              '\u01d5\u01d7\u01d9\u01db\u01de\u01e0\u01e2\u01e4\u01e6\u01e8'
              '\u01ea\u01ec\u01ee\u01f1\u01f4\u01f6\u01f7\u01f8\u01fa\u01fc'
              '\u01fe\u0200\u0202\u0204\u0206\u0208\u020a\u020c\u020e\u0210'
              '\u0212\u0214\u0216\u0218\u021a\u021c\u021e\u0220\u0222\u0224'
              '\u0226\u0228\u022a\u022c\u022e\u0230\u0232\u023a\u023b\u023d'
              '\u023e\u0241\u0243\u0244\u0245\u0246\u0248\u024a\u024c\u024e'
              '\u0370\u0372\u0376\u0386\u0388\u0389\u038a\u038c\u038e\u038f'
              '\u0391\u0392\u0393\u0394\u0395\u0396\u0397\u0398\u0399\u039a'
              '\u039b\u039c\u039d\u039e\u039f\u03a0\u03a1\u03a3\u03a4\u03a5'
              '\u03a6\u03a7\u03a8\u03a9\u03aa\u03ab\u03cf\u03d2\u03d3\u03d4'
              '\u03d8\u03da\u03dc\u03de\u03e0\u03e2\u03e4\u03e6\u03e8\u03ea'
              '\u03ec\u03ee\u03f4\u03f7\u03f9\u03fa\u03fd\u03fe\u03ff\u0400'
              '\u0401\u0402\u0403\u0404\u0405\u0406\u0407\u0408\u0409\u040a'
              '\u040b\u040c\u040d\u040e\u040f\u0410\u0411\u0412\u0413\u0414'
              '\u0415\u0416\u0417\u0418\u0419\u041a\u041b\u041c\u041d\u041e'
              '\u041f\u0420\u0421\u0422\u0423\u0424\u0425\u0426\u0427\u0428'
              '\u0429\u042a\u042b\u042c\u042d\u042e\u042f\u0460\u0462\u0464'
              '\u0466\u0468\u046a\u046c\u046e\u0470\u0472\u0474\u0476\u0478'
              '\u047a\u047c\u047e\u0480\u048a\u048c\u048e\u0490\u0492\u0494'
              '\u0496\u0498\u049a\u049c\u049e\u04a0\u04a2\u04a4\u04a6\u04a8'
              '\u04aa\u04ac\u04ae\u04b0\u04b2\u04b4\u04b6\u04b8\u04ba\u04bc'
              '\u04be\u04c0\u04c1\u04c3\u04c5\u04c7\u04c9\u04cb\u04cd\u04d0'
              '\u04d2\u04d4\u04d6\u04d8\u04da\u04dc\u04de\u04e0\u04e2\u04e4'
              '\u04e6\u04e8\u04ea\u04ec\u04ee\u04f0\u04f2\u04f4\u04f6\u04f8'
              '\u04fa\u04fc\u04fe\u0500\u0502\u0504\u0506\u0508\u050a\u050c'
              '\u050e\u0510\u0512\u0514\u0516\u0518\u051a\u051c\u051e\u0520'
              '\u0522\u0524\u0531\u0532\u0533\u0534\u0535\u0536\u0537\u0538'
              '\u0539\u053a\u053b\u053c\u053d\u053e\u053f\u0540\u0541\u0542'
              '\u0543\u0544\u0545\u0546\u0547\u0548\u0549\u054a\u054b\u054c'
              '\u054d\u054e\u054f\u0550\u0551\u0552\u0553\u0554\u0555\u0556'
              '\u10a0\u10a1\u10a2\u10a3\u10a4\u10a5\u10a6\u10a7\u10a8\u10a9'
              '\u10aa\u10ab\u10ac\u10ad\u10ae\u10af\u10b0\u10b1\u10b2\u10b3'
              '\u10b4\u10b5\u10b6\u10b7\u10b8\u10b9\u10ba\u10bb\u10bc\u10bd'
              '\u10be\u10bf\u10c0\u10c1\u10c2\u10c3\u10c4\u10c5\u1e00\u1e02'
              '\u1e04\u1e06\u1e08\u1e0a\u1e0c\u1e0e\u1e10\u1e12\u1e14\u1e16'
              '\u1e18\u1e1a\u1e1c\u1e1e\u1e20\u1e22\u1e24\u1e26\u1e28\u1e2a'
              '\u1e2c\u1e2e\u1e30\u1e32\u1e34\u1e36\u1e38\u1e3a\u1e3c\u1e3e'
              '\u1e40\u1e42\u1e44\u1e46\u1e48\u1e4a\u1e4c\u1e4e\u1e50\u1e52'
              '\u1e54\u1e56\u1e58\u1e5a\u1e5c\u1e5e\u1e60\u1e62\u1e64\u1e66'
              '\u1e68\u1e6a\u1e6c\u1e6e\u1e70\u1e72\u1e74\u1e76\u1e78\u1e7a'
              '\u1e7c\u1e7e\u1e80\u1e82\u1e84\u1e86\u1e88\u1e8a\u1e8c\u1e8e'
              '\u1e90\u1e92\u1e94\u1e9e\u1ea0\u1ea2\u1ea4\u1ea6\u1ea8\u1eaa'
              '\u1eac\u1eae\u1eb0\u1eb2\u1eb4\u1eb6\u1eb8\u1eba\u1ebc\u1ebe'
              '\u1ec0\u1ec2\u1ec4\u1ec6\u1ec8\u1eca\u1ecc\u1ece\u1ed0\u1ed2'
              '\u1ed4\u1ed6\u1ed8\u1eda\u1edc\u1ede\u1ee0\u1ee2\u1ee4\u1ee6'
              '\u1ee8\u1eea\u1eec\u1eee\u1ef0\u1ef2\u1ef4\u1ef6\u1ef8\u1efa'
              '\u1efc\u1efe\u1f08\u1f09\u1f0a\u1f0b\u1f0c\u1f0d\u1f0e\u1f0f'
              '\u1f18\u1f19\u1f1a\u1f1b\u1f1c\u1f1d\u1f28\u1f29\u1f2a\u1f2b'
              '\u1f2c\u1f2d\u1f2e\u1f2f\u1f38\u1f39\u1f3a\u1f3b\u1f3c\u1f3d'
              '\u1f3e\u1f3f\u1f48\u1f49\u1f4a\u1f4b\u1f4c\u1f4d\u1f59\u1f5b'
              '\u1f5d\u1f5f\u1f68\u1f69\u1f6a\u1f6b\u1f6c\u1f6d\u1f6e\u1f6f'
              '\u1fb8\u1fb9\u1fba\u1fbb\u1fc8\u1fc9\u1fca\u1fcb\u1fd8\u1fd9'
              '\u1fda\u1fdb\u1fe8\u1fe9\u1fea\u1feb\u1fec\u1ff8\u1ff9\u1ffa'
              '\u1ffb\u2102\u2107\u210b\u210c\u210d\u2110\u2111\u2112\u2115'
              '\u2119\u211a\u211b\u211c\u211d\u2124\u2126\u2128\u212a\u212b'
              '\u212c\u212d\u2130\u2131\u2132\u2133\u213e\u213f\u2145\u2183'
              '\u2c00\u2c01\u2c02\u2c03\u2c04\u2c05\u2c06\u2c07\u2c08\u2c09'
              '\u2c0a\u2c0b\u2c0c\u2c0d\u2c0e\u2c0f\u2c10\u2c11\u2c12\u2c13'
              '\u2c14\u2c15\u2c16\u2c17\u2c18\u2c19\u2c1a\u2c1b\u2c1c\u2c1d'
              '\u2c1e\u2c1f\u2c20\u2c21\u2c22\u2c23\u2c24\u2c25\u2c26\u2c27'
              '\u2c28\u2c29\u2c2a\u2c2b\u2c2c\u2c2d\u2c2e\u2c60\u2c62\u2c63'
              '\u2c64\u2c67\u2c69\u2c6b\u2c6d\u2c6e\u2c6f\u2c70\u2c72\u2c75'
              '\u2c7e\u2c7f\u2c80\u2c82\u2c84\u2c86\u2c88\u2c8a\u2c8c\u2c8e'
              '\u2c90\u2c92\u2c94\u2c96\u2c98\u2c9a\u2c9c\u2c9e\u2ca0\u2ca2'
              '\u2ca4\u2ca6\u2ca8\u2caa\u2cac\u2cae\u2cb0\u2cb2\u2cb4\u2cb6'
              '\u2cb8\u2cba\u2cbc\u2cbe\u2cc0\u2cc2\u2cc4\u2cc6\u2cc8\u2cca'
              '\u2ccc\u2cce\u2cd0\u2cd2\u2cd4\u2cd6\u2cd8\u2cda\u2cdc\u2cde'
              '\u2ce0\u2ce2\u2ceb\u2ced\ua640\ua642\ua644\ua646\ua648\ua64a'
              '\ua64c\ua64e\ua650\ua652\ua654\ua656\ua658\ua65a\ua65c\ua65e'
              '\ua662\ua664\ua666\ua668\ua66a\ua66c\ua680\ua682\ua684\ua686'
              '\ua688\ua68a\ua68c\ua68e\ua690\ua692\ua694\ua696\ua722\ua724'
              '\ua726\ua728\ua72a\ua72c\ua72e\ua732\ua734\ua736\ua738\ua73a'
              '\ua73c\ua73e\ua740\ua742\ua744\ua746\ua748\ua74a\ua74c\ua74e'
              '\ua750\ua752\ua754\ua756\ua758\ua75a\ua75c\ua75e\ua760\ua762'
              '\ua764\ua766\ua768\ua76a\ua76c\ua76e\ua779\ua77b\ua77d\ua77e'
              '\ua780\ua782\ua784\ua786\ua78b\uff21\uff22\uff23\uff24\uff25'
              '\uff26\uff27\uff28\uff29\uff2a\uff2b\uff2c\uff2d\uff2e\uff2f'
              '\uff30\uff31\uff32\uff33\uff34\uff35\uff36\uff37\uff38\uff39'
              '\uff3a')
