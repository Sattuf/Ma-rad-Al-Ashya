import os
from motor.motor_asyncio import AsyncIOMotorClient
import asyncpg
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
# docker-compose passes DATABASE_URL (the name every service uses); POSTGRES_URL is kept for
# older deployments. Reading only POSTGRES_URL left the pool empty and every admin call 500.
POSTGRES_URL = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/marad_fraud")

# MongoDB connections
mongo_client = None
mongo_db = None

# Postgres connections
pg_pool = None

async def connect_to_mongo():
    global mongo_client, mongo_db
    mongo_client = AsyncIOMotorClient(MONGO_URL)
    mongo_db = mongo_client["fraud_db"]
    print("Connected to MongoDB")

async def close_mongo_connection():
    if mongo_client:
        mongo_client.close()
        print("Closed MongoDB connection")

async def connect_to_postgres():
    global pg_pool
    try:
        pg_pool = await asyncpg.create_pool(POSTGRES_URL)
        
        # Initialize tables if they don't exist
        async with pg_pool.acquire() as conn:
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS fraud_signals (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    signal_type VARCHAR(255) NOT NULL,
                    description TEXT,
                    risk_score FLOAT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        print("Connected to Postgres and ensured table exists")
    except Exception as e:
        print(f"Error connecting to Postgres: {e}")

async def close_postgres_connection():
    if pg_pool:
        await pg_pool.close()
        print("Closed Postgres connection")
