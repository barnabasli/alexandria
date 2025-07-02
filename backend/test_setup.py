import os
from dotenv import load_dotenv

load_dotenv()

def test_database_connection():
    """Test database connection"""
    try:
        from database import engine
        print("Database connection successful")
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False

def test_supabase_env():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")
    
    if supabase_url and supabase_key:
        print("Supabase environment variables are set")
        return True
    else:
        print("Supabase environment variables are missing")
        print("   Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file")
        return False

def test_openai_env():
    openai_key = os.getenv("OPENAI_API_KEY")
    
    if openai_key:
        print("OpenAI API key is set")
        return True
    else:
        print("OpenAI API key is missing!")
        print("   Please set OPENAI_API_KEY in your .env file")
        return False

def main():
    print("🔍 Testing PaperQA Setup...")
    print("=" * 40)
    
    tests = [
        test_database_connection,
        test_supabase_env,
        test_openai_env
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print("=" * 40)
    print(f"📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("All tests passed")
        print("\nNext steps:")
        print("1. Start the server: uvicorn app:app --reload")
        print("2. Open frontend/index.html in your browser")
        print("3. Register a new account")
    else:
        print("Some tests failed")

if __name__ == "__main__":
    main() 