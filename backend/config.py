import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

# Validate configuration
if not all([SUPABASE_URL, SUPABASE_KEY, SUPABASE_SECRET_KEY]):
    raise ValueError("Missing required environment variables for Supabase configuration") 