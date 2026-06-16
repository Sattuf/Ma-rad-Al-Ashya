import os
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest

def train_model():
    print("Generating synthetic data for training...")
    
    # Generate normal transactions
    n_normal = 5000
    normal_amounts = np.random.normal(50, 20, n_normal)
    normal_mcc = np.random.randint(1, 1000, n_normal)
    normal_country = np.random.randint(1, 100, n_normal)
    
    # Generate anomaly transactions (high amount, strange MCCs)
    n_anomaly = 250
    anomaly_amounts = np.random.normal(5000, 1000, n_anomaly)
    anomaly_mcc = np.random.randint(1, 1000, n_anomaly)
    anomaly_country = np.random.randint(100, 1000, n_anomaly)
    
    amounts = np.concatenate([normal_amounts, anomaly_amounts])
    mccs = np.concatenate([normal_mcc, anomaly_mcc])
    countries = np.concatenate([normal_country, anomaly_country])
    
    # Add absolute values to avoid negative amounts
    amounts = np.abs(amounts)
    
    df = pd.DataFrame({
        "amount": amounts,
        "mcc": mccs,
        "country": countries
    })
    
    print("Training IsolationForest model...")
    model = IsolationForest(contamination=0.05, random_state=42)
    model.fit(df)
    
    model_path = os.path.join(os.path.dirname(__file__), "anomaly_model.pkl")
    joblib.dump(model, model_path)
    print(f"Model saved to {model_path}")
    
    return model_path

if __name__ == "__main__":
    train_model()
