import sys
import os

# Add server directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'server'))

try:
    # Try importing main module directly since it is in server/
    import main
    from app.core.config import settings
    from app.services.supabase_svc import supabase_service
    from app.services.openai_svc import openai_service
    from app.services.storage_service import storage_service
    print("Imports successful!")
except Exception as e:
    print(f"Import failed: {e}")
    sys.exit(1)
