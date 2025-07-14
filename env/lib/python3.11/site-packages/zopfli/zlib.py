import zopfli
import zopfli.zopfli

def compress(data, **kwargs):
    """zlib.compress(data, **kwargs)
    
    """ + zopfli.__COMPRESSOR_DOCSTRING__  + """
    Returns:
      String containing a zlib container
    """
    kwargs['gzip_mode'] = 0
    return zopfli.zopfli.compress(data, **kwargs)
