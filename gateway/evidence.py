"""Small reviewed source library, not a general search engine or fact checker.

These excerpts were checked against the primary arXiv abstracts on 2026-10-22.
They establish bounded findings, not predictions about replacing developers.
"""
import re

SOURCES = [
    {'id': 'react-abstract', 'title': 'ReAct: Synergizing Reasoning and Acting in Language Models',
     'url': 'https://arxiv.org/abs/2210.03629v3', 'locator': 'Abstract, methods sentence',
     'excerpt': 'actions allow it to interface with external sources, such as knowledge bases or environments, to gather additional information.',
     'finding': 'ReAct combines model reasoning with actions that obtain information from an external environment.',
     'limitation': 'The abstract reports specific benchmarks; it does not establish autonomous software architecture or employment outcomes.'},
    {'id': 'reflexion-abstract', 'title': 'Reflexion: Language Agents with Verbal Reinforcement Learning',
     'url': 'https://arxiv.org/abs/2303.11366v4', 'locator': 'Abstract, proposed framework',
     'excerpt': 'not by updating weights, but instead through linguistic feedback',
     'finding': 'Reflexion stores verbal feedback in episodic memory to inform subsequent trials without updating model weights.',
     'limitation': 'Results concern the evaluated tasks and feedback setup; improvement is not a guarantee on an arbitrary project.'},
    {'id': 'transformer-abstract', 'title': 'Attention Is All You Need',
     'url': 'https://arxiv.org/abs/1706.03762v7', 'locator': 'Abstract, architecture and evaluated tasks',
     'excerpt': 'based solely on attention mechanisms, dispensing with recurrence and convolutions entirely',
     'finding': 'The paper proposes the Transformer and evaluates it on machine translation and constituency parsing.',
     'limitation': 'These experiments are not evidence that a model understands business requirements or replaces software developers.'},
]
BY_ID = {s['id']: s for s in SOURCES}


def retrieve(query, limit=3):
    """Transparent lexical selection over a tiny, explicitly bounded source pack."""
    words = set(re.findall(r'\w{4,}', query.casefold()))
    ranked = sorted(SOURCES, key=lambda s: len(words & set(re.findall(
        r'\w{4,}', (s['title'] + ' ' + s['finding']).casefold()))), reverse=True)
    return [dict(s) for s in ranked[:limit]]


def validate_annotations(metadata, sentences, memory, speaker):
    """Check reference integrity; never equate a valid ID with semantic support."""
    if not isinstance(metadata, dict):
        raise ValueError('Metadata must be an object')
    annotations = metadata.get('annotations', [])
    if not isinstance(annotations, list) or len(annotations) > len(sentences):
        raise ValueError('Invalid annotations')
    result, seen = {}, set()
    known_turns = {t['turn_id'] for t in memory.get('delivered_turns', []) + memory.get('earlier_references', [])}
    claims = {c['id']: c for c in memory.get('claims', [])}
    for item in annotations:
        if not isinstance(item, dict):
            raise ValueError('Invalid annotation')
        idx = item.get('sentence_idx')
        refs = item.get('source_ids', [])
        act = item.get('act', 'statement')
        reply = item.get('reply_to')
        corrections = item.get('corrects', [])
        if (type(idx) is not int or idx < 0 or idx >= len(sentences) or idx in seen
                or not isinstance(refs, list) or any(not isinstance(r, str) or r not in BY_ID for r in refs)
                or act not in ('statement', 'question', 'challenge', 'evidence', 'correction', 'summary', 'interpretation')
                or (reply is not None and (type(reply) is not int or reply not in known_turns))
                or not isinstance(corrections, list)
                or any(not isinstance(c, str) or c not in claims or claims[c]['agent_id'] != speaker for c in corrections)):
            raise ValueError('Unknown or invalid evidence/reply/correction reference')
        seen.add(idx)
        result[idx] = {'source_ids': list(dict.fromkeys(refs)), 'act': act, 'reply_to': reply,
                       'corrects': corrections, 'verification': 'not_independently_verified'}
    return result
