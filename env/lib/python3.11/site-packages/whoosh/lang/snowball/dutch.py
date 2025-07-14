from .bases import _StandardStemmer

from whoosh.compat import u


class DutchStemmer(_StandardStemmer):
    """
    The Dutch Snowball stemmer.

    :cvar __vowels: The Dutch vowels.
    :type __vowels: unicode
    :cvar __step1_suffixes: Suffixes to be deleted in step 1 of the algorithm.
    :type __step1_suffixes: tuple
    :cvar __step3b_suffixes: Suffixes to be deleted in step 3b of the algorithm.
    :type __step3b_suffixes: tuple
    :note: A detailed description of the Dutch
           stemming algorithm can be found under
           http://snowball.tartarus.org/algorithms/dutch/stemmer.html
    """

    __vowels = u("aeiouy\xE8")
    __step1_suffixes = ("heden", "ene", "en", "se", "s")
    __step3b_suffixes = ("baar", "lijk", "bar", "end", "ing", "ig")

    def stem(self, word):
        """
        Stem a Dutch word and return the stemmed form.

        :param word: The word that is stemmed.
        :type word: str or unicode
        :return: The stemmed form.
        :rtype: unicode

        """
        word = word.lower()

        step2_success = False

        # Vowel accents are removed.
        word = (word.replace(u("\xE4"), "a").replace(u("\xE1"), "a")
                    .replace(u("\xEB"), "e").replace(u("\xE9"), "e")
                    .replace(u("\xED"), "i").replace(u("\xEF"), "i")
                    .replace(u("\xF6"), "o").replace(u("\xF3"), "o")
                    .replace(u("\xFC"), "u").replace(u("\xFA"), "u"))

        # An initial 'y', a 'y' after a vowel,
        # and an 'i' between self.__vowels is put into upper case.
        # As from now these are treated as consonants.
        if word.startswith("y"):
            word = "".join(("Y", word[1:]))

        for i in range(1, len(word)):
            if word[i - 1] in self.__vowels and word[i] == "y":
                word = "".join((word[:i], "Y", word[i + 1:]))

        for i in range(1, len(word) - 1):
            if (word[i - 1] in self.__vowels and word[i] == "i" and
               word[i + 1] in self.__vowels):
                word = "".join((word[:i], "I", word[i + 1:]))

        r1, r2 = self._r1r2_standard(word, self.__vowels)

        # R1 is adjusted so that the region before it
        # contains at least 3 letters.
        for i in range(1, len(word)):
            if word[i] not in self.__vowels and word[i - 1] in self.__vowels:
                if len(word[:i + 1]) < 3 and len(word[:i + 1]) > 0:
                    r1 = word[3:]
                elif len(word[:i + 1]) == 0:
                    return word
                break

        # STEP 1
        for suffix in self.__step1_suffixes:
            if r1.endswith(suffix):
                if suffix == "heden":
                    word = "".join((word[:-5], "heid"))
                    r1 = "".join((r1[:-5], "heid"))
                    if r2.endswith("heden"):
                        r2 = "".join((r2[:-5], "heid"))

                elif (suffix in ("ene", "en") and
                      not word.endswith("heden") and
                      word[-len(suffix) - 1] not in self.__vowels and
                      word[-len(suffix) - 3:-len(suffix)] != "gem"):
                    word = word[:-len(suffix)]
                    r1 = r1[:-len(suffix)]
                    r2 = r2[:-len(suffix)]
                    if word.endswith(("kk", "dd", "tt")):
                        word = word[:-1]
                        r1 = r1[:-1]
                        r2 = r2[:-1]

                elif (suffix in ("se", "s") and
                      word[-len(suffix) - 1] not in self.__vowels and
                      word[-len(suffix) - 1] != "j"):
                    word = word[:-len(suffix)]
                    r1 = r1[:-len(suffix)]
                    r2 = r2[:-len(suffix)]
                break

        # STEP 2
        if r1.endswith("e") and word[-2] not in self.__vowels:
            step2_success = True
            word = word[:-1]
            r1 = r1[:-1]
            r2 = r2[:-1]

            if word.endswith(("kk", "dd", "tt")):
                word = word[:-1]
                r1 = r1[:-1]
                r2 = r2[:-1]

        # STEP 3a
        if r2.endswith("heid") and word[-5] != "c":
            word = word[:-4]
            r1 = r1[:-4]
            r2 = r2[:-4]

            if (r1.endswith("en") and word[-3] not in self.__vowels and
                word[-5:-2] != "gem"):
                word = word[:-2]
                r1 = r1[:-2]
                r2 = r2[:-2]

                if word.endswith(("kk", "dd", "tt")):
                    word = word[:-1]
                    r1 = r1[:-1]
                    r2 = r2[:-1]

        # STEP 3b: Derivational suffixes
        for suffix in self.__step3b_suffixes:
            if r2.endswith(suffix):
                if suffix in ("end", "ing"):
                    word = word[:-3]
                    r2 = r2[:-3]

                    if r2.endswith("ig") and word[-3] != "e":
                        word = word[:-2]
                    else:
                        if word.endswith(("kk", "dd", "tt")):
                            word = word[:-1]

                elif suffix == "ig" and word[-3] != "e":
                    word = word[:-2]

                elif suffix == "lijk":
                    word = word[:-4]
                    r1 = r1[:-4]

                    if r1.endswith("e") and word[-2] not in self.__vowels:
                        word = word[:-1]
                        if word.endswith(("kk", "dd", "tt")):
                            word = word[:-1]

                elif suffix == "baar":
                    word = word[:-4]

                elif suffix == "bar" and step2_success:
                    word = word[:-3]
                break

        # STEP 4: Undouble vowel
        if len(word) >= 4:
            if word[-1] not in self.__vowels and word[-1] != "I":
                if word[-3:-1] in ("aa", "ee", "oo", "uu"):
                    if word[-4] not in self.__vowels:
                        word = "".join((word[:-3], word[-3], word[-1]))

        # All occurrences of 'I' and 'Y' are put back into lower case.
        word = word.replace("I", "i").replace("Y", "y")

        return word
