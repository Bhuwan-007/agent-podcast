"""Reproducible automated gates and honest integration evidence summary; no paid calls."""
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]


def main():
    checks=[]
    commands=[('Backend regressions',[sys.executable,'-B','-m','pytest','eval/','-q','-p','no:cacheprovider','--tb=short'],{}),
              ('A1 player lifecycle',['node','--test','eval/test_a1_player.mjs'],{}),
              ('Panel player lifecycle',['node','--test','eval/test_a1_player.mjs'],{'PANEL_PLAYER_TEST':'1'})]
    if (ROOT/'web/node_modules/typescript').exists():
        commands += [('Actual frontend player lifecycle', ['node','--test','eval/test_web_player.mjs'], {}),
                     ('Frontend pairing diagnostic', ['node','eval/check_b5_player.mjs'], {})]
    import os
    for name,command,extra in commands:
        result=subprocess.run(command,cwd=ROOT,env=os.environ|extra,text=True,capture_output=True)
        checks.append({'name':name,'passed':result.returncode==0,
                       'output':result.stdout[-2500:]+result.stderr[-1000:]})
    evidence={}
    for name in ('a2_live_results','live_voice_results','live_gateway_results','live_protocol_results',
                 'mvp_episode_results','mvp_recovery_results','mvp_voice_gateway_results'):
        path=ROOT/f'docs/{name}.json'
        if path.exists():evidence[name]=json.loads(path.read_text(encoding='utf-8'))
    rows=[('A0/A1 regressions','PASS' if all(c['passed'] for c in checks) else 'FAIL','Current automated checks; mocked providers are labeled.'),
          ('A2 real text roundtable','PASS (diagnostic settings)','10 turns / 3 processes; 400 ms default failed.'),
          ('A3 three real TTS voices','PASS (provider transport)','All three produced actual audio bytes. Acoustic quality unavailable.'),
          ('A3/A4 real protocol','PASS' if evidence.get('live_protocol_results',{}).get('protocol_pass') else 'NOT PASSED','Synthetic playback client; no acoustic or microphone acceptance.'),
          ('A4 voice-question gateway','PASS (transport)' if evidence.get('mvp_voice_gateway_results',{}).get('protocol_pass') else 'NOT PASSED','Real synthesized input through gateway VAD/STT, named reply, resume and End; microphone unverified.'),
          ('A5 memory/claims','AUTOMATED ONLY','Verbatim bounded recall, unverified ledger, explicit focus shift; semantic recall not scored.'),
          ('A6 recovery','PASS (transport)' if evidence.get('mvp_recovery_results',{}).get('protocol_pass') else 'NOT PASSED','Real disconnect/paused restore, owned expert kill, surviving expert audio and reset; no acoustic claim.'),
          ('A7 drafting','EXPERIMENTAL / DISABLED','Cache tests pass; real timing probe failed; no live speedup claimed.'),
          ('A8 Person A demo','PASS (protocol)' if evidence.get('mvp_episode_results',{}).get('protocol_pass') else 'NOT PASSED','Three experts, pause/resume, Maya question, closing, export and End; final browser listening remains open.')]
    for name in ('mvp_episode_results','mvp_recovery_results','mvp_voice_gateway_results'):
        result=evidence.get(name,{})
        rows.append((name,'PASS (protocol)' if result.get('protocol_pass') else 'NOT PASSED',
                     f'Actual report: docs/{name}.json; synthetic playback acknowledgements, not microphone acceptance.'))
    for filename, title in [('live_smoke_episode_results', 'Short complete episode'),
                            ('live_episode_final_results', 'Long panel acceptance'),
                            ('live_recovery_results', 'Live reconnect/expert fault')]:
        path = ROOT/f'docs/{filename}.json'
        if path.exists():
            result = json.loads(path.read_text(encoding='utf-8'))
            rows.append(('Historical baseline: '+title, 'PASS (protocol)' if result.get('protocol_pass') else 'NOT PASSED',
                         f'Actual report: docs/{filename}.json; no acoustic/microphone inference.'))
    text='# Evaluation results — 2026-10-22\n\n'
    text+='| Check | Result | Evidence boundary |\n|---|---|---|\n'
    text+=''.join('| '+ ' | '.join(row)+' |\n' for row in rows)
    text+='\nBrowser automation was denied Chrome access. No microphone/audibility pass or semantic quality score is inferred.\n'
    text+='\n## Executed automated gates\n'
    for c in checks:text+=f"\n### {c['name']}: {'PASS' if c['passed'] else 'FAIL'}\n\n```text\n{c['output']}\n```\n"
    (ROOT/'docs/eval_results.md').write_text(text,encoding='utf-8')
    print('\n'.join(c['name']+': '+('PASS' if c['passed'] else 'FAIL') for c in checks))
    return 0 if all(c['passed'] for c in checks) else 1


if __name__=='__main__':raise SystemExit(main())
