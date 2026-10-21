# 05 — Organizer Topic Pack and Content Rules

**Source:** `AI_Roundtable_Beginning_Prompt_Pack_Topics_1-3.docx`, pages 1–3.  
**Authority:** [OFFICIAL] The instructions say select **one of the topics**, use its background as starting context, and begin with the **supplied opening prompt**. Role suggestions can be customized. Do not deliver fixed scripted dialogue.

> **Integration note:** The text in the three **Opening prompt (verbatim)** blocks below is copied from the organizer file. Preserve the wording when injecting the selected initial task. Curly quote marks surrounding the prompt are presentation punctuation; the sentence itself is the payload.

## Topic 1 — Will AI Replace Software Developers?

**Background brief (official, paraphrased for compactness):** Coding tools can write/debug/explain code and automate tasks, but engineering includes architecture, security, testing, maintenance and user needs.

**Suggested roles (official):**

1. **AI Engineer** — AI coding capabilities and automation.
2. **Software Developer** — quality, architecture and practical limitations.
3. **Open-Source Maintainer** — security, reviews and long-term maintenance.

**Opening prompt (verbatim):**

> AI coding agents are becoming increasingly capable of building software. Will they eventually replace software developers, or will they transform the role of developers? Discuss your perspectives, challenge one another's assumptions, and work towards a nuanced conclusion.

**Potential unscripted test prompts (our proposal, NOT organizer dialogue):**

- 'Open-Source Maintainer, respond to the AI Engineer's latest claim about faster code reviews.'
- 'What changes if junior developers rely on tools for every task?'
- 'Software Developer, change your answer if the code is safety-critical.'
- 'Which issue do two experts actually agree on?'

**Note:** No prewritten rebuttal should be hardcoded. These are test inputs only.

## Topic 2 — Should AI Make Decisions That Affect Human Lives?

**Background brief (official, paraphrased):** AI already influences hiring, healthcare, loans and public services, offering efficiency but creating bias, error, privacy and accountability concerns.

**Suggested roles (official):**

1. **AI Researcher** — capabilities, limitations and reliability.
2. **Ethics and Policy Expert** — fairness, privacy and accountability.
3. **Industry Leader** — implementation, efficiency and trade-offs.

**Opening prompt (verbatim):**

> Imagine a future where AI systems can make decisions faster and sometimes more consistently than humans. Should AI be allowed to make important decisions about people's lives autonomously, or should humans always retain the final authority? Debate the benefits, risks, and exceptions.

**Potential unscripted test prompts (our proposal):**

- 'Ethics and Policy Expert, answer the Industry Leader's claim about efficiency.'
- 'How does the answer change if an AI rejects a loan application unfairly?'
- 'AI Researcher, what evidence would you require before deployment?'

**Product care:** These are societal and policy arguments, not instructions to make individualized medical, financial or legal decisions. Avoid claiming the AI panel is a source of professional advice.

## Topic 3 — Should AI Tutors Replace Traditional Teaching?

**Background brief (official, paraphrased):** AI tutors can personalize instruction and expand access, while classroom learning also involves social development, mentorship, motivation, privacy and uneven technology access.

**Suggested roles (official):**

1. **Learning Scientist** — pedagogy and educational outcomes.
2. **AI Product Engineer** — personalization and scalability.
3. **Teacher or Education Advocate** — mentorship, accessibility and classroom realities.

**Opening prompt (verbatim):**

> Suppose every student could access a personalized AI tutor at almost zero cost. Should education systems shift towards AI-driven learning, or would this sacrifice important aspects of human teaching? Discuss who benefits, who might be disadvantaged, and what an ideal education system would look like.

**Potential unscripted test prompts (our proposal):**

- 'Teacher, what does the product engineer overlook about student motivation?'
- 'What about a school with almost no internet access?'
- 'Learning Scientist, explain what success should be measured by.'

## Instructions that apply to all topics — organizer requirements

1. Choose **one** of the provided topics; use its background as initial context.
2. Configure at least three agents with distinct expertise, roles and voices; provided role suggestions may be customized.
3. Agents **may** conduct research with chosen tools/sources. Research informs rather than replaces discussion.
4. Begin with the **supplied opening prompt**; agents react to each other's actual contributions and challenge assumptions appropriately.
5. No predetermined dialogue or fixed speaker sequence standing in for collaboration.
6. Human participant can interrupt, name one expert, ask follow-ups and resume with context.
7. Expect unseen questions, objections, interruptions and changes of direction.

## Content data contract — PROPOSED, not actual implementation

```json
{
  "topic_id": "topic_1",
  "title": "Will AI Replace Software Developers?",
  "background_brief": "Use actual supplied background text",
  "opening_prompt": "Use the exact supplied opening prompt above",
  "agents": [
    {"agent_id": "ai_engineer", "role": "AI Engineer", "voice_id": "CONFIGURE"},
    {"agent_id": "software_developer", "role": "Software Developer", "voice_id": "CONFIGURE"},
    {"agent_id": "oss_maintainer", "role": "Open-Source Maintainer", "voice_id": "CONFIGURE"}
  ]
}
```

**Decide with teammate:** Whether to support all three start topics immediately or a single fully tested starter topic plus ability to handle judge-introduced follow-up/topic shifts. Never present disabled topics as implemented.
