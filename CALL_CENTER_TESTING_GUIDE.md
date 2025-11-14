# Call Center Testing Guide - Quick Start

## Overview

This guide will help you test your Amazon Connect call center with AI features (transcription, summarization, knowledge base) similar to the interface you showed.

## Quick Test Options

### Option 1: Test in Browser (Fastest - No AWS Setup)

I'll create a simple test interface where you can:
- Record audio from your microphone
- Simulate a call
- See transcription
- Get AI summary
- Test knowledge base queries

**Steps:**
1. I'll create a test page at `/test-call-center`
2. Click "Test Audio" button
3. Speak your incident description
4. See real-time transcription and AI summary

### Option 2: Amazon Connect Test Call (Full Integration)

**Prerequisites:**
- AWS Account
- Amazon Connect instance (15 min setup)
- Phone number

**Quick Setup:**
```bash
# 1. Deploy infrastructure
cd infrastructure
pnpm run deploy

# 2. Create Connect instance (AWS Console)
# Go to: https://console.aws.amazon.com/connect/
# Click "Create instance"
# Follow wizard (5 minutes)

# 3. Claim phone number
# In Connect console → Channels → Phone numbers
# Click "Claim a number"
# Choose toll-free or DID

# 4. Test call
# Dial your Connect number
# Speak: "I have a flat tire on I-95"
# System will transcribe and create incident
```

## What I'll Build for You Now

Let me create a **browser-based test interface** so you can test immediately without AWS setup:

### Features:
1. **Test Audio** - Record from microphone
2. **Knowledge Base** - Test RAG queries
3. **Speech Settings** - Configure voice
4. **Realtime Transcription** - See live text
5. **Call Settings** - Configure behavior
6. **Post-Call Analysis** - View AI summary
7. **Security & Fallback** - Error handling
8. **Webhook Settings** - Integration testing

### Test Scenarios:
- "I have a flat tire on I-95 mile marker 120"
- "My engine is overheating, temperature gauge is red"
- "I need a tow truck, vehicle won't start"
- "Electrical issue, dashboard lights flickering"

## Let me create this for you now...

