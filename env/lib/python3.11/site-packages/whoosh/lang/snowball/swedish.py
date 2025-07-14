from .bases import _ScandinavianStemmer

from whoosh.compat import u


class SwedishStemmer(_ScandinavianStemmer):

    """
    The Swedish Snowball stemmer.

    :cvar __vowels: The Swedish vowels.
    :type __vowels: unicode
    :cvar __s_ending: Letters that may directly appear before a word final 's'.
    :type __s_ending: unicode
    :cvar __step1_suffixes: Suffixes to be deleted in step 1 of the algorithm.
    :type __step1_suffixes: tuple
    :cvar __step2_suffixes: Suffixes to be deleted in step 2 of the algorithm.
    :type __step2_suffixes: tuple
    :cvar __step3_suffixes: Suffixes to be deleted in step 3 of the algorithm.
    :type __step3_suffixes: tuple
    :note: A detailed description of the Swedish
           stemming algorithm can be found under
           http://snowball.tartarus.org/algorithms/swedish/stemmer.html
    """

    __vowels = u("aeiouy\xE4\xE5\xF6")
    __s_ending = "bcdfghjklmnoprtvy"
    __step1_suffixes = ("heterna", "hetens", "heter", "heten",
                        "anden", "arnas", "ernas", "ornas", "andes",
                        "andet", "arens", "arna", "erna", "orna",
                        "ande", "arne", "aste", "aren", "ades",
                        "erns", "ade", "are", "ern", "ens", "het",
                        "ast", "ad", "en", "ar", "er", "or", "as",
                        "es", "at", "a", "e", "s")
    __step2_suffixes = ("dd", "gd", "nn", "dt", "gt", "kt", "tt")
    __step3_suffixes = ("fullt", u("l\xF6st"), "els", "lig", "ig")

    def stem(self, word):
        """
        Stem a Swedish word and return the stemmed form.

        :param word: The word that is stemmed.
        :type word: str or unicode
        :return: The stemmed form.
        :rtype: unicode

        """
        word = word.lower()

        r1 = self._r1_scandinavian(word, self.__vowels)

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
        for suffix in self.__step3_suffixes:
            if r1.endswith(suffix):
                if suffix in ("els", "lig", "ig"):
                    word = word[:-len(suffix)]
                elif suffix in ("fullt", u("l\xF6st")):
                    word = word[:-1]
                break

        return word
