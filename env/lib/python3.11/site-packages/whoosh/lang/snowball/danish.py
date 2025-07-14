from .bases import _ScandinavianStemmer

from whoosh.compat import u


class DanishStemmer(_ScandinavianStemmer):
    """
    The Danish Snowball stemmer.

    :cvar __vowels: The Danish vowels.
    :type __vowels: unicode
    :cvar __consonants: The Danish consonants.
    :type __consonants: unicode
    :cvar __double_consonants: The Danish double consonants.
    :type __double_consonants: tuple
    :cvar __s_ending: Letters that may directly appear before a word final 's'.
    :type __s_ending: unicode
    :cvar __step1_suffixes: Suffixes to be deleted in step 1 of the algorithm.
    :type __step1_suffixes: tuple
    :cvar __step2_suffixes: Suffixes to be deleted in step 2 of the algorithm.
    :type __step2_suffixes: tuple
    :cvar __step3_suffixes: Suffixes to be deleted in step 3 of the algorithm.
    :type __step3_suffixes: tuple
    :note: A detailed description of the Danish
           stemming algorithm can be found under
           http://snowball.tartarus.org/algorithms/danish/stemmer.html

    """

    # The language's vowels and other important characters are defined.
    __vowels = u("aeiouy\xE6\xE5\xF8")
    __consonants = "bcdfghjklmnpqrstvwxz"
    __double_consonants = ("bb", "cc", "dd", "ff", "gg", "hh", "jj",
                           "kk", "ll", "mm", "nn", "pp", "qq", "rr",
                           "ss", "tt", "vv", "ww", "xx", "zz")
    __s_ending = u("abcdfghjklmnoprtvyz\xE5")

    # The different suffixes, divided into the algorithm's steps
    # and organized by length, are listed in tuples.
    __step1_suffixes = ("erendes", "erende", "hedens", "ethed",
                        "erede", "heden", "heder", "endes",
                        "ernes", "erens", "erets", "ered",
                        "ende", "erne", "eren", "erer", "heds",
                        "enes", "eres", "eret", "hed", "ene", "ere",
                        "ens", "ers", "ets", "en", "er", "es", "et",
                        "e", "s")
    __step2_suffixes = ("gd", "dt", "gt", "kt")
    __step3_suffixes = ("elig", u("l\xF8st"), "lig", "els", "ig")

    def stem(self, word):
        """
        Stem a Danish word and return the stemmed form.

        :param word: The word that is stemmed.
        :type word: str or unicode
        :return: The stemmed form.
        :rtype: unicode

        """
        # Every word is put into lower case for normalization.
        word = word.lower()

        # After this, the required regions are generated
        # by the respective helper method.
        r1 = self._r1_scandinavian(word, self.__vowels)

        # Then the actual stemming process starts.
        # Every new step is explicitly indicated
        # according to the descriptions on the Snowball website.

        # STEP 1
        for suffix in self.__step1_suffixes:
            if r1.endswith(suffix):
                if suffix == "s":
                    if word[-2] in self.__s_ending:
                        word = word[:-1]
                        r1 = r1[:-1]
                else:
                    word = word[:-len(suffix)]
                    r1 = r1[:-len(suffix)]
                break

        # STEP 2
        for suffix in self.__step2_suffixes:
            if r1.endswith(suffix):
                word = word[:-1]
                r1 = r1[:-1]
                break

        # STEP 3
        if r1.endswith("igst"):
            word = word[:-2]
            r1 = r1[:-2]

        for suffix in self.__step3_suffixes:
            if r1.endswith(suffix):
                if suffix == u("l\xF8st"):
                    word = word[:-1]
                    r1 = r1[:-1]
                else:
                    word = word[:-len(suffix)]
                    r1 = r1[:-len(suffix)]

                    if r1.endswith(self.__step2_suffixes):
                        word = word[:-1]
                        r1 = r1[:-1]
                break

        # STEP 4: Undouble
        for double_cons in self.__double_consonants:
            if word.endswith(double_cons) and len(word) > 3:
                word = word[:-1]
                break

        return word
