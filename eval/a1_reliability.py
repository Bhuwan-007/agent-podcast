"""Opt-in real model sample batch; records final speech only, never reasoning/keys."""

import argparse
import asyncio
import datetime as dt
import json
import statistics
from pathlib import Path

from dotenv import load_dotenv
from agents.llm import AgentError, SingleExpert
from gateway.session import load_topic


async def main(env_file, quality_case=False):
    load_dotenv(env_file, override=True)
    topic, persona = load_topic("topic_1")
    questions = [topic["opening_prompt"], topic["opening_prompt"],
        "What is one concrete coding task an agent can help with, and where does human judgment remain important?",
        "Could faster code generation increase security review work rather than reduce it? Explain the trade-off.",
        "How does this change for a student who cannot afford paid coding tools?",
        "I think tests passing proves generated software is secure. What assumption am I missing?",
        "Give an example where you would agree with a cautious open-source maintainer.",
        "Does AI definitely replace every software developer? Give a nuanced answer without inventing studies."]
    if quality_case:
        questions = [
            "What can we do to ensure they have the intelligence to judge the best type of architectures needed for a particular kind of project, and I disagree with your point because nowadays AI can do more than just boilerplates",
            "How can an AI coding agent choose between a modular monolith and microservices for a small team's project? Explain how it would justify and test the choice.",
            "You said AI agents lack architecture judgment. I disagree: they already propose designs. What would make an AI's architectural choices more reliable?",
        ]
    output = Path("docs/a1_question_quality_results.json" if quality_case else "docs/a1_reliability_results.json")
    expert = SingleExpert()
    report = {"mocked": False, "checked_at_ist": dt.datetime.now(dt.timezone(dt.timedelta(hours=5, minutes=30))).isoformat(),
              "scope": "Small A1 single-expert sample; no guarantee of future reliability or multi-agent quality.",
              "quality_review": "Requires reading the final responses; passed flags below measure completion only.", "samples": []}
    for number, question in enumerate(questions, 1):
        sample = {"sample": number, "question": question}
        try:
            sentences = await expert.respond(topic, persona, question)
            sample.update(passed=True, spoken_text=" ".join(sentences), sentence_count=len(sentences))
        except AgentError as error:
            sample.update(passed=False, error=str(error))
        sample.update(expert.last_run)
        report["samples"].append(sample)
        output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({k: sample[k] for k in ("sample", "passed", "attempts", "length_retries", "elapsed_ms")}), flush=True)
    report["passed"] = sum(s["passed"] for s in report["samples"])
    report["total"] = len(questions)
    report["median_generation_ms"] = round(statistics.median(s["elapsed_ms"] for s in report["samples"]), 1)
    report["max_generation_ms"] = max(s["elapsed_ms"] for s in report["samples"])
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "samples"}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", type=Path, required=True)
    parser.add_argument("--quality-case", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(args.env_file, args.quality_case))
