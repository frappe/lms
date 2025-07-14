from decimal import Decimal, Context, Inexact

def estimate_attack_times(guesses):
    crack_times_seconds = {
        'online_throttling_100_per_hour': Decimal(guesses) / float_to_decimal(100.0 / 3600.0),
        'online_no_throttling_10_per_second': Decimal(guesses) / float_to_decimal(10.0),
        'offline_slow_hashing_1e4_per_second': Decimal(guesses) / float_to_decimal(1e4),
        'offline_fast_hashing_1e10_per_second': Decimal(guesses) / float_to_decimal(1e10),
    }

    crack_times_display = {}
    for scenario, seconds in crack_times_seconds.items():
        crack_times_display[scenario] = display_time(seconds)

    return {
        'crack_times_seconds': crack_times_seconds,
        'crack_times_display': crack_times_display,
        'score': guesses_to_score(guesses),
    }


def guesses_to_score(guesses):
    delta = 5

    if guesses < 1e3 + delta:
        # risky password: "too guessable"
        return 0
    elif guesses < 1e6 + delta:
        # modest protection from throttled online attacks: "very guessable"
        return 1
    elif guesses < 1e8 + delta:
        # modest protection from unthrottled online attacks: "somewhat
        # guessable"
        return 2
    elif guesses < 1e10 + delta:
        # modest protection from offline attacks: "safely unguessable"
        # assuming a salted, slow hash function like bcrypt, scrypt, PBKDF2,
        # argon, etc
        return 3
    else:
        # strong protection from offline attacks under same scenario: "very
        # unguessable"
        return 4


def display_time(seconds):
    minute = 60
    hour = minute * 60
    day = hour * 24
    month = day * 31
    year = month * 12
    century = year * 100
    if seconds < 1:
        display_num, display_str = None, 'less than a second'
    elif seconds < minute:
        base = round(seconds)
        display_num, display_str = base, '%s second' % base
    elif seconds < hour:
        base = round(seconds / minute)
        display_num, display_str = base, '%s minute' % base
    elif seconds < day:
        base = round(seconds / hour)
        display_num, display_str = base, '%s hour' % base
    elif seconds < month:
        base = round(seconds / day)
        display_num, display_str = base, '%s day' % base
    elif seconds < year:
        base = round(seconds / month)
        display_num, display_str = base, '%s month' % base
    elif seconds < century:
        base = round(seconds / year)
        display_num, display_str = base, '%s year' % base
    else:
        display_num, display_str = None, 'centuries'

    if display_num and display_num != 1:
        display_str += 's'

    return display_str

def float_to_decimal(f):
    "Convert a floating point number to a Decimal with no loss of information"
    n, d = f.as_integer_ratio()
    numerator, denominator = Decimal(n), Decimal(d)
    ctx = Context(prec=60)
    result = ctx.divide(numerator, denominator)
    while ctx.flags[Inexact]:
        ctx.flags[Inexact] = False
        ctx.prec *= 2
        result = ctx.divide(numerator, denominator)
    return result