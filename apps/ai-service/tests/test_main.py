from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_analyze_normal_distribution():
    response = client.post("/analyze", json={
        "entityId": "dist-1",
        "entityType": "Distribution",
        "features": {
            "distributionQuantity": 100,
            "inventoryDiscrepancy": 0,
            "beneficiaryCount": 10,
            "timeSinceLastDistributionDays": 5,
            "ratioToAvailableStock": 0.1
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert "anomalyScore" in data
    assert data["riskLevel"] in ["LOW", "MEDIUM"]
    assert len(data["reasonCodes"]) == 0

def test_analyze_anomaly_distribution():
    response = client.post("/analyze", json={
        "entityId": "dist-2",
        "entityType": "Distribution",
        "features": {
            "distributionQuantity": 6000,
            "inventoryDiscrepancy": 1,
            "beneficiaryCount": 10,
            "timeSinceLastDistributionDays": 0.5,
            "ratioToAvailableStock": 0.95
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert data["riskLevel"] == "CRITICAL"
    assert "RULE-001" in data["reasonCodes"]
    assert "RULE-002" in data["reasonCodes"]
    assert "RULE-003" in data["reasonCodes"]
    assert "RULE-004" in data["reasonCodes"]
