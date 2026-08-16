"""Structural checks on the single-file apps. Run after every edit.

    python3 verify.py                 # both apps
    python3 verify.py puzzle.html     # just one

Catches the class of bug that has already bitten this project once: a patch
spliced JavaScript into the <style> block and deleted the entire <body>, and
it still passed `node --check` because the surviving script happened to
parse. So: structure, not just syntax.
"""
import re
import subprocess
import sys

# Per-file rules. `storage` is either 'none' (any reference fails) or the
# name of the object literal that is allowed to be the sole place browser
# storage is touched.
TARGETS = {
    'eye-trainer.html': {
        'needs': ('dockCount', 'pairChips', 'shuffleEyes', 'calibOpen', 'blueRange', 'presetChips'),
        'storage': 'none',
    },
    'puzzle.html': {
        'needs': ('field', 'modeChips', 'eyeChips', 'pairChips', 'blueRange', 'redRange',
                  'gear', 'statLine', 'picChips', 'toneChips', 'picGallery', 'contrastRange',
                  'dockPieces', 'dockFusion', 'dockShapes', 'holesMove', 'packChips', 'sceneGallery',
                  'rowClears'),
        'storage': 'store',
    },
}


def block(src, opener):
    """Source of a brace-delimited block starting at `opener`, braces balanced."""
    i = src.index(opener)
    j = src.index('{', i)
    depth = 0
    for k in range(j, len(src)):
        if src[k] == '{':
            depth += 1
        elif src[k] == '}':
            depth -= 1
            if depth == 0:
                return i, k + 1
    raise ValueError('unbalanced block at ' + opener)


def check(path, rules):
    src = open(path).read()
    fail = []

    # 1. one style block, one script block, script after the body markup
    if src.count('<style>') != 1 or src.count('</style>') != 1:
        return ['%s: expected exactly one <style> block' % path]
    if src.count('<script>') != 1 or src.count('</script>') != 1:
        return ['%s: expected exactly one <script> block' % path]
    style = src[src.index('<style>'):src.index('</style>')]
    js = src[src.index('<script>') + 8:src.index('</script>')]
    body = src[src.index('<body>'):src.index('<script>')]

    # 2. no JS leaked into the stylesheet (the bug that broke the last build)
    for probe in ('function ', 'addEventListener', 'const state'):
        if probe in style:
            fail.append('JS leaked into <style>: %r' % probe)

    # 3. every element the script reaches for must exist in the markup
    ids_defined = set(re.findall(r'id="([A-Za-z0-9_]+)"', body))
    ids_used = set(re.findall(r"\$\('([A-Za-z0-9_]+)'\)", js))
    ids_used |= set(re.findall(r"getElementById\('([A-Za-z0-9_]+)'\)", js))
    dynamic = {'read0', 'read1', 'read2'}
    missing = ids_used - ids_defined - dynamic
    if missing:
        fail.append('script references missing ids: %s' % sorted(missing))

    # 4. selector targets used by the sync code
    for sel in re.findall(r"querySelectorAll\('#([A-Za-z0-9_]+)", js):
        if sel not in ids_defined:
            fail.append('querySelectorAll on missing id: #%s' % sel)
    for sel in re.findall(r"mark\('#([A-Za-z0-9_]+)", js):
        if sel not in ids_defined:
            fail.append('mark() on missing id: #%s' % sel)

    # 5. group()/toggle() containers exist
    for cid in re.findall(r"group\('([A-Za-z0-9_]+)'", js):
        if cid not in ids_defined:
            fail.append('group() on missing id: #%s' % cid)
    for tid in re.findall(r"(?<![.\w])toggle\('([A-Za-z0-9_]+)'", js):
        if tid not in ids_defined:
            fail.append('toggle() on missing id: #%s' % tid)

    # 6. balanced structural tags
    for tag in ('html', 'head', 'body', 'main', 'section', 'style', 'script'):
        o = len(re.findall(r'<%s[ >]' % tag, src))
        c = src.count('</%s>' % tag)
        if o != c:
            fail.append('unbalanced <%s>: %d open / %d close' % (tag, o, c))

    # 7. required feature surfaces still present
    for need in rules['needs']:
        if need not in ids_defined:
            fail.append('missing feature element: %s' % need)

    # 8. browser storage. Either banned outright, or confined to one wrapped
    #    helper so a blocked store degrades to defaults instead of throwing.
    hits = [m.start() for m in re.finditer(r'\b(?:localStorage|sessionStorage)\b', js)]
    if rules['storage'] == 'none':
        if hits:
            fail.append('browser storage used (this file must run where storage is blocked)')
    elif hits:
        try:
            lo, hi = block(js, 'const %s = {' % rules['storage'])
        except ValueError as exc:
            fail.append('storage helper %r not found: %s' % (rules['storage'], exc))
        else:
            stray = [h for h in hits if not (lo <= h < hi)]
            if stray:
                fail.append('storage touched outside %s{}: %d site(s)' % (rules['storage'], len(stray)))
            guard = js[lo:hi]
            if guard.count('try{') < 2 or guard.count('catch') < 2:
                fail.append('%s{} must wrap every read and write in try/catch' % rules['storage'])

    # 9. offline: no external resources
    ext = re.findall(r'(?:src|href)="(https?://[^"]+)"', src)
    if ext:
        fail.append('external resources: %s' % ext)

    # 10. the script actually parses
    tmp = '/tmp/js_only_%s.js' % path.replace('.', '_')
    open(tmp, 'w').write(js)
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    if r.returncode:
        fail.append('JS parse error: ' + r.stderr.strip()[:200])

    print('%-18s ids defined %d · ids used %d · %d lines'
          % (path, len(ids_defined), len(ids_used), len(src.splitlines())))
    return ['%s: %s' % (path, f) for f in fail]


def main():
    want = sys.argv[1:] or list(TARGETS)
    problems = []
    for path in want:
        if path not in TARGETS:
            problems.append('%s: no rules defined' % path)
            continue
        problems += check(path, TARGETS[path])
    print()
    print('\n'.join('FAIL  ' + p for p in problems) if problems else 'PASS  all structural checks')
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
