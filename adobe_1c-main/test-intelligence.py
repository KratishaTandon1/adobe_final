#!/usr/bin/env python3
"""
Test script for Enhanced PDF Intelligence features
Tests the intelligent document analysis functionality
"""

import requests
import json
import time
import sys
import os

API_BASE = "http://localhost:8000/api"

def test_api_connection():
    """Test basic API connection"""
    try:
        response = requests.get(f"{API_BASE}/documents", timeout=5)
        return response.status_code == 200
    except:
        return False

def test_intelligent_analysis():
    """Test intelligent analysis endpoint"""
    try:
        # Mock request data
        test_data = {
            "selected_text": "Machine learning algorithms can process large datasets efficiently",
            "current_document_id": 1,
            "max_results": 5
        }
        
        response = requests.post(
            f"{API_BASE}/intelligent-analysis", 
            json=test_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Intelligent analysis working - found {len(result.get('related_snippets', []))} snippets")
            print(f"   Processing time: {result.get('processing_time', 0):.2f}s")
            return True
        elif response.status_code == 503:
            print("⚠️ Enhanced analysis dependencies not installed")
            return False
        else:
            print(f"❌ Analysis failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Analysis test error: {e}")
        return False

def test_document_sections(doc_id=1):
    """Test document sections endpoint"""
    try:
        response = requests.get(f"{API_BASE}/document-sections/{doc_id}", timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            sections = result.get('sections', [])
            print(f"✅ Document sections working - {len(sections)} sections extracted")
            return True
        elif response.status_code == 404:
            print("ℹ️ No document sections found (no documents uploaded yet)")
            return True
        else:
            print(f"❌ Sections test failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Sections test error: {e}")
        return False

def main():
    print("🧪 Testing Enhanced PDF Intelligence Features")
    print("=" * 50)
    
    # Test 1: API Connection
    print("1. Testing API connection...")
    if not test_api_connection():
        print("❌ API not running. Please start the backend first:")
        print("   cd backend && python main.py")
        sys.exit(1)
    print("✅ API connection successful")
    
    # Test 2: Enhanced Dependencies
    print("\n2. Testing enhanced dependencies...")
    try:
        import sentence_transformers
        import fitz
        from sklearn.metrics.pairwise import cosine_similarity
        print("✅ All enhanced dependencies available")
    except ImportError as e:
        print(f"❌ Missing dependencies: {e}")
        print("Run: .\setup-enhanced-intelligence.ps1")
        sys.exit(1)
    
    # Test 3: Intelligent Analysis
    print("\n3. Testing intelligent analysis...")
    if test_intelligent_analysis():
        print("✅ Intelligent analysis functional")
    else:
        print("⚠️ Intelligent analysis not fully functional")
    
    # Test 4: Document Sections
    print("\n4. Testing document sections...")
    if test_document_sections():
        print("✅ Document sections functional")
    
    print("\n🎉 Enhanced PDF Intelligence testing completed!")
    print("\nTo fully test the system:")
    print("1. Start the full application: .\start-app.ps1")
    print("2. Upload multiple PDF documents")
    print("3. Select text in a PDF to see intelligent analysis")

if __name__ == "__main__":
    main()
