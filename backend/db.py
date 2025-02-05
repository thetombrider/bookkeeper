from supabase import create_client
from .config import SUPABASE_URL, SUPABASE_KEY

def get_supabase_client():
    """
    Create and return a Supabase client instance.
    """
    return create_client(SUPABASE_URL, SUPABASE_KEY)

# Create a default client instance
supabase = get_supabase_client() 