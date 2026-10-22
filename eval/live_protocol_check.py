"""Real providers with a synthetic WS playback client. NEVER acoustic acceptance."""
import asyncio
import base64
import json
from pathlib import Path
import time

import httpx
from websockets.asyncio.client import connect


async def run():
    report = {'mode':'real providers / synthetic playback-ack client',
              'acoustic_acceptance':False, 'microphone_acceptance':False,
              'voices':[], 'bytes':0, 'typed_target_reply':False, 'resumed':False,
              'end_confirmed':False, 'notices':[]}
    turn = None
    indices = set()
    interrupt_sent = False
    answered = False
    began = time.perf_counter()
    try:
        async with asyncio.timeout(100), connect('ws://127.0.0.1:8000/ws',max_size=4000000) as ws:
            await ws.send(json.dumps({'type':'start_session','topic_id':'topic_1','session_id':None}))
            async for raw in ws:
                e=json.loads(raw)
                if e['type']=='notice':report['notices'].append(e['code'])
                if e['type']=='routing' and e['kind']=='targeted':report['routed_target']=e['target']
                if e['type']=='turn_start':
                    turn=e
                    indices=set()
                    if e['kind']=='human_reply':report['typed_target_reply']=e['agent_id']=='oss_maintainer'
                    elif answered:
                        report['resumed']=True
                if e['type']=='audio_chunk':
                    report['bytes']+=len(base64.b64decode(e['data_b64']))
                    indices.add(e['sentence_idx'])
                    if answered and report['resumed']:
                        await ws.send(json.dumps({'type':'end_session'}))
                    elif len(set(report['voices']))==3 and not interrupt_sent:
                        interrupt_sent=True
                        await ws.send(json.dumps({'type':'barge_in','turn_id':e['turn_id'],'epoch':e['epoch'],
                                                  'sentence_idx':e['sentence_idx'],'played_ms':0}))
                        await ws.send(json.dumps({'type':'user_utterance','input_mode':'text','final':True,
                            'text':'Maya, what specific security assumption would you challenge in this discussion?',
                            'target_hint':'oss_maintainer'}))
                if e['type']=='transcript' and not e['final']:
                    report.setdefault('generated_text',[]).append({'speaker':e['speaker'],'text':e['text']})
                if e['type']=='turn_end' and e['status']=='completed':
                    report['voices'].append(turn['agent_id'])
                    # Explicit protocol simulation; no speaker_active/acoustic metric claim.
                    for idx in sorted(indices):
                        await ws.send(json.dumps({'type':'playback_started','turn_id':e['turn_id'],
                                                  'epoch':e['epoch'],'sentence_idx':idx}))
                    await ws.send(json.dumps({'type':'playback_stopped','turn_id':e['turn_id'],
                                              'epoch':e['epoch'],'reason':'finished'}))
                    if turn['kind']=='human_reply':answered=True
                if e.get('state')=='recovery':
                    report['recovery']=True
                    await ws.send(json.dumps({'type':'end_session'}))
                if e.get('state')=='ended':
                    report['end_confirmed']=True
                    break
    except Exception as exc:
        report['error_type']=type(exc).__name__
    report['elapsed_ms']=round((time.perf_counter()-began)*1000,1)
    report['protocol_pass']=(len(set(report['voices']))==3 and report['typed_target_reply']
                             and report['resumed'] and report['end_confirmed'])
    Path('docs/live_protocol_results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='generated_text'},indent=2))
    return report['protocol_pass']


if __name__=='__main__':
    raise SystemExit(0 if asyncio.run(run()) else 1)
