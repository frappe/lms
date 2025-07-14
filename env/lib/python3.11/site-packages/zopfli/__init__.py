__COMPRESSOR_DOCSTRING__ = """

Args:
  data: A string to compress

  verbose: (int 0/1) dump zopfli debugging data to stderr
  
  numiterations: Maximum amount of times to rerun forward and backward
  pass to optimize LZ77 compression cost. Good values: 10, 15 for
  small files, 5 for files over several MB in size or it will be too
  slow.

  blocksplitting: If true, splits the data in multiple deflate blocks
  with optimal choice for the block boundaries. Block splitting gives
  better compression. Default: true (1).

  blocksplittinglast: If true, chooses the optimal block split points
  only after doing the iterative LZ77 compression. If false, chooses
  the block split points first, then does iterative LZ77 on each
  individual block. Depending on the file, either first or last gives
  the best compression. Default: false (0).

  blocksplittingmax: Maximum amount of blocks to split into (0 for
  unlimited, but this can give extreme results that hurt compression
  on some files). Default value: 15.
"""

try:
    from ._version import version as __version__  # type: ignore
except ImportError:
    __version__ = "0.0.0+unknown"
