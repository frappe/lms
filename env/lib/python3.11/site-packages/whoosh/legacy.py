# Copyright 2012 Matt Chaput. All rights reserved.
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

"""
This module contains code for maintaining backwards compatibility with old
index formats.
"""

from whoosh.util.loading import RenamingUnpickler


def load_110_toc(stream, gen, schema, version):
    # Between version -110 and version -111, I reorganized the modules and
    # changed the implementation of the NUMERIC field, so we have to change the
    # classes the unpickler tries to load if we need to read an old schema

    # Read the length of the pickled schema
    picklen = stream.read_varint()
    if schema:
        # If the user passed us a schema, use it and skip the one on disk
        stream.seek(picklen, 1)
    else:
        # Remap the old classes and functions to their moved versions as we
        # unpickle the schema
        scuts = {"wf": "whoosh.fields",
                 "wsn": "whoosh.support.numeric",
                 "wcw2": "whoosh.codec.whoosh2"}
        objmap = {"%(wf)s.NUMERIC": "%(wcw2)s.OLD_NUMERIC",
                  "%(wf)s.DATETIME": "%(wcw2)s.OLD_DATETIME",
                  "%(wsn)s.int_to_text": "%(wcw2)s.int_to_text",
                  "%(wsn)s.text_to_int": "%(wcw2)s.text_to_int",
                  "%(wsn)s.long_to_text": "%(wcw2)s.long_to_text",
                  "%(wsn)s.text_to_long": "%(wcw2)s.text_to_long",
                  "%(wsn)s.float_to_text": "%(wcw2)s.float_to_text",
                  "%(wsn)s.text_to_float": "%(wcw2)s.text_to_float", }
        ru = RenamingUnpickler(stream, objmap, shortcuts=scuts)
        schema = ru.load()
    # Read the generation number
    index_gen = stream.read_int()
    assert gen == index_gen
    # Unused number
    _ = stream.read_int()
    # Unpickle the list of segment objects
    segments = stream.read_pickle()
    return schema, segments


# Map TOC version numbers to functions to load that version
toc_loaders = {-110: load_110_toc}


# Map segment class names to functions to load the segment
segment_loaders = {}
