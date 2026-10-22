"""Provider-level constrained shape plus independent application-level validation."""
import json

from gateway.evidence import BY_ID

ACTS = ['statement', 'question', 'challenge', 'evidence', 'correction', 'summary', 'interpretation']


def speech_schema(memory, speaker):
    delivered = memory.get('delivered_turns', []) + memory.get('earlier_references', [])
    reply_ids = sorted({t['turn_id'] for t in delivered if type(t.get('turn_id')) is int})
    own_claims = [c['id'] for c in memory.get('claims', []) if c['agent_id'] == speaker]
    correction = {'type': 'string'}
    if own_claims:
        correction['enum'] = own_claims
    fields = {'text': {'type': 'string'}, 'act': {'type': 'string', 'enum': ACTS},
              'source_ids': {'type': 'array', 'items': {'type': 'string', 'enum': list(BY_ID)}},
              'reply_to': {'type': ['integer', 'null'], 'enum': [None] + reply_ids},
              'corrects': {'type': 'array', 'items': correction}}
    return {'type': 'object', 'additionalProperties': False, 'required': ['sentences'],
            'properties': {'sentences': {'type': 'array', 'items': {
                'type': 'object', 'additionalProperties': False,
                'required': list(fields), 'properties': fields}}}}


def unpack_speech(raw):
    """Do not trust a provider guarantee: reject malformed objects locally as well."""
    payload = json.loads(raw)
    if not isinstance(payload, dict) or set(payload) != {'sentences'}:
        raise ValueError('Invalid structured speech root')
    items = payload['sentences']
    if not isinstance(items, list) or not 1 <= len(items) <= 5:
        raise ValueError('Invalid structured sentence count')
    sentences, annotations = [], []
    for i, item in enumerate(items):
        if not isinstance(item, dict) or set(item) != {'text', 'act', 'source_ids', 'reply_to', 'corrects'}:
            raise ValueError('Invalid structured sentence fields')
        if not isinstance(item['text'], str) or not item['text'].strip():
            raise ValueError('Empty structured sentence')
        sentences.append(item['text'].strip())
        annotations.append({'sentence_idx': i, **{k: v for k, v in item.items() if k != 'text'}})
    return sentences, {'annotations': annotations}
