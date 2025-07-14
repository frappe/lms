import zopfli
from zopfli.zopfli import png_optimize as optimize

__all__ = ["optimize"]


def main(args=None):
    import argparse
    import os

    parser = argparse.ArgumentParser(prog="python -m zopfli.png")
    parser.add_argument("infile")
    parser.add_argument("outfile")
    parser.add_argument("-v", "--verbose", action="store_true", help="print more info")
    parser.add_argument(
        "-m",
        action="store_true",
        dest="compress_more",
        help="compress more: use more iterations (depending on file size).",
    )
    parser.add_argument(
        "-y",
        dest="overwrite",
        action="store_true",
        help="do not ask about overwriting files.",
    )
    parser.add_argument(
        "--lossy_transparent",
        action="store_true",
        help="remove colors behind alpha channel 0. No visual difference.",
    )
    parser.add_argument(
        "--lossy_8bit",
        action="store_true",
        help="convert 16-bit per channel image to 8-bit per channel.",
    )
    parser.add_argument(
        "--always_zopflify",
        action="store_true",
        help="always output the image encoded by Zopfli, even if bigger than original.",
    )
    parser.add_argument(
        "-q",
        dest="use_zopfli",
        action="store_false",
        help="use quick, but not very good, compression.",
    )
    parser.add_argument(
        "--iterations",
        default=None,
        type=int,
        help=(
            "number of iterations, more iterations makes it slower but provides "
            "slightly better compression. Default: 15 for small files, 5 for large files."
        ),
    )
    parser.add_argument(
        "--filters",
        dest="filter_strategies",
        help=(
            "filter strategies to try: "
            "0-4: give all scanlines PNG filter type 0-4; "
            "m: minimum sum; "
            "e: entropy; "
            "p: predefined (keep from input, this likely overlaps another strategy); "
            "b: brute force (experimental). "
            "By default, if this argument is not given, one that is most likely the best "
            "for this image is chosen by trying faster compression with each type. "
            "If this argument is used, all given filter types are tried with slow "
            "compression and the best result retained. "
            "A good set of filters to try is --filters=0me."
        ),
    )
    parser.add_argument(
        "--keepchunks",
        type=lambda s: s.split(","),
        help=(
            "keep metadata chunks with these names that would normally be removed, "
            "e.g. tEXt,zTXt,iTXt,gAMA, ... Due to adding extra data, this increases "
            "the result size. Keeping bKGD or sBIT chunks may cause additional worse "
            "compression due to forcing a certain color type, it is advised to not "
            "keep these for web images because web browsers do not use these chunks. "
            "By default ZopfliPNG only keeps (and losslessly modifies) the following "
            "chunks because they are essential: IHDR, PLTE, tRNS, IDAT and IEND."
        ),
    )

    options = parser.parse_args(args)

    log = print if options.verbose else lambda *_: None

    if options.iterations is not None:
        num_iterations = num_iterations_large = options.iterations
    else:
        # these constants are taken from zopflipng_lib.cc, unlikely to ever change
        num_iterations, num_iterations_large = 15, 5
        if options.compress_more:
            num_iterations *= 4
            num_iterations_large *= 4

    with open(options.infile, "rb") as f:
        input_png = f.read()

    log(f"Optimizing {options.infile}")

    result_png = optimize(
        input_png,
        verbose=options.verbose,
        lossy_transparent=options.lossy_transparent,
        lossy_8bit=options.lossy_8bit,
        filter_strategies=options.filter_strategies,
        keepchunks=options.keepchunks,
        use_zopfli=options.use_zopfli,
        num_iterations=num_iterations,
        num_iterations_large=num_iterations_large,
    )

    input_size = len(input_png)
    log(f"Input size: {input_size} ({input_size // 1024}K)")
    result_size = len(result_png)
    percentage = round(result_size / input_size * 100, 3)
    log(
        f"Result size: {result_size} ({result_size // 1024}K). "
        f"Percentage of original: {percentage}%"
    )

    if result_size < input_size:
        log("Result is smaller")
    elif result_size == input_size:
        log("Result has exact same size")
    else:
        if options.always_zopflify:
            log("Original was smaller")
        else:
            log("Preserving original PNG since it was smaller")
            # Set output file to input since zopfli didn't improve it.
            result_png = input_png

    if (
        not options.overwrite
        and os.path.isfile(options.outfile)
        and input(f"File {options.outfile} exists, overwrite? (y/N)\n").strip().lower()
        != "y"
    ):
        return 0

    with open(options.outfile, "wb") as f:
        f.write(result_png)


if __name__ == "__main__":
    main()
