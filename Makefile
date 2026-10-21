.PHONY: run test install lint

PYTHON ?= python

install:
	$(PYTHON) -m pip install -r requirements.txt

run:
	$(PYTHON) -m uvicorn gateway.main:app --host 0.0.0.0 --port 8000 --reload

test:
	$(PYTHON) -m pytest eval/ -v
