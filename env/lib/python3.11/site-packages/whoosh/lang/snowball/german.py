from .bases import _StandardStemmer

from whoosh.compat import u


class GermanStemmer(_StandardStemmer):

    """
    The German Snowball stemmer.

    :cvar __vowels: The German vowels.
    :type __vowels: unicode
    :cvar __s_ending: Letters that may directly appear before a word final 's'.
    :type __s_ending: unicode
    :cvar __st_ending: Letter that may directly appear before a word final 'st'.
    :type __st_ending: unicode
    :cvar __step1_suffixes: Suffixes to be deleted in step 1 of the algorithm.
    :type __step1_suffixes: tuple
    :cvar __step2_suffixes: Suffixes to be deleted in step 2 of the algorithm.
    :type __step2_suffixes: tuple
    :cvar __step3_suffixes: Suffixes to be deleted in step 3 of the algorithm.
    :type __step3_suffixes: tuple
    :note: A detailed description of the German
           stemming algorithm can be found under
           http://snowball.tartarus.org/algorithms/german/stemmer.html

    """

    __vowels = u("aeiouy\xE4\xF6\xFC")
    __s_ending = "bdfghklmnrt"
    __st_ending = "bdfghklmnt"

    __step1_suffixes = ("ern", "em", "er", "en", "es", "e", "s")
    __step2_suffixes = ("est", "en", "er", "st")
    __step3_suffixes = ("isch", "lich", "heit", "keit",
                          "end", "ung", "ig", "ik")

    def stem(self, word):
        """
        Stem a German word and return the stemmed form.

        :param word: The word that is stemmed.
        :type word: str or unicode
        :return: The stemmed form.
        :rtype: unicode

        """
        word = word.lower()

        word = word.replace(u("\xDF"), "ss")

        # Every occurrence of 'u' and 'y'
        # between vowels is put into upper case.
        for i in range(1, len(word) - 1):
            if word[i - 1] in self.__vowels and word[i + 1] in self.__vowels:
                if word[i] == "u":
                    word = "".join((word[:i], "U", word[i + 1:]))

                elif word[i] == "y":
                    word = "".join((word[:i], "Y", word[i + 1:]))

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
                if (suffix in ("en", "es", "e") and
                    word[-len(suffix) - 4:-len(suffix)] == "niss"):
                    word = word[:-len(suffix) - 1]
                    r1 = r1[:-len(suffix) - 1]
                    r2 = r2[:-len(suffix) - 1]

                elif suffix == "s":
                    if word[-2] in self.__s_ending:
                        word = word[:-1]
                        r1 = r1[:-1]
                        r2 = r2[:-1]
                else:
                    word = word[:-len(suffix)]
                    r1 = r1[:-len(suffix)]
                    r2 = r2[:-len(suffix)]
                break

        # STEP 2
        for suffix in self.__step2_suffixes:
            if r1.endswith(suffix):
                if suffix == "st":
                    if word[-3] in self.__st_ending and len(word[:-3]) >= 3:
                        word = word[:-2]
                        r1 = r1[:-2]
                        r2 = r2[:-2]
                else:
                    word = word[:-len(suffix)]
                    r1 = r1[:-len(suffix)]
                    r2 = r2[:-len(suffix)]
                break

        # STEP 3: Derivational suffixes
        for suffix in self.__step3_suffixes:
            if r2.endswith(suffix):
                if suffix in ("end", "ung"):
                    if ("ig" in r2[-len(suffix) - 2:-len(suffix)] and
                        "e" not in r2[-len(suffix) - 3:-len(suffix) - 2]):
                        word = word[:-len(suffix) - 2]
                    else:
                        word = word[:-len(suffix)]

                elif (suffix in ("ig", "ik", "isch") and
                      "e" not in r2[-len(suffix) - 1:-len(suffix)]):
                    word = word[:-len(suffix)]

                elif suffix in ("lich", "heit"):
                    if ("er" in r1[-len(suffix) - 2:-len(suffix)] or
                        "en" in r1[-len(suffix) - 2:-len(suffix)]):
                        word = word[:-len(suffix) - 2]
                    else:
                        word = word[:-len(suffix)]

                elif suffix == "keit":
                    if "lich" in r2[-len(suffix) - 4:-len(suffix)]:
                        word = word[:-len(suffix) - 4]

                    elif "ig" in r2[-len(suffix) - 2:-len(suffix)]:
                        word = word[:-len(suffix) - 2]
                    else:
                        word = word[:-len(suffix)]
                break

        # Umlaut accents are removed and
        # 'u' and 'y' are put back into lower case.
        word = (word.replace(u("\xE4"), "a").replace(u("\xF6"), "o")
                    .replace(u("\xFC"), "u").replace("U", "u")
                    .replace("Y", "y"))
        return word
