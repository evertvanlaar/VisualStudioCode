# -*- coding: utf-8 -*-
samples = [
    "Î£Ï…Î¼Î²Î¿Ï…Î»Î®",
    "Î•Î³ÎºÎ±Ï„Î¬ÏƒÏ„Î±ÏƒÎ·",
    "ÎŸÎ´Î·Î³ÏŒÏ‚ ÎšÎ±Î»ÏŽÎ½ ÎÎµÏÏŽÎ½",
    "Already have the",
    "â€”",
    "Â©",
]

def fix(s):
    try:
        return s.encode("latin-1").decode("utf-8")
    except UnicodeError:
        return s

for s in samples:
    print(repr(s), "->", repr(fix(s)))
