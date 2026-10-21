"""Deterministic floor arbitration. No model, prompt, or discussion generation."""
from collections import Counter
import hashlib

from agents.messages import Bid


class Moderator:
    def __init__(self, seed=0):
        self.seed = seed
        self.speakers = []

    def choose(self, bids: dict[str, Bid], *, addressed=None):
        counts = Counter(self.speakers)
        scores = {}
        for agent, bid in bids.items():
            if bid.intent == 'pass' or self.speakers[-1:] == [agent]:
                continue
            recent = self.speakers[-3:]
            recency = (1 / (recent[::-1].index(agent) + 1)) if agent in recent else 0
            dominance = counts[agent] / max(1, len(self.speakers))
            scores[agent] = round(0.45 * bid.urgency + 0.30 * bid.novelty
                                  + 0.35 * (agent == addressed) - 0.25 * recency
                                  - 0.80 * dominance, 6)
        if not scores:
            return None, scores
        def ranking(agent):
            tie = hashlib.sha256(f'{self.seed}:{len(self.speakers)}:{agent}'.encode()).hexdigest()
            return scores[agent], tie
        return max(scores, key=ranking), scores

    def record(self, agent):
        self.speakers.append(agent)
