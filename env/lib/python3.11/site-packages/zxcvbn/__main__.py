import argparse
import json
import select
import sys
import getpass

from . import zxcvbn

parser = argparse.ArgumentParser(
    description="Python implementation of Dropbox's realistic password "
                'strength estimator'
)
parser.add_argument(
    '--user-input',
    action='append',
    help='user data to be added to the dictionaries that are tested against '
         '(name, birthdate, etc)',
)

class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        try:
            return super(JSONEncoder, self).default(o)
        except TypeError:
            return str(o)

def cli():
    args = parser.parse_args()

    # check if stdin is ready for reading
    rlist, _, _ = select.select([sys.stdin], [], [], 0.0)
    if rlist:
        password = rlist[0].read()
        if password[-1] == '\n':  # strip off the trailing newline
            password = password[:-1]
    else:
        password = getpass.getpass()

    res = zxcvbn(password, user_inputs=args.user_input)
    json.dump(res, sys.stdout, indent=2, cls=JSONEncoder)
    sys.stdout.write('\n')

if __name__ == '__main__':
    sys.exit(cli())
