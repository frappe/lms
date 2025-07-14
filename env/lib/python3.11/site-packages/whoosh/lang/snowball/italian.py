from .bases import _StandardStemmer

from whoosh.compat import u


class ItalianStemmer(_StandardStemmer):

    """
    The Italian Snowball stemmer.

    :cvar __vowels: The Italian vowels.
    :type __vowels: unicode
    :cvar __step0_suffixes: Suffixes to be deleted in step 0 of the algorithm.
    :type __step0_suffixes: tuple
    :cvar __step1_suffixes: Suffixes to be deleted in step 1 of the algorithm.
    :type __step1_suffixes: tuple
    :cvar __step2_suffixes: Suffixes to be deleted in step 2 of the algorithm.
    :type __step2_suffixes: tuple
    :note: A detailed description of the Italian
           stemming algorithm can be found under
           http://snowball.tartarus.org/algorithms/italian/stemmer.html

    """

    __vowels = u("aeiou\xE0\xE8\xEC\xF2\xF9")
    __step0_suffixes = ('gliela', 'gliele', 'glieli', 'glielo',
                        'gliene', 'sene', 'mela', 'mele', 'meli',
                        'melo', 'mene', 'tela', 'tele', 'teli',
                        'telo', 'tene', 'cela', 'cele', 'celi',
                        'celo', 'cene', 'vela', 'vele', 'veli',
                        'velo', 'vene', 'gli', 'ci', 'la', 'le',
                        'li', 'lo', 'mi', 'ne', 'si', 'ti', 'vi')
    __step1_suffixes = ('atrice', 'atrici', 'azione', 'azioni',
                        'uzione', 'uzioni', 'usione', 'usioni',
                        'amento', 'amenti', 'imento', 'imenti',
                        'amente', 'abile', 'abili', 'ibile', 'ibili',
                        'mente', 'atore', 'atori', 'logia', 'logie',
                        'anza', 'anze', 'iche', 'ichi', 'ismo',
                        'ismi', 'ista', 'iste', 'isti', u('ist\xE0'),
                        u('ist\xE8'), u('ist\xEC'), 'ante', 'anti',
                        'enza', 'enze', 'ico', 'ici', 'ica', 'ice',
                        'oso', 'osi', 'osa', 'ose', u('it\xE0'),
                        'ivo', 'ivi', 'iva', 'ive')
    __step2_suffixes = ('erebbero', 'irebbero', 'assero', 'assimo',
                        'eranno', 'erebbe', 'eremmo', 'ereste',
                        'eresti', 'essero', 'iranno', 'irebbe',
                        'iremmo', 'ireste', 'iresti', 'iscano',
                        'iscono', 'issero', 'arono', 'avamo', 'avano',
                        'avate', 'eremo', 'erete', 'erono', 'evamo',
                        'evano', 'evate', 'iremo', 'irete', 'irono',
                        'ivamo', 'ivano', 'ivate', 'ammo', 'ando',
                        'asse', 'assi', 'emmo', 'enda', 'ende',
                        'endi', 'endo', 'erai', 'erei', 'Yamo',
                        'iamo', 'immo', 'irai', 'irei', 'isca',
                        'isce', 'isci', 'isco', 'ano', 'are', 'ata',
                        'ate', 'ati', 'ato', 'ava', 'avi', 'avo',
                        u('er\xE0'), 'ere', u('er\xF2'), 'ete', 'eva',
                        'evi', 'evo', u('ir\xE0'), 'ire', u('ir\xF2'),
                        'ita', 'ite', 'iti', 'ito', 'iva', 'ivi',
                        'ivo', 'ono', 'uta', 'ute', 'uti', 'uto',
                        'ar', 'ir')

    def stem(self, word):
        """
        Stem an Italian word and return the stemmed form.

        :param word: The word that is stemmed.
        :type word: str or unicode
        :return: The stemmed form.
        :rtype: unicode

        """
        word = word.lower()

        step1_success = False

        # All acute accents are replaced by grave accents.
        word = (word.replace(u("\xE1"), u("\xE0"))
                    .replace(u("\xE9"), u("\xE8"))
                    .replace(u("\xED"), u("\xEC"))
                    .replace(u("\xF3"), u("\xF2"))
                    .replace(u("\xFA"), u("\xF9")))

        # Every occurrence of 'u' after 'q'
        # is put into upper case.
        for i in range(1, len(word)):
            if word[i - 1] == "q" and word[i] == "u":
                word = "".join((word[:i], "U", word[i + 1:]))

        # Every occurrence of 'u' and 'i'
        # between vowels is put into upper case.
        for i in range(1, len(word) - 1):
            if word[i - 1] in self.__vowels and word[i + 1] in self.__vowels:
                if word[i] == "u":
                    word = "".join((word[:i], "U", word[i + 1:]))
                elif word[i] == "i":
                    word = "".join((word[:i], "I", word[i + 1:]))

        r1, r2 = self._r1r2_standard(word, self.__vowels)
        rv = self._rv_standard(word, self.__vowels)

        # STEP 0: Attached pronoun
        for suffix in self.__step0_suffixes:
            if rv.endswith(suffix):
                if rv[-len(suffix) - 4:-len(suffix)] in ("ando", "endo"):
                    word = word[:-len(suffix)]
                    r1 = r1[:-len(suffix)]
                    r2 = r2[:-len(suffix)]
                    rv = rv[:-len(suffix)]

                elif (rv[-len(suffix) - 2:-len(suffix)] in
                      ("ar", "er", "ir")):
                    word = "".join((word[:-len(suffix)], "e"))
                    r1 = "".join((r1[:-len(suffix)], "e"))
                    r2 = "".join((r2[:-len(suffix)], "e"))
                    rv = "".join((rv[:-len(suffix)], "e"))
                break

        # STEP 1: Standard suffix removal
        for suffix in self.__step1_suffixes:
            if word.endswith(suffix):
                if suffix == "amente" and r1.endswith(suffix):
                    step1_success = True
                    word = word[:-6]
                    r2 = r2[:-6]
                    rv = rv[:-6]

                    if r2.endswith("iv"):
                        word = word[:-2]
                        r2 = r2[:-2]
                        rv = rv[:-2]

                        if r2.endswith("at"):
                            word = word[:-2]
                            rv = rv[:-2]

                    elif r2.endswith(("os", "ic")):
                        word = word[:-2]
                        rv = rv[:-2]

                    elif r2 .endswith("abil"):
                        word = word[:-4]
                        rv = rv[:-4]

                elif (suffix in ("amento", "amenti",
                                 "imento", "imenti") and
                      rv.endswith(suffix)):
                    step1_success = True
                    word = word[:-6]
                    rv = rv[:-6]

                elif r2.endswith(suffix):
                    step1_success = True
                    if suffix in ("azione", "azioni", "atore", "atori"):
                        word = word[:-len(suffix)]
                        r2 = r2[:-len(suffix)]
                        rv = rv[:-len(suffix)]

                        if r2.endswith("ic"):
                            word = word[:-2]
                            rv = rv[:-2]

                    elif suffix in ("logia", "logie"):
                        word = word[:-2]
                        rv = word[:-2]

                    elif suffix in ("uzione", "uzioni",
                                    "usione", "usioni"):
                        word = word[:-5]
                        rv = rv[:-5]

                    elif suffix in ("enza", "enze"):
                        word = "".join((word[:-2], "te"))
                        rv = "".join((rv[:-2], "te"))

                    elif suffix == u("it\xE0"):
                        word = word[:-3]
                        r2 = r2[:-3]
                        rv = rv[:-3]

                        if r2.endswith(("ic", "iv")):
                            word = word[:-2]
                            rv = rv[:-2]

                        elif r2.endswith("abil"):
                            word = word[:-4]
                            rv = rv[:-4]

                    elif suffix in ("ivo", "ivi", "iva", "ive"):
                        word = word[:-3]
                        r2 = r2[:-3]
                        rv = rv[:-3]

                        if r2.endswith("at"):
                            word = word[:-2]
                            r2 = r2[:-2]
                            rv = rv[:-2]

                            if r2.endswith("ic"):
                                word = word[:-2]
                                rv = rv[:-2]
                    else:
                        word = word[:-len(suffix)]
                        rv = rv[:-len(suffix)]
                break

        # STEP 2: Verb suffixes
        if not step1_success:
            for suffix in self.__step2_suffixes:
                if rv.endswith(suffix):
                    word = word[:-len(suffix)]
                    rv = rv[:-len(suffix)]
                    break

        # STEP 3a
        if rv.endswith(("a", "e", "i", "o", u("\xE0"), u("\xE8"),
                        u("\xEC"), u("\xF2"))):
            word = word[:-1]
            rv = rv[:-1]

            if rv.endswith("i"):
                word = word[:-1]
                rv = rv[:-1]

        # STEP 3b
        if rv.endswith(("ch", "gh")):
            word = word[:-1]

        word = word.replace("I", "i").replace("U", "u")
        return word
