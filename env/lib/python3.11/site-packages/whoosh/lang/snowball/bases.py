# Base classes


class _ScandinavianStemmer(object):

    """
    This subclass encapsulates a method for defining the string region R1.
    It is used by the Danish, Norwegian, and Swedish stemmer.

    """

    def _r1_scandinavian(self, word, vowels):
        """
        Return the region R1 that is used by the Scandinavian stemmers.

        R1 is the region after the first non-vowel following a vowel,
        or is the null region at the end of the word if there is no
        such non-vowel. But then R1 is adjusted so that the region
        before it contains at least three letters.

        :param word: The word whose region R1 is determined.
        :type word: str or unicode
        :param vowels: The vowels of the respective language that are
                       used to determine the region R1.
        :type vowels: unicode
        :return: the region R1 for the respective word.
        :rtype: unicode
        :note: This helper method is invoked by the respective stem method of
               the subclasses DanishStemmer, NorwegianStemmer, and
               SwedishStemmer. It is not to be invoked directly!

        """
        r1 = ""
        for i in range(1, len(word)):
            if word[i] not in vowels and word[i - 1] in vowels:
                if len(word[:i + 1]) < 3 and len(word[:i + 1]) > 0:
                    r1 = word[3:]
                elif len(word[:i + 1]) >= 3:
                    r1 = word[i + 1:]
                else:
                    return word
                break

        return r1


class _StandardStemmer(object):
    """
    This subclass encapsulates two methods for defining the standard versions
    of the string regions R1, R2, and RV.
    """

    def _r1r2_standard(self, word, vowels):
        """
        Return the standard interpretations of the string regions R1 and R2.

        R1 is the region after the first non-vowel following a vowel,
        or is the null region at the end of the word if there is no
        such non-vowel.

        R2 is the region after the first non-vowel following a vowel
        in R1, or is the null region at the end of the word if there
        is no such non-vowel.

        :param word: The word whose regions R1 and R2 are determined.
        :type word: str or unicode
        :param vowels: The vowels of the respective language that are
                       used to determine the regions R1 and R2.
        :type vowels: unicode
        :return: (r1,r2), the regions R1 and R2 for the respective word.
        :rtype: tuple
        :note: This helper method is invoked by the respective stem method of
               the subclasses DutchStemmer, FinnishStemmer,
               FrenchStemmer, GermanStemmer, ItalianStemmer,
               PortugueseStemmer, RomanianStemmer, and SpanishStemmer.
               It is not to be invoked directly!
        :note: A detailed description of how to define R1 and R2
               can be found at http://snowball.tartarus.org/texts/r1r2.html

        """
        r1 = ""
        r2 = ""
        for i in range(1, len(word)):
            if word[i] not in vowels and word[i - 1] in vowels:
                r1 = word[i + 1:]
                break

        for i in range(1, len(r1)):
            if r1[i] not in vowels and r1[i - 1] in vowels:
                r2 = r1[i + 1:]
                break

        return (r1, r2)

    def _rv_standard(self, word, vowels):
        """
        Return the standard interpretation of the string region RV.

        If the second letter is a consonant, RV is the region after the
        next following vowel. If the first two letters are vowels, RV is
        the region after the next following consonant. Otherwise, RV is
        the region after the third letter.

        :param word: The word whose region RV is determined.
        :type word: str or unicode
        :param vowels: The vowels of the respective language that are
                       used to determine the region RV.
        :type vowels: unicode
        :return: the region RV for the respective word.
        :rtype: unicode
        :note: This helper method is invoked by the respective stem method of
               the subclasses ItalianStemmer, PortugueseStemmer,
               RomanianStemmer, and SpanishStemmer. It is not to be
               invoked directly!

        """
        rv = ""
        if len(word) >= 2:
            if word[1] not in vowels:
                for i in range(2, len(word)):
                    if word[i] in vowels:
                        rv = word[i + 1:]
                        break

            elif word[:2] in vowels:
                for i in range(2, len(word)):
                    if word[i] not in vowels:
                        rv = word[i + 1:]
                        break
            else:
                rv = word[3:]

        return rv
