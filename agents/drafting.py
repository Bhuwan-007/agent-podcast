"""Optional speculative text only. Strict content/context keys prevent stale reuse."""
import copy
import hashlib
import json

from agents.messages import AGENTS, Bid


def key(event, direct):
    body = {'version':event.turn_id, 'speaker':event.sender, 'text':event.payload['text'],
            'memory':event.payload.get('memory',{}), 'direct':list(direct)}
    return hashlib.sha256(json.dumps(body,sort_keys=True).encode()).hexdigest()


async def prepare(expert, state, event):
    if event.turn_id <= state['version']:
        return False
    projected = copy.deepcopy(state)
    speaker = event.payload['speaker']
    from agents.messages import envelope
    future = envelope('floor.utterance',event.trace_id,event.turn_id,speaker,expert.id,
                      text=event.payload['text'],memory=event.payload.get('memory',{}))
    projected['history'].append({'turn_id':event.turn_id,'speaker':speaker,'text':event.payload['text']})
    projected['memory']=event.payload.get('memory',{})
    context_key=key(future, projected['direct'])
    system=(f"You are {expert.persona['display_name']} ({expert.persona['role']}). "
        f"Stance: {expert.persona['stance']}. Decide whether to contribute next. "
        'Return JSON fields intent (agree|build|challenge|clarify|pass), target (another expert ID or null), '
        'claim_id (known id or null), urgency and novelty (0..1), preview (at most 12 words). '
        f"Valid IDs: {', '.join(AGENTS)}. Never target yourself. Do not force disagreement.")
    bid=Bid.model_validate_json(await expert.model.complete(system,json.dumps({
        'latest':projected['history'][-1], 'claims':projected['memory'].get('claims',[])[-4:]}),bid=True))
    known={c['id'] for c in projected['memory'].get('claims',[])}
    if bid.target==expert.id or (bid.claim_id and bid.claim_id not in known):
        return False
    sentences=await expert.speak(projected,bid) if bid.intent!='pass' else None
    state['prepared']={'key':context_key,'bid':bid,'sentences':sentences}
    return True
