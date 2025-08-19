# Enhanced PDF Intelligence Setup for Challenge 1C
# This script installs the enhanced dependencies and sets up the intelligent analysis

Write-Host "🚀 Setting up Enhanced PDF Intelligence for Challenge 1C" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Check if we're in the right directory
if (!(Test-Path "backend")) {
    Write-Host "❌ Please run this script from the challenge-1c root directory" -ForegroundColor Red
    exit 1
}

# Navigate to backend directory
Set-Location backend

Write-Host "📦 Installing enhanced dependencies..." -ForegroundColor Yellow
Write-Host "This may take a few minutes as it downloads ML models..." -ForegroundColor Yellow

# Install dependencies
pip install sentence-transformers PyMuPDF scikit-learn numpy torch

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Dependencies installed successfully!" -ForegroundColor Green

# Run the setup script to download and cache the model
Write-Host "🧠 Setting up semantic model..." -ForegroundColor Yellow
python setup_intelligence.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Model setup failed" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Enhanced PDF Intelligence setup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "New features available:" -ForegroundColor Cyan
Write-Host "• 🔍 Semantic content analysis" -ForegroundColor White
Write-Host "• 🔗 Related content detection" -ForegroundColor White
Write-Host "• ⚠️ Contradictory content identification" -ForegroundColor White
Write-Host "• ✅ Supporting evidence finding" -ForegroundColor White
Write-Host "• ⚡ Fast section navigation" -ForegroundColor White
Write-Host ""
Write-Host "You can now run your enhanced PDF viewer:" -ForegroundColor Yellow
Write-Host "  .\start-app.ps1" -ForegroundColor Green

# Return to root directory
Set-Location ..
