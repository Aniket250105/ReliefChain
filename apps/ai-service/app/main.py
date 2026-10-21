from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List
import numpy as np
try:
    from sklearn.ensemble import IsolationForest
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

app = FastAPI(title="ReliefChain AI Service")

class AnalyzeRequest(BaseModel):
    entityId: str
    entityType: str
    features: Dict[str, float]

class AnalyzeResponse(BaseModel):
    anomalyScore: float | None
    modelAvailable: bool
    configuredThreshold: float
    riskLevel: str
    reasonCodes: List[str]
    triggeredRules: List[str]
    modelVersion: str
    featureSetVersion: str

MODEL_VERSION = "isolation-forest-v1"
FEATURE_SET_VERSION = "feature-set-v1"
ANOMALY_THRESHOLD = -0.5 # Isolation Forest returns negative scores for anomalies

# A simple isolation forest model trained on dummy data for MVP
# Features: [quantity, discrepancy, beneficiaries, time_days, ratio]
dummy_X = np.array([
    [100, 0, 10, 5, 0.1],
    [50, 0, 5, 10, 0.05],
    [200, 0, 20, 2, 0.2],
    [150, 0, 15, 3, 0.15],
    [80, 0, 8, 7, 0.08],
])
iso_forest = None
if SKLEARN_AVAILABLE:
    iso_forest = IsolationForest(contamination=0.1, random_state=42)
    iso_forest.fit(dummy_X)

def rule_engine(features: Dict[str, float]) -> List[str]:
    triggered_rules = []
    
    qty = features.get("distributionQuantity", 0)
    discrepancy = features.get("inventoryDiscrepancy", 0)
    time_days = features.get("timeSinceLastDistributionDays", 100)
    ratio = features.get("ratioToAvailableStock", 0)
    
    if qty > 5000:
        triggered_rules.append("RULE-002: Distribution Exceeds Expected Range")
    
    if discrepancy > 0:
        triggered_rules.append("RULE-003: Inventory Discrepancy")
        
    if time_days < 1 and qty > 1000:
        triggered_rules.append("RULE-001: Velocity Exceeded")
        
    if ratio > 0.9:
        triggered_rules.append("RULE-004: Critical Stock Depletion Risk")
        
    return triggered_rules

def calculate_risk_level(score: float, rules_triggered: int) -> str:
    if score < -0.7 or rules_triggered >= 2:
        return "CRITICAL"
    elif score < -0.5 or rules_triggered == 1:
        return "HIGH"
    elif score < -0.3:
        return "MEDIUM"
    return "LOW"

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    features_list = [
        request.features.get("distributionQuantity", 0),
        request.features.get("inventoryDiscrepancy", 0),
        request.features.get("beneficiaryCount", 0),
        request.features.get("timeSinceLastDistributionDays", 100),
        request.features.get("ratioToAvailableStock", 0)
    ]
    
    # Ensure consistent deterministic feature ordering
    X = np.array([features_list])
    
    reason_codes = []
    
    # Safe behavior for insufficient training data or empty datasets
    if iso_forest:
        try:
            score = float(iso_forest.score_samples(X)[0])
            model_available = True
        except Exception as e:
            score = None
            model_available = False
            reason_codes.append("MODEL-ERROR")
    else:
        score = None
        model_available = False
        reason_codes.append("MODEL-UNAVAILABLE")

    triggered_rules = rule_engine(request.features)
    risk_level = calculate_risk_level(score if score is not None else 0.0, len(triggered_rules))
    
    for rule in triggered_rules:
        reason_codes.append(rule.split(":")[0])
        
    if score is not None and score < ANOMALY_THRESHOLD and risk_level in ["HIGH", "CRITICAL"]:
        reason_codes.append("MODEL-ANOMALY")
        
    return AnalyzeResponse(
        anomalyScore=score,
        modelAvailable=model_available,
        configuredThreshold=ANOMALY_THRESHOLD,
        riskLevel=risk_level,
        reasonCodes=reason_codes,
        triggeredRules=triggered_rules,
        modelVersion=MODEL_VERSION,
        featureSetVersion=FEATURE_SET_VERSION
    )

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ReliefChain AI"}
