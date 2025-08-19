#!/usr/bin/env python3
"""
Enhanced PDF Intelligence Setup Script for Challenge 1C
This script downloads and caches the semantic model required for intelligent analysis
"""

import os
import sys
from pathlib import Path

def main():
    print("🚀 Setting up Enhanced PDF Intelligence for Challenge 1C")
    print("=" * 60)
    
    try:
        # Import required libraries
        print("📦 Checking dependencies...")
        import sentence_transformers
        import fitz  # PyMuPDF
        from sklearn.metrics.pairwise import cosine_similarity
        print("✅ All dependencies are available")
        
        # Load and cache the model
        print("🧠 Loading semantic model...")
        from sentence_transformers import SentenceTransformer
        
        model_name = 'all-MiniLM-L6-v2'
        print(f"📥 Downloading/caching model: {model_name}")
        
        model = SentenceTransformer(model_name)
        print(f"✅ Model loaded successfully: {model_name}")
        
        # Test the model
        print("🧪 Testing model functionality...")
        test_sentences = ["This is a test sentence.", "Another test sentence about documents."]
        embeddings = model.encode(test_sentences)
        print(f"✅ Model test passed - generated embeddings: {embeddings.shape}")
        
        print("\n🎉 Enhanced PDF Intelligence setup completed successfully!")
        print("\nFeatures now available:")
        print("• 🔍 Semantic content analysis")
        print("• 🔗 Related content detection")
        print("• ⚠️ Contradictory content identification") 
        print("• ✅ Supporting evidence finding")
        print("• ⚡ Fast section navigation")
        
        print(f"\nModel cache location: {model.cache_folder}")
        print("You can now run your enhanced PDF viewer application!")
        
    except ImportError as e:
        print(f"❌ Missing dependencies: {e}")
        print("\nPlease install required packages:")
        print("pip install sentence-transformers PyMuPDF scikit-learn numpy torch")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Setup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
