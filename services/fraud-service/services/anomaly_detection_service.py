import logging
import os
import joblib
import pandas as pd
import database
from schemas import TransactionAnalyzeRequest, TransactionAnalyzeResponse

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ml", "anomaly_model.pkl")
model = None
logger = logging.getLogger("fraud.anomaly")

def load_model():
    global model
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        logger.info("Loaded anomaly detection model")
    else:
        logger.warning("Anomaly detection model not found. Call train endpoint first.")

# Run once at startup
load_model()

async def analyze_transaction(request: TransactionAnalyzeRequest) -> TransactionAnalyzeResponse:
    global model
    
    # Simple feature extraction
    # In a real scenario, we might use MCC or country embeddings, but for basic IsolationForest,
    # let's map MCC and country to some numeric hashes or use amount as primary feature.
    
    amount = float(request.amount)
    
    # Convert MCC to numeric hash-like feature
    mcc_numeric = hash(request.merchant_category_code) % 1000
    # Convert Country to numeric hash-like feature
    country_numeric = hash(request.location_country) % 1000
    
    features = pd.DataFrame([{
        "amount": amount,
        "mcc": mcc_numeric,
        "country": country_numeric
    }])
    
    is_anomaly = False
    anomaly_score = 0.0
    message = "Transaction appears normal."
    
    if model:
        # IsolationForest returns -1 for outliers and 1 for inliers
        prediction = model.predict(features)[0]
        # score_samples returns opposite of anomaly score (lower is more anomalous)
        # sklearn IsolationForest negative outlier factor
        score = model.score_samples(features)[0] 
        
        # Normalize score somewhat for response (0 to 1, higher is more anomalous)
        # IF score usually between -1.0 and 0.5. Let's do simple mapping.
        anomaly_score = float(-score)
        
        if prediction == -1:
            is_anomaly = True
            message = "Anomaly detected in transaction patterns."
    else:
        message = "Model not loaded. Defaulting to normal."
        
    # Features and, for an anomaly, the signal: one round trip, one transaction.
    async with database.pg_pool.acquire() as conn:
        await conn.execute(
            '''
            WITH features AS (
              INSERT INTO transaction_features
                (transaction_id, user_id, amount, mcc, country, is_anomaly, anomaly_score)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            )
            INSERT INTO fraud_signals (user_id, signal_type, description, risk_score)
            SELECT $2, 'TRANSACTION_ANOMALY', $8, $9 WHERE $6
            ''',
            request.transaction_id,
            request.user_id,
            amount,
            request.merchant_category_code,
            request.location_country,
            is_anomaly,
            anomaly_score,
            message,
            float(min(1.0, max(0.5, anomaly_score))),
        )
            
    return TransactionAnalyzeResponse(
        is_anomaly=is_anomaly,
        anomaly_score=anomaly_score,
        message=message
    )
