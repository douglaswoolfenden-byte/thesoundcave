"""
The Sound Cave — Content Generation API
Lightweight Flask server that calls Claude API to generate music industry content.
Run: python content_api.py
"""
import os
import json
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import anthropic
import requests as http_requests

# Load .env from workspace root (one level up from project)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__)
CORS(app)

client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

# ── Content type templates ──────────────────────────────────
TEMPLATES = {
    'ig_reel': {
        'instruction': 'Write an Instagram Reel caption for a dance music audience. Use line breaks for readability. Include 3-5 relevant hashtags at the end. Keep it punchy and authentic — no corporate tone.',
        'max_tokens': 400,
    },
    'ig_carousel': {
        'instruction': 'Write Instagram carousel slide text (one paragraph per slide, separated by ---). First slide is the hook. Last slide is the CTA. 4-6 slides total. Include hashtags after the last slide.',
        'max_tokens': 600,
    },
    'tiktok': {
        'instruction': 'Write a TikTok caption. Very short, punchy, with 2-3 hashtags. Under 300 characters. Match the energy of underground dance music culture.',
        'max_tokens': 150,
    },
    'x_post': {
        'instruction': 'Write a tweet (under 280 characters). Direct, opinionated, no hashtag spam. Sound like someone in the scene, not a brand.',
        'max_tokens': 100,
    },
    'yt_short': {
        'instruction': 'Write a YouTube Shorts description. Brief hook line, then 2-3 sentences of context. Include relevant tags at the end.',
        'max_tokens': 300,
    },
    'lineup_copy': {
        'instruction': 'Write lineup announcement copy for an event poster or social post. Build hype. List the artists with flair. Include date/venue if provided. Create urgency.',
        'max_tokens': 500,
    },
    'aftermovie': {
        'instruction': 'Write a short script/voiceover for an aftermovie (30-60 seconds). Evocative, atmospheric, captures the feeling of the night. Use short poetic lines.',
        'max_tokens': 400,
    },
    'teaser': {
        'instruction': 'Write teaser copy for an upcoming event. Create intrigue without revealing everything. Dark, moody, minimal. Make people want to know more.',
        'max_tokens': 300,
    },
    'pre_release': {
        'instruction': 'Write a pre-release teaser for an upcoming music release. Build anticipation. Hint at the sound without giving it all away. Include a call to pre-save.',
        'max_tokens': 400,
    },
    'premiere': {
        'instruction': 'Write a premiere pitch email to a music blog or YouTube channel. Professional but warm. Explain why this track matters. Include key stats if available. Keep it concise — editors are busy.',
        'max_tokens': 500,
    },
    'dj_support': {
        'instruction': 'Write a DJ support roundup post. Celebrate the DJs who have been playing the release. Thank them by name. Create social proof for the release.',
        'max_tokens': 400,
    },
    'artist_bio': {
        'instruction': 'Write an artist bio/spotlight. Third person, 2-3 paragraphs. Cover their sound, journey, and what makes them distinctive. Suitable for press kit or website.',
        'max_tokens': 600,
    },
    'press': {
        'instruction': 'Write a press release for a music release or event. Professional format: headline, subhead, 3-4 paragraphs, boilerplate. Include quotes placeholder. Formal but not stiff.',
        'max_tokens': 800,
    },
    'newsletter': {
        'instruction': 'Write a newsletter roundup covering recent discoveries, releases, or events. Conversational tone, like writing to a friend who trusts your taste. 3-5 items with brief commentary.',
        'max_tokens': 700,
    },
    'mix_desc': {
        'instruction': 'Write a mix description for SoundCloud or Mixcloud. Set the scene — what vibe, what journey. Mention key tracks or moments if context provided. 2-3 paragraphs.',
        'max_tokens': 400,
    },
    'playlist_desc': {
        'instruction': 'Write a playlist description. Brief, evocative, tells the listener what mood or journey to expect. 2-4 sentences.',
        'max_tokens': 200,
    },
}

VARIATION_PROMPTS = {
    'shorter': 'Make this significantly shorter while keeping the core message and tone. Cut the fluff.',
    'longer': 'Expand this with more detail, context, or atmosphere. Keep the same tone and style.',
    'tone': 'Rewrite this with a different tone — if it was hype, make it understated. If formal, make it casual. Keep the same information.',
}

SYSTEM_PROMPT = """You are a content creator embedded in the European underground electronic music scene. You write for artists, labels, and event promoters.

Your voice:
- Authentic, never corporate or try-hard
- You know the difference between techno and tech house
- You reference the culture naturally — Boiler Room, Resident Advisor, Bandcamp Fridays, dark rooms, 4am moments
- You write like someone who actually goes to the events, not someone marketing them from outside
- No cringe, no over-hype, no generic influencer language
- British English spelling

Adapt your register to the content type — a TikTok caption hits different from a press release."""


def build_user_prompt(ctx):
    """Build the user prompt from the request context."""
    content_type = ctx.get('content_type', 'ig_reel')
    template = TEMPLATES.get(content_type, TEMPLATES['ig_reel'])

    parts = [template['instruction']]

    # Artist context
    artist_data = ctx.get('artist_data')
    if artist_data:
        name = artist_data.get('name', 'Unknown')
        genre = artist_data.get('genre', '')
        followers = artist_data.get('followers')
        parts.append(f"\nArtist: {name}")
        if genre:
            parts.append(f"Genre: {genre}")
        if followers:
            parts.append(f"Followers: {followers:,}")

    artist_list = ctx.get('artist_list')
    if artist_list:
        parts.append(f"\nLineup:\n{artist_list}")

    event = ctx.get('event')
    if event:
        parts.append(f"\nEvent: {event}")

    release = ctx.get('release')
    if release:
        parts.append(f"\nRelease: {release}")

    freeform = ctx.get('freeform')
    if freeform:
        parts.append(f"\nAdditional context: {freeform}")

    # Handle variations
    variation = ctx.get('variation')
    if variation and variation in VARIATION_PROMPTS:
        existing = ctx.get('existing_content', '')
        if existing:
            parts.append(f"\n\nHere is the existing content to modify:\n\"\"\"\n{existing}\n\"\"\"\n\n{VARIATION_PROMPTS[variation]}")

    return '\n'.join(parts)


@app.route('/api/health', methods=['GET'])
def health():
    has_key = bool(os.getenv('ANTHROPIC_API_KEY'))
    return jsonify({'status': 'ok', 'has_api_key': has_key})


@app.route('/api/generate', methods=['POST'])
def generate():
    ctx = request.get_json()
    if not ctx:
        return jsonify({'error': 'No JSON body provided'}), 400

    content_type = ctx.get('content_type', 'ig_reel')
    template = TEMPLATES.get(content_type, TEMPLATES['ig_reel'])

    user_prompt = build_user_prompt(ctx)

    try:
        message = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=template.get('max_tokens', 500),
            system=SYSTEM_PROMPT,
            messages=[{'role': 'user', 'content': user_prompt}]
        )
        content = message.content[0].text
        return jsonify({
            'content': content,
            'content_type': content_type,
            'tokens_used': message.usage.input_tokens + message.usage.output_tokens,
            'model': message.model
        })
    except anthropic.APIError as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv('CONTENT_API_PORT', 8000))
    print(f"🪨 Firepit Content API running on http://localhost:{port}")
    print(f"   API key configured: {'Yes' if os.getenv('ANTHROPIC_API_KEY') else 'No — set ANTHROPIC_API_KEY in .env'}")
    app.run(host='0.0.0.0', port=port, debug=True)
