# Copyright 2007 Matt Chaput. All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#
#    1. Redistributions of source code must retain the above copyright notice,
#       this list of conditions and the following disclaimer.
#
#    2. Redistributions in binary form must reproduce the above copyright
#       notice, this list of conditions and the following disclaimer in the
#       documentation and/or other materials provided with the distribution.
#
# THIS SOFTWARE IS PROVIDED BY MATT CHAPUT ``AS IS'' AND ANY EXPRESS OR
# IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
# MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
# EVENT SHALL MATT CHAPUT OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
# INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
# LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
# OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
# LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
# NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
# EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
#
# The views and conclusions contained in the software and documentation are
# those of the authors and should not be interpreted as representing official
# policies, either expressed or implied, of Matt Chaput.

"""Classes and functions for turning a piece of text into an indexable stream
of "tokens" (usually equivalent to words). There are three general classes
involved in analysis:

* Tokenizers are always at the start of the text processing pipeline. They take
  a string and yield Token objects (actually, the same token object over and
  over, for performance reasons) corresponding to the tokens (words) in the
  text.

  Every tokenizer is a callable that takes a string and returns an iterator of
  tokens.

* Filters take the tokens from the tokenizer and perform various
  transformations on them. For example, the LowercaseFilter converts all tokens
  to lowercase, which is usually necessary when indexing regular English text.

  Every filter is a callable that takes a token generator and returns a token
  generator.

* Analyzers are convenience functions/classes that "package up" a tokenizer and
  zero or more filters into a single unit. For example, the StandardAnalyzer
  combines a RegexTokenizer, LowercaseFilter, and StopFilter.

  Every analyzer is a callable that takes a string and returns a token
  iterator. (So Tokenizers can be used as Analyzers if you don't need any
  filtering).

You can compose tokenizers and filters together using the ``|`` character::

    my_analyzer = RegexTokenizer() | LowercaseFilter() | StopFilter()

The first item must be a tokenizer and the rest must be filters (you can't put
a filter first or a tokenizer after the first item).
"""

from whoosh.analysis.acore import *
from whoosh.analysis.tokenizers import *
from whoosh.analysis.filters import *
from whoosh.analysis.morph import *
from whoosh.analysis.intraword import *
from whoosh.analysis.ngrams import *
from whoosh.analysis.analyzers import *
