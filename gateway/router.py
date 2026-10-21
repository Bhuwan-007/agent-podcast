"""Conservative human addressing; general questions use expert bids, not guessed names."""
import difflib
import re


def route_question(text, agents, hint=None):
    known = {a['agent_id']: a for a in agents}
    def result(kind, target=None, question=None):
        return {'kind': kind, 'target': target, 'question': question}
    if hint is not None:
        return result('targeted', hint) if hint in known else result('unknown_target', question='Which available expert did you mean?')
    clean = re.sub(r'[^\w\s]', ' ', text.casefold())
    clean = ' '.join(clean.split())
    if clean in ('go on', 'continue', 'carry on', 'resume', 'sorry carry on'):
        return result('continue')
    if re.match(r"(?i)^(?:let.s switch|change (?:the )?topic|new topic|now discuss|switch to)\b", text.strip()):
        return result('topic_shift')
    matches = set()
    for agent in agents:
        for alias in agent['aliases']:
            alias = ' '.join(re.sub(r'[^\w\s]', ' ', alias.casefold()).split())
            if re.search(r'(?<!\w)' + re.escape(alias) + r'(?!\w)', clean):
                matches.add(agent['agent_id'])
    if len(matches) == 1:
        return result('targeted', next(iter(matches)))
    if len(matches) > 1:
        return result('unknown_target', question='Which one expert should answer first?')
    name = re.match(r'^(?:Hey\s+)?([A-Z][a-z]{1,20})(?:[,?:]|\s+(?:can|could|would|what|why|how)\b)', text.strip())
    if name and name[1] not in ('What', 'Why', 'How', 'Could', 'Would', 'Can', 'Please', 'Should'):
        candidates = [a['agent_id'] for a in agents if difflib.SequenceMatcher(None,
                      name[1].casefold(), a['display_name'].casefold()).ratio() >= .88]
        if len(candidates) == 1:
            return result('targeted', candidates[0])
        return result('unknown_target', question='Which available expert did you mean?')
    return result('general')
