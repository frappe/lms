import zopfli
import zopfli.zopfli

def compress(data, *args, **kwargs):
    """gzip.compress(data, **kwargs)
    
    """ + zopfli.__COMPRESSOR_DOCSTRING__  + """
    Returns:
      String containing a gzip container
    """
    kwargs['gzip_mode'] = 1
    return zopfli.zopfli.compress(data, *args, **kwargs)
