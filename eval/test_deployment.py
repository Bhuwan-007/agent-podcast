from fastapi.testclient import TestClient


def test_root_serves_built_frontend_and_preserves_backend_harness(tmp_path, monkeypatch):
    import gateway.main as gateway
    (tmp_path / 'index.html').write_text('<html>Built cinematic frontend</html>', encoding='utf-8')
    monkeypatch.setattr(gateway, 'FRONTEND_DIST', tmp_path)
    with TestClient(gateway.app) as client:
        assert 'Built cinematic frontend' in client.get('/').text
        assert 'Start live episode' in client.get('/dev/roundtable').text
        assert client.get('/health').json()['status'] == 'ok'


def test_root_without_build_retains_working_backend_page(tmp_path, monkeypatch):
    import gateway.main as gateway
    monkeypatch.setattr(gateway, 'FRONTEND_DIST', tmp_path)
    with TestClient(gateway.app) as client:
        assert 'Start live episode' in client.get('/').text
