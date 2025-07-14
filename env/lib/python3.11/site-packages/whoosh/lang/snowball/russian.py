from whoosh.compat import u

class RussianStemmer(object):
    """
    The Russian Snowball stemmer.

    :cvar __perfective_gerund_suffixes: Suffixes to be deleted.
    :type __perfective_gerund_suffixes: tuple
    :cvar __adjectival_suffixes: Suffixes to be deleted.
    :type __adjectival_suffixes: tuple
    :cvar __reflexive_suffixes: Suffixes to be deleted.
    :type __reflexive_suffixes: tuple
    :cvar __verb_suffixes: Suffixes to be deleted.
    :type __verb_suffixes: tuple
    :cvar __noun_suffixes: Suffixes to be deleted.
    :type __noun_suffixes: tuple
    :cvar __superlative_suffixes: Suffixes to be deleted.
    :type __superlative_suffixes: tuple
    :cvar __derivational_suffixes: Suffixes to be deleted.
    :type __derivational_suffixes: tuple
    :note: A detailed description of the Russian
           stemming algorithm can be found under
           http://snowball.tartarus.org/algorithms/russian/stemmer.html

    """

    __perfective_gerund_suffixes = ("ivshis'", "yvshis'", "vshis'",
                                      "ivshi", "yvshi", "vshi", "iv",
                                      "yv", "v")
    __adjectival_suffixes = ('ui^ushchi^ui^u', 'ui^ushchi^ai^a',
                               'ui^ushchimi', 'ui^ushchymi', 'ui^ushchego',
                               'ui^ushchogo', 'ui^ushchemu', 'ui^ushchomu',
                               'ui^ushchikh', 'ui^ushchykh',
                               'ui^ushchui^u', 'ui^ushchaia',
                               'ui^ushchoi^u', 'ui^ushchei^u',
                               'i^ushchi^ui^u', 'i^ushchi^ai^a',
                               'ui^ushchee', 'ui^ushchie',
                               'ui^ushchye', 'ui^ushchoe', 'ui^ushchei`',
                               'ui^ushchii`', 'ui^ushchyi`',
                               'ui^ushchoi`', 'ui^ushchem', 'ui^ushchim',
                               'ui^ushchym', 'ui^ushchom', 'i^ushchimi',
                               'i^ushchymi', 'i^ushchego', 'i^ushchogo',
                               'i^ushchemu', 'i^ushchomu', 'i^ushchikh',
                               'i^ushchykh', 'i^ushchui^u', 'i^ushchai^a',
                               'i^ushchoi^u', 'i^ushchei^u', 'i^ushchee',
                               'i^ushchie', 'i^ushchye', 'i^ushchoe',
                               'i^ushchei`', 'i^ushchii`',
                               'i^ushchyi`', 'i^ushchoi`', 'i^ushchem',
                               'i^ushchim', 'i^ushchym', 'i^ushchom',
                               'shchi^ui^u', 'shchi^ai^a', 'ivshi^ui^u',
                               'ivshi^ai^a', 'yvshi^ui^u', 'yvshi^ai^a',
                               'shchimi', 'shchymi', 'shchego', 'shchogo',
                               'shchemu', 'shchomu', 'shchikh', 'shchykh',
                               'shchui^u', 'shchai^a', 'shchoi^u',
                               'shchei^u', 'ivshimi', 'ivshymi',
                               'ivshego', 'ivshogo', 'ivshemu', 'ivshomu',
                               'ivshikh', 'ivshykh', 'ivshui^u',
                               'ivshai^a', 'ivshoi^u', 'ivshei^u',
                               'yvshimi', 'yvshymi', 'yvshego', 'yvshogo',
                               'yvshemu', 'yvshomu', 'yvshikh', 'yvshykh',
                               'yvshui^u', 'yvshai^a', 'yvshoi^u',
                               'yvshei^u', 'vshi^ui^u', 'vshi^ai^a',
                               'shchee', 'shchie', 'shchye', 'shchoe',
                               'shchei`', 'shchii`', 'shchyi`', 'shchoi`',
                               'shchem', 'shchim', 'shchym', 'shchom',
                               'ivshee', 'ivshie', 'ivshye', 'ivshoe',
                               'ivshei`', 'ivshii`', 'ivshyi`',
                               'ivshoi`', 'ivshem', 'ivshim', 'ivshym',
                               'ivshom', 'yvshee', 'yvshie', 'yvshye',
                               'yvshoe', 'yvshei`', 'yvshii`',
                               'yvshyi`', 'yvshoi`', 'yvshem',
                               'yvshim', 'yvshym', 'yvshom', 'vshimi',
                               'vshymi', 'vshego', 'vshogo', 'vshemu',
                               'vshomu', 'vshikh', 'vshykh', 'vshui^u',
                               'vshai^a', 'vshoi^u', 'vshei^u',
                               'emi^ui^u', 'emi^ai^a', 'nni^ui^u',
                               'nni^ai^a', 'vshee',
                               'vshie', 'vshye', 'vshoe', 'vshei`',
                               'vshii`', 'vshyi`', 'vshoi`',
                               'vshem', 'vshim', 'vshym', 'vshom',
                               'emimi', 'emymi', 'emego', 'emogo',
                               'ememu', 'emomu', 'emikh', 'emykh',
                               'emui^u', 'emai^a', 'emoi^u', 'emei^u',
                               'nnimi', 'nnymi', 'nnego', 'nnogo',
                               'nnemu', 'nnomu', 'nnikh', 'nnykh',
                               'nnui^u', 'nnai^a', 'nnoi^u', 'nnei^u',
                               'emee', 'emie', 'emye', 'emoe',
                               'emei`', 'emii`', 'emyi`',
                               'emoi`', 'emem', 'emim', 'emym',
                               'emom', 'nnee', 'nnie', 'nnye', 'nnoe',
                               'nnei`', 'nnii`', 'nnyi`',
                               'nnoi`', 'nnem', 'nnim', 'nnym',
                               'nnom', 'i^ui^u', 'i^ai^a', 'imi', 'ymi',
                               'ego', 'ogo', 'emu', 'omu', 'ikh',
                               'ykh', 'ui^u', 'ai^a', 'oi^u', 'ei^u',
                               'ee', 'ie', 'ye', 'oe', 'ei`',
                               'ii`', 'yi`', 'oi`', 'em',
                               'im', 'ym', 'om')
    __reflexive_suffixes = ("si^a", "s'")
    __verb_suffixes = ("esh'", 'ei`te', 'ui`te', 'ui^ut',
                         "ish'", 'ete', 'i`te', 'i^ut', 'nno',
                         'ila', 'yla', 'ena', 'ite', 'ili', 'yli',
                         'ilo', 'ylo', 'eno', 'i^at', 'uet', 'eny',
                         "it'", "yt'", 'ui^u', 'la', 'na', 'li',
                         'em', 'lo', 'no', 'et', 'ny', "t'",
                         'ei`', 'ui`', 'il', 'yl', 'im',
                         'ym', 'en', 'it', 'yt', 'i^u', 'i`',
                         'l', 'n')
    __noun_suffixes = ('ii^ami', 'ii^akh', 'i^ami', 'ii^am', 'i^akh',
                         'ami', 'iei`', 'i^am', 'iem', 'akh',
                         'ii^u', "'i^u", 'ii^a', "'i^a", 'ev', 'ov',
                         'ie', "'e", 'ei', 'ii', 'ei`',
                         'oi`', 'ii`', 'em', 'am', 'om',
                         'i^u', 'i^a', 'a', 'e', 'i', 'i`',
                         'o', 'u', 'y', "'")
    __superlative_suffixes = ("ei`she", "ei`sh")
    __derivational_suffixes = ("ost'", "ost")

    def stem(self, word):
        """
        Stem a Russian word and return the stemmed form.

        :param word: The word that is stemmed.
        :type word: str or unicode
        :return: The stemmed form.
        :rtype: unicode

        """
        chr_exceeded = False
        for i in range(len(word)):
            if ord(word[i]) > 255:
                chr_exceeded = True
                break

        if chr_exceeded:
            word = self.__cyrillic_to_roman(word)

        step1_success = False
        adjectival_removed = False
        verb_removed = False
        undouble_success = False
        superlative_removed = False

        rv, r2 = self.__regions_russian(word)

        # Step 1
        for suffix in self.__perfective_gerund_suffixes:
            if rv.endswith(suffix):
                if suffix in ("v", "vshi", "vshis'"):
                    if (rv[-len(suffix) - 3:-len(suffix)] == "i^a" or
                        rv[-len(suffix) - 1:-len(suffix)] == "a"):
                        word = word[:-len(suffix)]
                        r2 = r2[:-len(suffix)]
                        rv = rv[:-len(suffix)]
                        step1_success = True
                        break
                else:
                    word = word[:-len(suffix)]
                    r2 = r2[:-len(suffix)]
                    rv = rv[:-len(suffix)]
                    step1_success = True
                    break

        if not step1_success:
            for suffix in self.__reflexive_suffixes:
                if rv.endswith(suffix):
                    word = word[:-len(suffix)]
                    r2 = r2[:-len(suffix)]
                    rv = rv[:-len(suffix)]
                    break

            for suffix in self.__adjectival_suffixes:
                if rv.endswith(suffix):
                    if suffix in ('i^ushchi^ui^u', 'i^ushchi^ai^a',
                              'i^ushchui^u', 'i^ushchai^a', 'i^ushchoi^u',
                              'i^ushchei^u', 'i^ushchimi', 'i^ushchymi',
                              'i^ushchego', 'i^ushchogo', 'i^ushchemu',
                              'i^ushchomu', 'i^ushchikh', 'i^ushchykh',
                              'shchi^ui^u', 'shchi^ai^a', 'i^ushchee',
                              'i^ushchie', 'i^ushchye', 'i^ushchoe',
                              'i^ushchei`', 'i^ushchii`', 'i^ushchyi`',
                              'i^ushchoi`', 'i^ushchem', 'i^ushchim',
                              'i^ushchym', 'i^ushchom', 'vshi^ui^u',
                              'vshi^ai^a', 'shchui^u', 'shchai^a',
                              'shchoi^u', 'shchei^u', 'emi^ui^u',
                              'emi^ai^a', 'nni^ui^u', 'nni^ai^a',
                              'shchimi', 'shchymi', 'shchego', 'shchogo',
                              'shchemu', 'shchomu', 'shchikh', 'shchykh',
                              'vshui^u', 'vshai^a', 'vshoi^u', 'vshei^u',
                              'shchee', 'shchie', 'shchye', 'shchoe',
                              'shchei`', 'shchii`', 'shchyi`', 'shchoi`',
                              'shchem', 'shchim', 'shchym', 'shchom',
                              'vshimi', 'vshymi', 'vshego', 'vshogo',
                              'vshemu', 'vshomu', 'vshikh', 'vshykh',
                              'emui^u', 'emai^a', 'emoi^u', 'emei^u',
                              'nnui^u', 'nnai^a', 'nnoi^u', 'nnei^u',
                              'vshee', 'vshie', 'vshye', 'vshoe',
                              'vshei`', 'vshii`', 'vshyi`', 'vshoi`',
                              'vshem', 'vshim', 'vshym', 'vshom',
                              'emimi', 'emymi', 'emego', 'emogo',
                              'ememu', 'emomu', 'emikh', 'emykh',
                              'nnimi', 'nnymi', 'nnego', 'nnogo',
                              'nnemu', 'nnomu', 'nnikh', 'nnykh',
                              'emee', 'emie', 'emye', 'emoe', 'emei`',
                              'emii`', 'emyi`', 'emoi`', 'emem', 'emim',
                              'emym', 'emom', 'nnee', 'nnie', 'nnye',
                              'nnoe', 'nnei`', 'nnii`', 'nnyi`', 'nnoi`',
                              'nnem', 'nnim', 'nnym', 'nnom'):
                        if (rv[-len(suffix) - 3:-len(suffix)] == "i^a" or
                            rv[-len(suffix) - 1:-len(suffix)] == "a"):
                            word = word[:-len(suffix)]
                            r2 = r2[:-len(suffix)]
                            rv = rv[:-len(suffix)]
                            adjectival_removed = True
                            break
                    else:
                        word = word[:-len(suffix)]
                        r2 = r2[:-len(suffix)]
                        rv = rv[:-len(suffix)]
                        adjectival_removed = True
                        break

            if not adjectival_removed:
                for suffix in self.__verb_suffixes:
                    if rv.endswith(suffix):
                        if suffix in ("la", "na", "ete", "i`te", "li",
                                      "i`", "l", "em", "n", "lo", "no",
                                      "et", "i^ut", "ny", "t'", "esh'",
                                      "nno"):
                            if (rv[-len(suffix) - 3:-len(suffix)] == "i^a" or
                                rv[-len(suffix) - 1:-len(suffix)] == "a"):
                                word = word[:-len(suffix)]
                                r2 = r2[:-len(suffix)]
                                rv = rv[:-len(suffix)]
                                verb_removed = True
                                break
                        else:
                            word = word[:-len(suffix)]
                            r2 = r2[:-len(suffix)]
                            rv = rv[:-len(suffix)]
                            verb_removed = True
                            break

            if not adjectival_removed and not verb_removed:
                for suffix in self.__noun_suffixes:
                    if rv.endswith(suffix):
                        word = word[:-len(suffix)]
                        r2 = r2[:-len(suffix)]
                        rv = rv[:-len(suffix)]
                        break

        # Step 2
        if rv.endswith("i"):
            word = word[:-1]
            r2 = r2[:-1]

        # Step 3
        for suffix in self.__derivational_suffixes:
            if r2.endswith(suffix):
                word = word[:-len(suffix)]
                break

        # Step 4
        if word.endswith("nn"):
            word = word[:-1]
            undouble_success = True

        if not undouble_success:
            for suffix in self.__superlative_suffixes:
                if word.endswith(suffix):
                    word = word[:-len(suffix)]
                    superlative_removed = True
                    break
            if word.endswith("nn"):
                word = word[:-1]

        if not undouble_success and not superlative_removed:
            if word.endswith("'"):
                word = word[:-1]

        if chr_exceeded:
            word = self.__roman_to_cyrillic(word)
        return word

    def __regions_russian(self, word):
        """
        Return the regions RV and R2 which are used by the Russian stemmer.

        In any word, RV is the region after the first vowel,
        or the end of the word if it contains no vowel.

        R2 is the region after the first non-vowel following
        a vowel in R1, or the end of the word if there is no such non-vowel.

        R1 is the region after the first non-vowel following a vowel,
        or the end of the word if there is no such non-vowel.

        :param word: The Russian word whose regions RV and R2 are determined.
        :type word: str or unicode
        :return: the regions RV and R2 for the respective Russian word.
        :rtype: tuple
        :note: This helper method is invoked by the stem method of the subclass
               RussianStemmer. It is not to be invoked directly!

        """
        r1 = ""
        r2 = ""
        rv = ""

        vowels = ("A", "U", "E", "a", "e", "i", "o", "u", "y")
        word = (word.replace("i^a", "A")
                    .replace("i^u", "U")
                    .replace("e`", "E"))

        for i in range(1, len(word)):
            if word[i] not in vowels and word[i - 1] in vowels:
                r1 = word[i + 1:]
                break

        for i in range(1, len(r1)):
            if r1[i] not in vowels and r1[i - 1] in vowels:
                r2 = r1[i + 1:]
                break

        for i in range(len(word)):
            if word[i] in vowels:
                rv = word[i + 1:]
                break

        r2 = (r2.replace("A", "i^a")
                .replace("U", "i^u")
                .replace("E", "e`"))
        rv = (rv.replace("A", "i^a")
              .replace("U", "i^u")
              .replace("E", "e`"))
        return (rv, r2)

    def __cyrillic_to_roman(self, word):
        """
        Transliterate a Russian word into the Roman alphabet.

        A Russian word whose letters consist of the Cyrillic
        alphabet are transliterated into the Roman alphabet
        in order to ease the forthcoming stemming process.

        :param word: The word that is transliterated.
        :type word: unicode
        :return: the transliterated word.
        :rtype: unicode
        :note: This helper method is invoked by the stem method of the subclass
               RussianStemmer. It is not to be invoked directly!

        """
        word = (word.replace(u("\u0410"), "a").replace(u("\u0430"), "a")
                    .replace(u("\u0411"), "b").replace(u("\u0431"), "b")
                    .replace(u("\u0412"), "v").replace(u("\u0432"), "v")
                    .replace(u("\u0413"), "g").replace(u("\u0433"), "g")
                    .replace(u("\u0414"), "d").replace(u("\u0434"), "d")
                    .replace(u("\u0415"), "e").replace(u("\u0435"), "e")
                    .replace(u("\u0401"), "e").replace(u("\u0451"), "e")
                    .replace(u("\u0416"), "zh").replace(u("\u0436"), "zh")
                    .replace(u("\u0417"), "z").replace(u("\u0437"), "z")
                    .replace(u("\u0418"), "i").replace(u("\u0438"), "i")
                    .replace(u("\u0419"), "i`").replace(u("\u0439"), "i`")
                    .replace(u("\u041A"), "k").replace(u("\u043A"), "k")
                    .replace(u("\u041B"), "l").replace(u("\u043B"), "l")
                    .replace(u("\u041C"), "m").replace(u("\u043C"), "m")
                    .replace(u("\u041D"), "n").replace(u("\u043D"), "n")
                    .replace(u("\u041E"), "o").replace(u("\u043E"), "o")
                    .replace(u("\u041F"), "p").replace(u("\u043F"), "p")
                    .replace(u("\u0420"), "r").replace(u("\u0440"), "r")
                    .replace(u("\u0421"), "s").replace(u("\u0441"), "s")
                    .replace(u("\u0422"), "t").replace(u("\u0442"), "t")
                    .replace(u("\u0423"), "u").replace(u("\u0443"), "u")
                    .replace(u("\u0424"), "f").replace(u("\u0444"), "f")
                    .replace(u("\u0425"), "kh").replace(u("\u0445"), "kh")
                    .replace(u("\u0426"), "t^s").replace(u("\u0446"), "t^s")
                    .replace(u("\u0427"), "ch").replace(u("\u0447"), "ch")
                    .replace(u("\u0428"), "sh").replace(u("\u0448"), "sh")
                    .replace(u("\u0429"), "shch").replace(u("\u0449"), "shch")
                    .replace(u("\u042A"), "''").replace(u("\u044A"), "''")
                    .replace(u("\u042B"), "y").replace(u("\u044B"), "y")
                    .replace(u("\u042C"), "'").replace(u("\u044C"), "'")
                    .replace(u("\u042D"), "e`").replace(u("\u044D"), "e`")
                    .replace(u("\u042E"), "i^u").replace(u("\u044E"), "i^u")
                    .replace(u("\u042F"), "i^a").replace(u("\u044F"), "i^a"))
        return word

    def __roman_to_cyrillic(self, word):
        """
        Transliterate a Russian word back into the Cyrillic alphabet.

        A Russian word formerly transliterated into the Roman alphabet
        in order to ease the stemming process, is transliterated back
        into the Cyrillic alphabet, its original form.

        :param word: The word that is transliterated.
        :type word: str or unicode
        :return: word, the transliterated word.
        :rtype: unicode
        :note: This helper method is invoked by the stem method of the subclass
               RussianStemmer. It is not to be invoked directly!

        """
        word = (word.replace("i^u", u("\u044E")).replace("i^a", u("\u044F"))
                    .replace("shch", u("\u0449")).replace("kh", u("\u0445"))
                    .replace("t^s", u("\u0446")).replace("ch", u("\u0447"))
                    .replace("e`", u("\u044D")).replace("i`", u("\u0439"))
                    .replace("sh", u("\u0448")).replace("k", u("\u043A"))
                    .replace("e", u("\u0435")).replace("zh", u("\u0436"))
                    .replace("a", u("\u0430")).replace("b", u("\u0431"))
                    .replace("v", u("\u0432")).replace("g", u("\u0433"))
                    .replace("d", u("\u0434")).replace("e", u("\u0435"))
                    .replace("z", u("\u0437")).replace("i", u("\u0438"))
                    .replace("l", u("\u043B")).replace("m", u("\u043C"))
                    .replace("n", u("\u043D")).replace("o", u("\u043E"))
                    .replace("p", u("\u043F")).replace("r", u("\u0440"))
                    .replace("s", u("\u0441")).replace("t", u("\u0442"))
                    .replace("u", u("\u0443")).replace("f", u("\u0444"))
                    .replace("''", u("\u044A")).replace("y", u("\u044B"))
                    .replace("'", u("\u044C")))
        return word
