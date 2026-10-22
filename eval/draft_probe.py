"""Real model, synthetic context, text timing only; never audible-latency evidence."""
import asyncio
import json
from pathlib import Path
import subprocess
import sys
import time
import uuid

from agents.messages import envelope
from gateway.a2a_client import AgentPool
from gateway.tracing import trace_logger


async def main():
    child=subprocess.Popen([sys.executable,'-B','-m','agents.agent_server','--agent','ai_engineer',
        '--port','9201','--env-file',r'C:\Dev\Hacks\multiagent podcast\.env',
        '--bid-model','openai/gpt-oss-20b','--speak-model','openai/gpt-oss-120b'],
        stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    pool=AgentPool({'ai_engineer':'http://127.0.0.1:9201/'},trace_logger,uuid.uuid4().hex,2500)
    result={'mode':'real model / synthetic text context','acoustic_latency':None}
    text='Modern AI tools cannot choose any architecture, so there is no reason to test their design capabilities.'
    try:
        for _ in range(50):
            try:await pool.connect();break
            except Exception:await asyncio.sleep(.1)
        for prepared in (False,True):
            trace=uuid.uuid4().hex
            if prepared:
                begin=time.perf_counter()
                await pool.call('ai_engineer',envelope('floor.prepare',trace,0,'gateway','ai_engineer',
                    speaker='software_developer',text=text,memory={}),timeout=15)
                result['preparation_ms']=round((time.perf_counter()-begin)*1000,1)
            replies=await pool.call('ai_engineer',envelope('floor.utterance',trace,0,'software_developer',
                'ai_engineer',text=text,memory={}))
            if replies[0].payload['intent']=='pass':
                result['prepared_pass' if prepared else 'baseline_pass']=True
                continue
            begin=time.perf_counter()
            await pool.call('ai_engineer',envelope('floor.grant',trace,1,'gateway','ai_engineer',context_version=0))
            result['prepared_grant_ms' if prepared else 'baseline_grant_ms']=round((time.perf_counter()-begin)*1000,1)
            if prepared:result['cache_hit']=replies[0].cache_hit
    except Exception as exc:result['error_type']=type(exc).__name__
    finally:
        await pool.close()
        if child.poll() is None:child.terminate()
        await asyncio.to_thread(child.wait,timeout=5)
    Path('docs/draft_probe_results.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result))


if __name__=='__main__':asyncio.run(main())
