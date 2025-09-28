#!/bin/bash

# ExitZero Setup Script
# This script helps set up the development environment

set -e

echo "🚀 Setting up ExitZero..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local from template..."
    cp env.example .env.local
    echo "⚠️  Please fill in your environment variables in .env.local"
    echo "   Required: Supabase, Stripe, AI API keys"
else
    echo "✅ .env.local already exists"
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "📦 Installing Supabase CLI..."
    npm install -g supabase
else
    echo "✅ Supabase CLI already installed"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Fill in your environment variables in .env.local"
echo "2. Set up your Supabase project and run the schema:"
echo "   cat supabase-schema.sql"
echo "3. Configure Stripe webhooks:"
echo "   https://your-domain.com/api/webhooks/stripe"
echo "4. Start the development server:"
echo "   npm run dev"
echo ""
echo "📚 Documentation: README.md"
echo "🐛 Issues: https://github.com/your-username/exit-zero/issues"
echo ""
echo "Happy coding! 🚀"
