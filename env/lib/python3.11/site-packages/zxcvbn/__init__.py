from datetime import datetime

from . import matching, scoring, time_estimates, feedback

def zxcvbn(password, user_inputs=None):
    try:
        # Python 2 string types
        basestring = (str, unicode)
    except NameError:
        # Python 3 string types
        basestring = (str, bytes)

    if user_inputs is None:
        user_inputs = []

    start = datetime.now()

    sanitized_inputs = []
    for arg in user_inputs:
        if not isinstance(arg, basestring):
            arg = str(arg)
        sanitized_inputs.append(arg.lower())

    ranked_dictionaries = matching.RANKED_DICTIONARIES
    ranked_dictionaries['user_inputs'] = matching.build_ranked_dict(sanitized_inputs)

    matches = matching.omnimatch(password, ranked_dictionaries)
    result = scoring.most_guessable_match_sequence(password, matches)
    result['calc_time'] = datetime.now() - start

    attack_times = time_estimates.estimate_attack_times(result['guesses'])
    for prop, val in attack_times.items():
        result[prop] = val

    result['feedback'] = feedback.get_feedback(result['score'],
                                               result['sequence'])

    return result
