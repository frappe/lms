from .bases import _StandardStemmer

from whoosh.compat import u


class RomanianStemmer(_StandardStemmer):

    """
    The Romanian Snowball stemmer.

    :cvar __vowels: The Romanian vowels.
    :type __vowels: unicode
    :cvar __step0_suffixes: Suffixes to be deleted in step 0 of the algorithm.
    :type __step0_suffixes: tuple
    :cvar __step1_suffixes: Suffixes to be deleted in step 1 of the algorithm.
    :type __step1_suffixes: tuple
    :cvar __step2_suffixes: Suffixes to be deleted in step 2 of the algorithm.
    :type __step2_suffixes: tuple
    :cvar __step3_suffixes: Suffixes to be deleted in step 3 of the algorithm.
    :type __step3_suffixes: tuple
    :note: A detailed description of the Romanian
           stemming algorithm can be found under
           http://snowball.tartarus.org/algorithms/romanian/stemmer.html

    """

    __vowels = u("aeiou\u0103\xE2\xEE")
    __step0_suffixes = ('iilor', 'ului', 'elor', 'iile', 'ilor',
                        'atei', u('a\u0163ie'), u('a\u0163ia'), 'aua',
                        'ele', 'iua', 'iei', 'ile', 'ul', 'ea',
                        'ii')
    __step1_suffixes = ('abilitate', 'abilitati', u('abilit\u0103\u0163i'),
                        'ibilitate', u('abilit\u0103i'), 'ivitate',
                        'ivitati', u('ivit\u0103\u0163i'), 'icitate',
                        'icitati', u('icit\u0103\u0163i'), 'icatori',
                        u('ivit\u0103i'), u('icit\u0103i'), 'icator',
                        u('a\u0163iune'), 'atoare', u('\u0103toare'),
                        u('i\u0163iune'), 'itoare', 'iciva', 'icive',
                        'icivi', u('iciv\u0103'), 'icala', 'icale',
                        'icali', u('ical\u0103'), 'ativa', 'ative',
                        'ativi', u('ativ\u0103'), 'atori', u('\u0103tori'),
                        'itiva', 'itive', 'itivi', u('itiv\u0103'),
                        'itori', 'iciv', 'ical', 'ativ', 'ator',
                        u('\u0103tor'), 'itiv', 'itor')
    __step2_suffixes = ('abila', 'abile', 'abili', u('abil\u0103'),
                        'ibila', 'ibile', 'ibili', u('ibil\u0103'),
                        'atori', 'itate', 'itati', u('it\u0103\u0163i'),
                        'abil', 'ibil', 'oasa', u('oas\u0103'), 'oase',
                        'anta', 'ante', 'anti', u('ant\u0103'), 'ator',
                        u('it\u0103i'), 'iune', 'iuni', 'isme', 'ista',
                        'iste', 'isti', u('ist\u0103'), u('i\u015Fti'),
                        'ata', u('at\u0103'), 'ati', 'ate', 'uta',
                        u('ut\u0103'), 'uti', 'ute', 'ita', u('it\u0103'),
                        'iti', 'ite', 'ica', 'ice', 'ici', u('ic\u0103'),
                        'osi', u('o\u015Fi'), 'ant', 'iva', 'ive', 'ivi',
                        u('iv\u0103'), 'ism', 'ist', 'at', 'ut', 'it',
                        'ic', 'os', 'iv')
    __step3_suffixes = (u('seser\u0103\u0163i'), u('aser\u0103\u0163i'),
                        u('iser\u0103\u0163i'), u('\xE2ser\u0103\u0163i'),
                        u('user\u0103\u0163i'), u('seser\u0103m'),
                        u('aser\u0103m'), u('iser\u0103m'), u('\xE2ser\u0103m'),
                        u('user\u0103m'), u('ser\u0103\u0163i'), u('sese\u015Fi'),
                        u('seser\u0103'), u('easc\u0103'), u('ar\u0103\u0163i'),
                        u('ur\u0103\u0163i'), u('ir\u0103\u0163i'),
                        u('\xE2r\u0103\u0163i'), u('ase\u015Fi'),
                        u('aser\u0103'), u('ise\u015Fi'), u('iser\u0103'),
                        u('\xe2se\u015Fi'), u('\xE2ser\u0103'),
                        u('use\u015Fi'), u('user\u0103'), u('ser\u0103m'),
                        'sesem', 'indu', '\xE2ndu', u('eaz\u0103'),
                        u('e\u015Fti'), u('e\u015Fte'), u('\u0103\u015Fti'),
                        u('\u0103\u015Fte'), u('ea\u0163i'), u('ia\u0163i'),
                        u('ar\u0103m'), u('ur\u0103m'), u('ir\u0103m'),
                        u('\xE2r\u0103m'), 'asem', 'isem',
                        '\xE2sem', 'usem', u('se\u015Fi'), u('ser\u0103'),
                        'sese', 'are', 'ere', 'ire', '\xE2re',
                        'ind', '\xE2nd', 'eze', 'ezi', 'esc',
                        u('\u0103sc'), 'eam', 'eai', 'eau', 'iam',
                        'iai', 'iau', u('a\u015Fi'), u('ar\u0103'),
                        u('u\u015Fi'), u('ur\u0103'), u('i\u015Fi'), u('ir\u0103'),
                        u('\xE2\u015Fi'), u('\xe2r\u0103'), 'ase',
                        'ise', '\xE2se', 'use', u('a\u0163i'),
                        u('e\u0163i'), u('i\u0163i'), u('\xe2\u0163i'), 'sei',
                        'ez', 'am', 'ai', 'au', 'ea', 'ia', 'ui',
                        '\xE2i', u('\u0103m'), 'em', 'im', '\xE2m',
                        'se')

    def stem(self, word):
        """
        Stem a Romanian word and return the stemmed form.

        :param word: The word that is stemmed.
        :type word: str or unicode
        :return: The stemmed form.
        :rtype: unicode

        """
        word = word.lower()

        step1_success = False
        step2_success = False

        for i in range(1, len(word) - 1):
            if word[i - 1] in self.__vowels and word[i + 1] in self.__vowels:
                if word[i] == "u":
                    word = "".join((word[:i], "U", word[i + 1:]))

                elif word[i] == "i":
                    word = "".join((word[:i], "I", word[i + 1:]))

        r1, r2 = self._r1r2_standard(word, self.__vowels)
        rv = self._rv_standard(word, self.__vowels)

        # STEP 0: Removal of plurals and other simplifications
        for suffix in self.__step0_suffixes:
            if word.endswith(suffix):
                if suffix in r1:
                    if suffix in ("ul", "ului"):
                        word = word[:-len(suffix)]

                        if suffix in rv:
                            rv = rv[:-len(suffix)]
                        else:
                            rv = ""

                    elif (suffix == "aua" or suffix == "atei" or
                          (suffix == "ile" and word[-5:-3] != "ab")):
                        word = word[:-2]

                    elif suffix in ("ea", "ele", "elor"):
                        word = "".join((word[:-len(suffix)], "e"))

                        if suffix in rv:
                            rv = "".join((rv[:-len(suffix)], "e"))
                        else:
                            rv = ""

                    elif suffix in ("ii", "iua", "iei",
                                    "iile", "iilor", "ilor"):
                        word = "".join((word[:-len(suffix)], "i"))

                        if suffix in rv:
                            rv = "".join((rv[:-len(suffix)], "i"))
                        else:
                            rv = ""

                    elif suffix in ("a\u0163ie", "a\u0163ia"):
                        word = word[:-1]
                break

        # STEP 1: Reduction of combining suffixes
        while True:

            replacement_done = False

            for suffix in self.__step1_suffixes:
                if word.endswith(suffix):
                    if suffix in r1:
                        step1_success = True
                        replacement_done = True

                        if suffix in ("abilitate", "abilitati",
                                      "abilit\u0103i",
                                      "abilit\u0103\u0163i"):
                            word = "".join((word[:-len(suffix)], "abil"))

                        elif suffix == "ibilitate":
                            word = word[:-5]

                        elif suffix in ("ivitate", "ivitati",
                                        "ivit\u0103i",
                                        "ivit\u0103\u0163i"):
                            word = "".join((word[:-len(suffix)], "iv"))

                        elif suffix in ("icitate", "icitati", "icit\u0103i",
                                        "icit\u0103\u0163i", "icator",
                                        "icatori", "iciv", "iciva",
                                        "icive", "icivi", "iciv\u0103",
                                        "ical", "icala", "icale", "icali",
                                        "ical\u0103"):
                            word = "".join((word[:-len(suffix)], "ic"))

                        elif suffix in ("ativ", "ativa", "ative", "ativi",
                                        "ativ\u0103", "a\u0163iune",
                                        "atoare", "ator", "atori",
                                        "\u0103toare",
                                        "\u0103tor", "\u0103tori"):
                            word = "".join((word[:-len(suffix)], "at"))

                            if suffix in r2:
                                r2 = "".join((r2[:-len(suffix)], "at"))

                        elif suffix in ("itiv", "itiva", "itive", "itivi",
                                        "itiv\u0103", "i\u0163iune",
                                        "itoare", "itor", "itori"):
                            word = "".join((word[:-len(suffix)], "it"))

                            if suffix in r2:
                                r2 = "".join((r2[:-len(suffix)], "it"))
                    else:
                        step1_success = False
                    break

            if not replacement_done:
                break

        # STEP 2: Removal of standard suffixes
        for suffix in self.__step2_suffixes:
            if word.endswith(suffix):
                if suffix in r2:
                    step2_success = True

                    if suffix in ("iune", "iuni"):
                        if word[-5] == "\u0163":
                            word = "".join((word[:-5], "t"))

                    elif suffix in ("ism", "isme", "ist", "ista", "iste",
                                    "isti", "ist\u0103", "i\u015Fti"):
                        word = "".join((word[:-len(suffix)], "ist"))

                    else:
                        word = word[:-len(suffix)]
                break

        # STEP 3: Removal of verb suffixes
        if not step1_success and not step2_success:
            for suffix in self.__step3_suffixes:
                try:
                    if word.endswith(suffix):
                        if suffix in rv:
                            if suffix in (u('seser\u0103\u0163i'), u('seser\u0103m'),
                                          u('ser\u0103\u0163i'), u('sese\u015Fi'),
                                          u('seser\u0103'), u('ser\u0103m'), 'sesem',
                                          u('se\u015Fi'), u('ser\u0103'), 'sese',
                                          u('a\u0163i'), u('e\u0163i'), u('i\u0163i'),
                                          u('\xE2\u0163i'), 'sei', u('\u0103m'),
                                          'em', 'im', '\xE2m', 'se'):
                                word = word[:-len(suffix)]
                                rv = rv[:-len(suffix)]
                            else:
                                if (not rv.startswith(suffix) and
                                    rv[rv.index(suffix) - 1] not in
                                    "aeio\u0103\xE2\xEE"):
                                    word = word[:-len(suffix)]
                            break
                except UnicodeDecodeError:
                    # The word is unicode, but suffix is not
                    continue

        # STEP 4: Removal of final vowel
        for suffix in ("ie", "a", "e", "i", "\u0103"):
            if word.endswith(suffix):
                if suffix in rv:
                    word = word[:-len(suffix)]
                break

        word = word.replace("I", "i").replace("U", "u")
        return word
