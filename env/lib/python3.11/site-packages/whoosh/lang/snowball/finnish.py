from .bases import _StandardStemmer

from whoosh.compat import u


class FinnishStemmer(_StandardStemmer):
    """
    The Finnish Snowball stemmer.

    :cvar __vowels: The Finnish vowels.
    :type __vowels: unicode
    :cvar __restricted_vowels: A subset of the Finnish vowels.
    :type __restricted_vowels: unicode
    :cvar __long_vowels: The Finnish vowels in their long forms.
    :type __long_vowels: tuple
    :cvar __consonants: The Finnish consonants.
    :type __consonants: unicode
    :cvar __double_consonants: The Finnish double consonants.
    :type __double_consonants: tuple
    :cvar __step1_suffixes: Suffixes to be deleted in step 1 of the algorithm.
    :type __step1_suffixes: tuple
    :cvar __step2_suffixes: Suffixes to be deleted in step 2 of the algorithm.
    :type __step2_suffixes: tuple
    :cvar __step3_suffixes: Suffixes to be deleted in step 3 of the algorithm.
    :type __step3_suffixes: tuple
    :cvar __step4_suffixes: Suffixes to be deleted in step 4 of the algorithm.
    :type __step4_suffixes: tuple
    :note: A detailed description of the Finnish
           stemming algorithm can be found under
           http://snowball.tartarus.org/algorithms/finnish/stemmer.html
    """

    __vowels = u("aeiouy\xE4\xF6")
    __restricted_vowels = u("aeiou\xE4\xF6")
    __long_vowels = ("aa", "ee", "ii", "oo", "uu", u("\xE4\xE4"),
                     u("\xF6\xF6"))
    __consonants = "bcdfghjklmnpqrstvwxz"
    __double_consonants = ("bb", "cc", "dd", "ff", "gg", "hh", "jj",
                           "kk", "ll", "mm", "nn", "pp", "qq", "rr",
                           "ss", "tt", "vv", "ww", "xx", "zz")
    __step1_suffixes = ('kaan', u('k\xE4\xE4n'), 'sti', 'kin', 'han',
                        u('h\xE4n'), 'ko', u('k\xF6'), 'pa', u('p\xE4'))
    __step2_suffixes = ('nsa', u('ns\xE4'), 'mme', 'nne', 'si', 'ni',
                        'an', u('\xE4n'), 'en')
    __step3_suffixes = ('siin', 'tten', 'seen', 'han', 'hen', 'hin',
                        'hon', u('h\xE4n'), u('h\xF6n'), 'den', 'tta',
                        u('tt\xE4'), 'ssa', u('ss\xE4'), 'sta',
                        u('st\xE4'), 'lla', u('ll\xE4'), 'lta',
                        u('lt\xE4'), 'lle', 'ksi', 'ine', 'ta',
                        u('t\xE4'), 'na', u('n\xE4'), 'a', u('\xE4'),
                        'n')
    __step4_suffixes = ('impi', 'impa', u('imp\xE4'), 'immi', 'imma',
                        u('imm\xE4'), 'mpi', 'mpa', u('mp\xE4'), 'mmi',
                        'mma', u('mm\xE4'), 'eja', u('ej\xE4'))

    def stem(self, word):
        """
        Stem a Finnish word and return the stemmed form.

        :param word: The word that is stemmed.
        :type word: str or unicode
        :return: The stemmed form.
        :rtype: unicode

        """
        word = word.lower()

        step3_success = False

        r1, r2 = self._r1r2_standard(word, self.__vowels)

        # STEP 1: Particles etc.
        for suffix in self.__step1_suffixes:
            if r1.endswith(suffix):
                if suffix == "sti":
                    if suffix in r2:
                        word = word[:-3]
                        r1 = r1[:-3]
                        r2 = r2[:-3]
                else:
                    if word[-len(suffix) - 1] in u("ntaeiouy\xE4\xF6"):
                        word = word[:-len(suffix)]
                        r1 = r1[:-len(suffix)]
                        r2 = r2[:-len(suffix)]
                break

        # STEP 2: Possessives
        for suffix in self.__step2_suffixes:
            if r1.endswith(suffix):
                if suffix == "si":
                    if word[-3] != "k":
                        word = word[:-2]
                        r1 = r1[:-2]
                        r2 = r2[:-2]

                elif suffix == "ni":
                    word = word[:-2]
                    r1 = r1[:-2]
                    r2 = r2[:-2]
                    if word.endswith("kse"):
                        word = "".join((word[:-3], "ksi"))

                    if r1.endswith("kse"):
                        r1 = "".join((r1[:-3], "ksi"))

                    if r2.endswith("kse"):
                        r2 = "".join((r2[:-3], "ksi"))

                elif suffix == "an":
                    if (word[-4:-2] in ("ta", "na") or
                        word[-5:-2] in ("ssa", "sta", "lla", "lta")):
                        word = word[:-2]
                        r1 = r1[:-2]
                        r2 = r2[:-2]

                elif suffix == u("\xE4n"):
                    if (word[-4:-2] in (u("t\xE4"), u("n\xE4")) or
                        word[-5:-2] in (u("ss\xE4"), u("st\xE4"),
                                        u("ll\xE4"), u("lt\xE4"))):
                        word = word[:-2]
                        r1 = r1[:-2]
                        r2 = r2[:-2]

                elif suffix == "en":
                    if word[-5:-2] in ("lle", "ine"):
                        word = word[:-2]
                        r1 = r1[:-2]
                        r2 = r2[:-2]
                else:
                    word = word[:-3]
                    r1 = r1[:-3]
                    r2 = r2[:-3]
                break

        # STEP 3: Cases
        for suffix in self.__step3_suffixes:
            if r1.endswith(suffix):
                if suffix in ("han", "hen", "hin", "hon", u("h\xE4n"),
                              u("h\xF6n")):
                    if ((suffix == "han" and word[-4] == "a") or
                        (suffix == "hen" and word[-4] == "e") or
                        (suffix == "hin" and word[-4] == "i") or
                        (suffix == "hon" and word[-4] == "o") or
                        (suffix == u("h\xE4n") and word[-4] == u("\xE4")) or
                        (suffix == u("h\xF6n") and word[-4] == u("\xF6"))):
                        word = word[:-3]
                        r1 = r1[:-3]
                        r2 = r2[:-3]
                        step3_success = True

                elif suffix in ("siin", "den", "tten"):
                    if (word[-len(suffix) - 1] == "i" and
                        word[-len(suffix) - 2] in self.__restricted_vowels):
                        word = word[:-len(suffix)]
                        r1 = r1[:-len(suffix)]
                        r2 = r2[:-len(suffix)]
                        step3_success = True
                    else:
                        continue

                elif suffix == "seen":
                    if word[-6:-4] in self.__long_vowels:
                        word = word[:-4]
                        r1 = r1[:-4]
                        r2 = r2[:-4]
                        step3_success = True
                    else:
                        continue

                elif suffix in ("a", u("\xE4")):
                    if word[-2] in self.__vowels and word[-3] in self.__consonants:
                        word = word[:-1]
                        r1 = r1[:-1]
                        r2 = r2[:-1]
                        step3_success = True

                elif suffix in ("tta", u("tt\xE4")):
                    if word[-4] == "e":
                        word = word[:-3]
                        r1 = r1[:-3]
                        r2 = r2[:-3]
                        step3_success = True

                elif suffix == "n":
                    word = word[:-1]
                    r1 = r1[:-1]
                    r2 = r2[:-1]
                    step3_success = True

                    if word[-2:] == "ie" or word[-2:] in self.__long_vowels:
                        word = word[:-1]
                        r1 = r1[:-1]
                        r2 = r2[:-1]
                else:
                    word = word[:-len(suffix)]
                    r1 = r1[:-len(suffix)]
                    r2 = r2[:-len(suffix)]
                    step3_success = True
                break

        # STEP 4: Other endings
        for suffix in self.__step4_suffixes:
            if r2.endswith(suffix):
                if suffix in ("mpi", "mpa", u("mp\xE4"), "mmi", "mma",
                              u("mm\xE4")):
                    if word[-5:-3] != "po":
                        word = word[:-3]
                        r1 = r1[:-3]
                        r2 = r2[:-3]
                else:
                    word = word[:-len(suffix)]
                    r1 = r1[:-len(suffix)]
                    r2 = r2[:-len(suffix)]
                break

        # STEP 5: Plurals
        if step3_success and len(r1) >= 1 and r1[-1] in "ij":
            word = word[:-1]
            r1 = r1[:-1]

        elif (not step3_success and len(r1) >= 2 and
              r1[-1] == "t" and r1[-2] in self.__vowels):
            word = word[:-1]
            r1 = r1[:-1]
            r2 = r2[:-1]
            if r2.endswith("imma"):
                word = word[:-4]
                r1 = r1[:-4]
            elif r2.endswith("mma") and r2[-5:-3] != "po":
                word = word[:-3]
                r1 = r1[:-3]

        # STEP 6: Tidying up
        if r1[-2:] in self.__long_vowels:
            word = word[:-1]
            r1 = r1[:-1]

        if (len(r1) >= 2 and r1[-2] in self.__consonants and
            r1[-1] in u("a\xE4ei")):
            word = word[:-1]
            r1 = r1[:-1]

        if r1.endswith(("oj", "uj")):
            word = word[:-1]
            r1 = r1[:-1]

        if r1.endswith("jo"):
            word = word[:-1]
            r1 = r1[:-1]

        # If the word ends with a double consonant
        # followed by zero or more vowels, the last consonant is removed.
        for i in range(1, len(word)):
            if word[-i] in self.__vowels:
                continue
            else:
                if i == 1:
                    if word[-i - 1:] in self.__double_consonants:
                        word = word[:-1]
                else:
                    if word[-i - 1:-i + 1] in self.__double_consonants:
                        word = "".join((word[:-i], word[-i + 1:]))
                break


        return word
