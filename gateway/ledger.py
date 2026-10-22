"""Bounded, verbatim conversation memory. Nothing is marked verified without evidence."""
import re

from agents.llm import spoken_sentences


class Ledger:
    def __init__(self, topic):
        self.focus = topic
        self.topic_version = 0
        self.turns = []
        self.claims = []
        self.serial = 0

    def remember(self, speaker, text, turn_id):
        if self.turns and self.turns[-1] == {'speaker': speaker, 'text': text, 'turn_id': turn_id}:
            return
        self.turns.append({'speaker': speaker, 'text': text, 'turn_id': turn_id})
        self.turns = self.turns[-60:]
        if speaker == 'human':
            return
        for sentence in spoken_sentences(text):
            if sentence.endswith('?') or any(c['agent_id'] == speaker and c['text'] == sentence for c in self.claims):
                continue
            self.serial += 1
            self.claims.append({'id': f'c{self.serial}', 'agent_id': speaker, 'text': sentence,
                'status': 'open', 'verified': False, 'turn_id': turn_id, 'topic_version': self.topic_version})
        self.claims = self.claims[-120:]

    def transition(self, claim_id, actor, intent):
        claim = next((c for c in self.claims if c['id'] == claim_id), None)
        if not claim:
            return False
        if intent == 'challenge' and actor != claim['agent_id']:
            claim['status'] = 'challenged'
        elif intent == 'agree' and actor != claim['agent_id']:
            claim['status'] = 'agreed'
        elif intent == 'concede' and actor == claim['agent_id']:
            claim['status'] = 'conceded'
        else:
            return False
        return True

    def shift(self, focus):
        self.focus = focus[:1000]
        self.topic_version += 1

    def public_claims(self):
        return [{k: c[k] for k in ('id', 'agent_id', 'text', 'status', 'verified')}
                for c in self.claims if c['topic_version'] == self.topic_version][-12:]

    def context(self, query=''):
        tokens = set(re.findall(r'\w{3,}', query.casefold()))
        ranked = sorted(enumerate(self.turns), key=lambda item: (
            len(tokens & set(re.findall(r'\w{3,}', item[1]['text'].casefold()))), -item[0]), reverse=True)
        refs = [turn for _, turn in ranked[:4]] if tokens else self.turns[:3]
        # Extractive summary: exact attributed excerpts, not invented conclusions.
        summary = ' '.join(f"{t['speaker']}: {t['text'][:160]}" for t in self.turns[:-8][-4:])
        return {'focus': self.focus, 'summary': ' '.join(summary.split()[:120]),
                'earlier_references': refs, 'claims': self.public_claims()}
