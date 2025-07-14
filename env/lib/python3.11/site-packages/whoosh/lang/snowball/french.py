from .bases import _StandardStemmer

from whoosh.compat import u


class FrenchStemmer(_StandardStemmer):

    """
    The French Snowball stemmer.

    :cvar __vowels: The French vowels.
    :type __vowels: unicode
    :cvar __step1_suffixes: Suffixes to be deleted in step 1 of the algorithm.
    :type __step1_suffixes: tuple
    :cvar __step2a_suffixes: Suffixes to be deleted in step 2a of the algorithm.
    :type __step2a_suffixes: tuple
    :cvar __step2b_suffixes: Suffixes to be deleted in step 2b of the algorithm.
    :type __step2b_suffixes: tuple
    :cvar __step4_suffixes: Suffixes to be deleted in step 4 of the algorithm.
    :type __step4_suffixes: tuple
    :note: A detailed description of the French
           stemming algorithm can be found under
           http://snowball.tartarus.org/algorithms/french/stemmer.html
    """

    __vowels = u("aeiouy\xE2\xE0\xEB\xE9\xEA\xE8\xEF\xEE\xF4\xFB\xF9")
    __step1_suffixes = ('issements', 'issement', 'atrices', 'atrice',
                        'ateurs', 'ations', 'logies', 'usions',
                        'utions', 'ements', 'amment', 'emment',
                        'ances', 'iqUes', 'ismes', 'ables', 'istes',
                        'ateur', 'ation', 'logie', 'usion', 'ution',
                        'ences', 'ement', 'euses', 'ments', 'ance',
                        'iqUe', 'isme', 'able', 'iste', 'ence',
                        u('it\xE9s'), 'ives', 'eaux', 'euse', 'ment',
                        'eux', u('it\xE9'), 'ive', 'ifs', 'aux', 'if')
    __step2a_suffixes = ('issaIent', 'issantes', 'iraIent', 'issante',
                         'issants', 'issions', 'irions', 'issais',
                         'issait', 'issant', 'issent', 'issiez', 'issons',
                         'irais', 'irait', 'irent', 'iriez', 'irons',
                         'iront', 'isses', 'issez', u('\xEEmes'),
                         u('\xEEtes'), 'irai', 'iras', 'irez', 'isse',
                         'ies', 'ira', u('\xEEt'), 'ie', 'ir', 'is',
                         'it', 'i')
    __step2b_suffixes = ('eraIent', 'assions', 'erions', 'assent',
                         'assiez', u('\xE8rent'), 'erais', 'erait',
                         'eriez', 'erons', 'eront', 'aIent', 'antes',
                         'asses', 'ions', 'erai', 'eras', 'erez',
                         u('\xE2mes'), u('\xE2tes'), 'ante', 'ants',
                         'asse', u('\xE9es'), 'era', 'iez', 'ais',
                         'ait', 'ant', u('\xE9e'), u('\xE9s'), 'er',
                         'ez', u('\xE2t'), 'ai', 'as', u('\xE9'), 'a')
    __step4_suffixes = (u('i\xE8re'), u('I\xE8re'), 'ion', 'ier', 'Ier',
                        'e', u('\xEB'))

    def stem(self, word):
        """
        Stem a French word and return the stemmed form.

        :param word: The word that is stemmed.
        :type word: str or unicode
        :return: The stemmed form.
        :rtype: unicode

        """
        word = word.lower()

        step1_success = False
        rv_ending_found = False
        step2a_success = False
        step2b_success = False

        # Every occurrence of 'u' after 'q' is put into upper case.
        for i in range(1, len(word)):
            if word[i - 1] == "q" and word[i] == "u":
                word = "".join((word[:i], "U", word[i + 1:]))

        # Every occurrence of 'u' and 'i'
        # between vowels is put into upper case.
        # Every occurrence of 'y' preceded or
        # followed by a vowel is also put into upper case.
        for i in range(1, len(word) - 1):
            if word[i - 1] in self.__vowels and word[i + 1] in self.__vowels:
                if word[i] == "u":
                    word = "".join((word[:i], "U", word[i + 1:]))

                elif word[i] == "i":
                    word = "".join((word[:i], "I", word[i + 1:]))

            if word[i - 1] in self.__vowels or word[i + 1] in self.__vowels:
                if word[i] == "y":
                    word = "".join((word[:i], "Y", word[i + 1:]))

        r1, r2 = self._r1r2_standard(word, self.__vowels)
        rv = self.__rv_french(word, self.__vowels)

        # STEP 1: Standard suffix removal
        for suffix in self.__step1_suffixes:
            if word.endswith(suffix):
                if suffix == "eaux":
                    word = word[:-1]
                    step1_success = True

                elif suffix in ("euse", "euses"):
                    if suffix in r2:
                        word = word[:-len(suffix)]
                        step1_success = True

                    elif suffix in r1:
                        word = "".join((word[:-len(suffix)], "eux"))
                        step1_success = True

                elif suffix in ("ement", "ements") and suffix in rv:
                    word = word[:-len(suffix)]
                    step1_success = True

                    if word[-2:] == "iv" and "iv" in r2:
                        word = word[:-2]

                        if word[-2:] == "at" and "at" in r2:
                            word = word[:-2]

                    elif word[-3:] == "eus":
                        if "eus" in r2:
                            word = word[:-3]
                        elif "eus" in r1:
                            word = "".join((word[:-1], "x"))

                    elif word[-3:] in ("abl", "iqU"):
                        if "abl" in r2 or "iqU" in r2:
                            word = word[:-3]

                    elif word[-3:] in (u("i\xE8r"), u("I\xE8r")):
                        if u("i\xE8r") in rv or u("I\xE8r") in rv:
                            word = "".join((word[:-3], "i"))

                elif suffix == "amment" and suffix in rv:
                    word = "".join((word[:-6], "ant"))
                    rv = "".join((rv[:-6], "ant"))
                    rv_ending_found = True

                elif suffix == "emment" and suffix in rv:
                    word = "".join((word[:-6], "ent"))
                    rv_ending_found = True

                elif (suffix in ("ment", "ments") and suffix in rv and
                      not rv.startswith(suffix) and
                      rv[rv.rindex(suffix) - 1] in self.__vowels):
                    word = word[:-len(suffix)]
                    rv = rv[:-len(suffix)]
                    rv_ending_found = True

                elif suffix == "aux" and suffix in r1:
                    word = "".join((word[:-2], "l"))
                    step1_success = True

                elif (suffix in ("issement", "issements") and suffix in r1
                      and word[-len(suffix) - 1] not in self.__vowels):
                    word = word[:-len(suffix)]
                    step1_success = True

                elif suffix in ("ance", "iqUe", "isme", "able", "iste",
                              "eux", "ances", "iqUes", "ismes",
                              "ables", "istes") and suffix in r2:
                    word = word[:-len(suffix)]
                    step1_success = True

                elif suffix in ("atrice", "ateur", "ation", "atrices",
                                "ateurs", "ations") and suffix in r2:
                    word = word[:-len(suffix)]
                    step1_success = True

                    if word[-2:] == "ic":
                        if "ic" in r2:
                            word = word[:-2]
                        else:
                            word = "".join((word[:-2], "iqU"))

                elif suffix in ("logie", "logies") and suffix in r2:
                    word = "".join((word[:-len(suffix)], "log"))
                    step1_success = True

                elif (suffix in ("usion", "ution", "usions", "utions") and
                      suffix in r2):
                    word = "".join((word[:-len(suffix)], "u"))
                    step1_success = True

                elif suffix in ("ence", "ences") and suffix in r2:
                    word = "".join((word[:-len(suffix)], "ent"))
                    step1_success = True

                elif suffix in (u("it\xE9"), u("it\xE9s")) and suffix in r2:
                    word = word[:-len(suffix)]
                    step1_success = True

                    if word[-4:] == "abil":
                        if "abil" in r2:
                            word = word[:-4]
                        else:
                            word = "".join((word[:-2], "l"))

                    elif word[-2:] == "ic":
                        if "ic" in r2:
                            word = word[:-2]
                        else:
                            word = "".join((word[:-2], "iqU"))

                    elif word[-2:] == "iv":
                        if "iv" in r2:
                            word = word[:-2]

                elif (suffix in ("if", "ive", "ifs", "ives") and
                      suffix in r2):
                    word = word[:-len(suffix)]
                    step1_success = True

                    if word[-2:] == "at" and "at" in r2:
                        word = word[:-2]

                        if word[-2:] == "ic":
                            if "ic" in r2:
                                word = word[:-2]
                            else:
                                word = "".join((word[:-2], "iqU"))
                break

        # STEP 2a: Verb suffixes beginning 'i'
        if not step1_success or rv_ending_found:
            for suffix in self.__step2a_suffixes:
                if word.endswith(suffix):
                    if (suffix in rv and len(rv) > len(suffix) and
                        rv[rv.rindex(suffix) - 1] not in self.__vowels):
                        word = word[:-len(suffix)]
                        step2a_success = True
                    break

        # STEP 2b: Other verb suffixes
            if not step2a_success:
                for suffix in self.__step2b_suffixes:
                    if rv.endswith(suffix):
                        if suffix == "ions" and "ions" in r2:
                            word = word[:-4]
                            step2b_success = True

                        elif suffix in ('eraIent', 'erions', u('\xE8rent'),
                                        'erais', 'erait', 'eriez',
                                        'erons', 'eront', 'erai', 'eras',
                                        'erez', u('\xE9es'), 'era', 'iez',
                                        u('\xE9e'), u('\xE9s'), 'er', 'ez',
                                        u('\xE9')):
                            word = word[:-len(suffix)]
                            step2b_success = True

                        elif suffix in ('assions', 'assent', 'assiez',
                                        'aIent', 'antes', 'asses',
                                        u('\xE2mes'), u('\xE2tes'), 'ante',
                                        'ants', 'asse', 'ais', 'ait',
                                        'ant', u('\xE2t'), 'ai', 'as',
                                        'a'):
                            word = word[:-len(suffix)]
                            rv = rv[:-len(suffix)]
                            step2b_success = True
                            if rv.endswith("e"):
                                word = word[:-1]
                        break

        # STEP 3
        if step1_success or step2a_success or step2b_success:
            if word[-1] == "Y":
                word = "".join((word[:-1], "i"))
            elif word[-1] == u("\xE7"):
                word = "".join((word[:-1], "c"))

        # STEP 4: Residual suffixes
        else:
            if (len(word) >= 2 and word[-1] == "s" and
                word[-2] not in u("aiou\xE8s")):
                word = word[:-1]

            for suffix in self.__step4_suffixes:
                if word.endswith(suffix):
                    if suffix in rv:
                        if (suffix == "ion" and suffix in r2 and
                            rv[-4] in "st"):
                            word = word[:-3]

                        elif suffix in ("ier", u("i\xE8re"), "Ier",
                                        u("I\xE8re")):
                            word = "".join((word[:-len(suffix)], "i"))

                        elif suffix == "e":
                            word = word[:-1]

                        elif suffix == u("\xEB") and word[-3:-1] == "gu":
                            word = word[:-1]
                        break

        # STEP 5: Undouble
        if word.endswith(("enn", "onn", "ett", "ell", "eill")):
            word = word[:-1]

        # STEP 6: Un-accent
        for i in range(1, len(word)):
            if word[-i] not in self.__vowels:
                i += 1
            else:
                if i != 1 and word[-i] in (u("\xE9"), u("\xE8")):
                    word = "".join((word[:-i], "e", word[-i + 1:]))
                break

        word = (word.replace("I", "i")
                    .replace("U", "u")
                    .replace("Y", "y"))
        return word

    def __rv_french(self, word, vowels):
        """
        Return the region RV that is used by the French stemmer.

        If the word begins with two vowels, RV is the region after
        the third letter. Otherwise, it is the region after the first
        vowel not at the beginning of the word, or the end of the word
        if these positions cannot be found. (Exceptionally, u'par',
        u'col' or u'tap' at the beginning of a word is also taken to
        define RV as the region to their right.)

        :param word: The French word whose region RV is determined.
        :type word: str or unicode
        :param vowels: The French vowels that are used to determine
                       the region RV.
        :type vowels: unicode
        :return: the region RV for the respective French word.
        :rtype: unicode
        :note: This helper method is invoked by the stem method of
               the subclass FrenchStemmer. It is not to be invoked directly!

        """
        rv = ""
        if len(word) >= 2:
            if (word.startswith(("par", "col", "tap")) or
                (word[0] in vowels and word[1] in vowels)):
                rv = word[3:]
            else:
                for i in range(1, len(word)):
                    if word[i] in vowels:
                        rv = word[i + 1:]
                        break

        return rv
