import argparse

class FooAction(argparse.Action):
    def __init__(self, option_strings, dest, **kwargs):
        super().__init__(option_strings, dest, **kwargs)
    def __call__(self, parser, namespace, values, option_string=None):
        print('%r %r %r' % (namespace, values, option_string))
        # setattr(namespace, self.dest, values)

parser = argparse.ArgumentParser()
parser.add_argument('--foo', action=FooAction, nargs='*')
parser.parse_args()