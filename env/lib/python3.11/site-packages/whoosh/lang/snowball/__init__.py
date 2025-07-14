# Copyright (C) 2001-2012 NLTK Project
#
# Licensed under the Apache License, Version 2.0 (the 'License');
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an 'AS IS' BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


# Natural Language Toolkit: Snowball Stemmer
#
# Copyright (C) 2001-2012 NLTK Project
# Author: Peter Michael Stahl <pemistahl@gmail.com>
#         Peter Ljunglof <peter.ljunglof@heatherleaf.se> (revisions)
# Algorithms: Dr Martin Porter <martin@tartarus.org>
# URL: <http://www.nltk.org/>
# For license information, see LICENSE.TXT

# HJ 2012/07/19  adapted from https://github.com/kmike/nltk.git  (branch 2and3)
#                2.0.1rc4-256-g45768f8

"""
This module provides a port of the Snowball stemmers developed by Martin
Porter.

At the moment, this port is able to stem words from fourteen languages: Danish,
Dutch, English, Finnish, French, German, Hungarian, Italian, Norwegian,
Portuguese, Romanian, Russian, Spanish and Swedish.

The algorithms have been developed by Martin Porter. These stemmers are called
Snowball, because he invented a programming language with this name for
creating new stemming algorithms. There is more information available at
http://snowball.tartarus.org/
"""

from .danish import DanishStemmer
from .dutch import DutchStemmer
from .english import EnglishStemmer
from .finnish import FinnishStemmer
from .french import FrenchStemmer
from .german import GermanStemmer
from .hungarian import HungarianStemmer
from .italian import ItalianStemmer
from .norwegian import NorwegianStemmer
from .portugese import PortugueseStemmer
from .romanian import RomanianStemmer
from .russian import RussianStemmer
from .spanish import SpanishStemmer
from .swedish import SwedishStemmer


# Map two-letter codes to stemming classes

classes = {"da": DanishStemmer,
           "nl": DutchStemmer,
           "en": EnglishStemmer,
           "fi": FinnishStemmer,
           "fr": FrenchStemmer,
           "de": GermanStemmer,
           "hu": HungarianStemmer,
           "it": ItalianStemmer,
           "no": NorwegianStemmer,
           "pt": PortugueseStemmer,
           "ro": RomanianStemmer,
           "ru": RussianStemmer,
           "es": SpanishStemmer,
           "sv": SwedishStemmer,
           }
