# Copyright 2008 Matt Chaput. All rights reserved.
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

"""Classes and functions for classifying and extracting information from
documents.
"""

from __future__ import division
import random
from collections import defaultdict
from math import log

from whoosh.compat import xrange, iteritems


# Expansion models

class ExpansionModel(object):
    def __init__(self, doc_count, field_length):
        self.N = doc_count
        self.collection_total = field_length

        if self.N:
            self.mean_length = self.collection_total / self.N
        else:
            self.mean_length = 0

    def normalizer(self, maxweight, top_total):
        raise NotImplementedError

    def score(self, weight_in_top, weight_in_collection, top_total):
        raise NotImplementedError


class Bo1Model(ExpansionModel):
    def normalizer(self, maxweight, top_total):
        f = maxweight / self.N
        return (maxweight * log((1.0 + f) / f) + log(1.0 + f)) / log(2.0)

    def score(self, weight_in_top, weight_in_collection, top_total):
        f = weight_in_collection / self.N
        return weight_in_top * log((1.0 + f) / f, 2) + log(1.0 + f, 2)


class Bo2Model(ExpansionModel):
    def normalizer(self, maxweight, top_total):
        f = maxweight * self.N / self.collection_total
        return maxweight * log((1.0 + f) / f, 2) + log(1.0 + f, 2)

    def score(self, weight_in_top, weight_in_collection, top_total):
        f = weight_in_top * top_total / self.collection_total
        return weight_in_top * log((1.0 + f) / f, 2) + log(1.0 + f, 2)


class KLModel(ExpansionModel):
    def normalizer(self, maxweight, top_total):
        return (maxweight * log(self.collection_total / top_total) / log(2.0)
                * top_total)

    def score(self, weight_in_top, weight_in_collection, top_total):
        wit_over_tt = weight_in_top / top_total
        wic_over_ct = weight_in_collection / self.collection_total

        if wit_over_tt < wic_over_ct:
            return 0
        else:
            return wit_over_tt * log(wit_over_tt
                                     / (weight_in_top / self.collection_total),
                                     2)


class Expander(object):
    """Uses an ExpansionModel to expand the set of query terms based on the top
    N result documents.
    """

    def __init__(self, ixreader, fieldname, model=Bo1Model):
        """
        :param reader: A :class:whoosh.reading.IndexReader object.
        :param fieldname: The name of the field in which to search.
        :param model: (classify.ExpansionModel) The model to use for expanding
            the query terms. If you omit this parameter, the expander uses
            :class:`Bo1Model` by default.
        """

        self.ixreader = ixreader
        self.fieldname = fieldname
        doccount =  self.ixreader.doc_count_all()
        fieldlen = self.ixreader.field_length(fieldname)

        if type(model) is type:
            model = model(doccount, fieldlen)
        self.model = model

        # Maps words to their weight in the top N documents.
        self.topN_weight = defaultdict(float)

        # Total weight of all terms in the top N documents.
        self.top_total = 0

    def add(self, vector):
        """Adds forward-index information about one of the "top N" documents.

        :param vector: A series of (text, weight) tuples, such as is
            returned by Reader.vector_as("weight", docnum, fieldname).
        """

        total_weight = 0
        topN_weight = self.topN_weight

        for word, weight in vector:
            total_weight += weight
            topN_weight[word] += weight

        self.top_total += total_weight

    def add_document(self, docnum):
        ixreader = self.ixreader
        if self.ixreader.has_vector(docnum, self.fieldname):
            self.add(ixreader.vector_as("weight", docnum, self.fieldname))
        elif self.ixreader.schema[self.fieldname].stored:
            self.add_text(ixreader.stored_fields(docnum).get(self.fieldname))
        else:
            raise Exception("Field %r in document %s is not vectored or stored"
                            % (self.fieldname, docnum))

    def add_text(self, string):
        # Unfortunately since field.index() yields bytes texts, and we want
        # unicode, we end up encoding and decoding unnecessarily.
        #
        # TODO: Find a way around this

        field = self.ixreader.schema[self.fieldname]
        from_bytes = field.from_bytes
        self.add((from_bytes(text), weight) for text, _, weight, _
                 in field.index(string))

    def expanded_terms(self, number, normalize=True):
        """Returns the N most important terms in the vectors added so far.

        :param number: The number of terms to return.
        :param normalize: Whether to normalize the weights.
        :returns: A list of ("term", weight) tuples.
        """

        model = self.model
        fieldname = self.fieldname
        ixreader = self.ixreader
        field = ixreader.schema[fieldname]
        tlist = []
        maxweight = 0

        # If no terms have been added, return an empty list
        if not self.topN_weight:
            return []

        for word, weight in iteritems(self.topN_weight):
            btext = field.to_bytes(word)
            if (fieldname, btext) in ixreader:
                cf = ixreader.frequency(fieldname, btext)
                score = model.score(weight, cf, self.top_total)
                if score > maxweight:
                    maxweight = score
                tlist.append((score, word))

        if normalize:
            norm = model.normalizer(maxweight, self.top_total)
        else:
            norm = maxweight
        tlist = [(weight / norm, t) for weight, t in tlist]
        tlist.sort(key=lambda x: (0 - x[0], x[1]))

        return [(t, weight) for weight, t in tlist[:number]]


# Similarity functions

def shingles(input, size=2):
    d = defaultdict(int)
    for shingle in (input[i:i + size]
                    for i in xrange(len(input) - (size - 1))):
        d[shingle] += 1
    return iteritems(d)


def simhash(features, hashbits=32):
    if hashbits == 32:
        hashfn = hash
    else:
        hashfn = lambda s: _hash(s, hashbits)

    vs = [0] * hashbits
    for feature, weight in features:
        h = hashfn(feature)
        for i in xrange(hashbits):
            if h & (1 << i):
                vs[i] += weight
            else:
                vs[i] -= weight

    out = 0
    for i, v in enumerate(vs):
        if v > 0:
            out |= 1 << i
    return out


def _hash(s, hashbits):
    # A variable-length version of Python's builtin hash
    if s == "":
        return 0
    else:
        x = ord(s[0]) << 7
        m = 1000003
        mask = 2 ** hashbits - 1
        for c in s:
            x = ((x * m) ^ ord(c)) & mask
        x ^= len(s)
        if x == -1:
            x = -2
        return x


def hamming_distance(first_hash, other_hash, hashbits=32):
    x = (first_hash ^ other_hash) & ((1 << hashbits) - 1)
    tot = 0
    while x:
        tot += 1
        x &= x - 1
    return tot


# Clustering

def kmeans(data, k, t=0.0001, distfun=None, maxiter=50, centers=None):
    """
    One-dimensional K-means clustering function.

    :param data: list of data points.
    :param k: number of clusters.
    :param t: tolerance; stop if changes between iterations are smaller than
        this value.
    :param distfun: a distance function.
    :param centers: a list of centroids to start with.
    :param maxiter: maximum number of iterations to run.
    """

    # Adapted from a C version by Roger Zhang, <rogerz@cs.dal.ca>
    # http://cs.smu.ca/~r_zhang/code/kmeans.c

    DOUBLE_MAX = 1.797693e308
    n = len(data)

    error = DOUBLE_MAX  # sum of squared euclidean distance

    counts = [0] * k  # size of each cluster
    labels = [0] * n  # output cluster label for each data point

    # c1 is an array of len k of the temp centroids
    c1 = [0] * k

    # choose k initial centroids
    if centers:
        c = centers
    else:
        c = random.sample(data, k)

    niter = 0
    # main loop
    while True:
        # save error from last step
        old_error = error
        error = 0

        # clear old counts and temp centroids
        for i in xrange(k):
            counts[i] = 0
            c1[i] = 0

        for h in xrange(n):
            # identify the closest cluster
            min_distance = DOUBLE_MAX
            for i in xrange(k):
                distance = (data[h] - c[i]) ** 2
                if distance < min_distance:
                    labels[h] = i
                    min_distance = distance

            # update size and temp centroid of the destination cluster
            c1[labels[h]] += data[h]
            counts[labels[h]] += 1
            # update standard error
            error += min_distance

        for i in xrange(k):  # update all centroids
            c[i] = c1[i] / counts[i] if counts[i] else c1[i]

        niter += 1
        if (abs(error - old_error) < t) or (niter > maxiter):
            break

    return labels, c


# Sliding window clusters

def two_pass_variance(data):
    n = 0
    sum1 = 0
    sum2 = 0

    for x in data:
        n += 1
        sum1 = sum1 + x

    mean = sum1 / n

    for x in data:
        sum2 += (x - mean) * (x - mean)

    variance = sum2 / (n - 1)
    return variance


def weighted_incremental_variance(data_weight_pairs):
    mean = 0
    S = 0
    sumweight = 0
    for x, weight in data_weight_pairs:
        temp = weight + sumweight
        Q = x - mean
        R = Q * weight / temp
        S += sumweight * Q * R
        mean += R
        sumweight = temp
    Variance = S / (sumweight - 1)  # if sample is the population, omit -1
    return Variance


def swin(data, size):
    clusters = []
    for i, left in enumerate(data):
        j = i
        right = data[j]
        while j < len(data) - 1 and right - left < size:
            j += 1
            right = data[j]
        v = 99999
        if j - i > 1:
            v = two_pass_variance(data[i:j + 1])
        clusters.append((left, right, j - i, v))
    clusters.sort(key=lambda x: (0 - x[2], x[3]))
    return clusters
