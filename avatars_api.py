"""
Avatars API — Image Gen v2 Phase 2.

Avatars are recurring characters / mascots / specific people that
generations should reproduce consistently. Reference-image pattern in v1;
LoRA-trained weights in a later v2.

Spec: wiki/spec/image_gen_v2.md (approved 2026-05-28).

Owner-scoped via Supabase RLS. References uploaded to the `avatar_refs`
storage bucket — see scripts/create_avatar_refs_bucket.py to create it.
"""
import os
import time

from flask import Blueprint, jsonify, request

from sb_helpers import maybe_one, require_user, supabase
from media_gen import generate_for_job

avatars_bp = Blueprint('avatars_v2', __name__, url_prefix='/api/avatars')
# NOTE: prefix is '/api/generate-v2', NOT '/api/generate' — the latter collides
# with content_api's text-generation route and was shadowing it (Forge "Generate
# Content" got "job_type and prompt are required"). No frontend calls this yet.
generate_bp = Blueprint('generate_v2', __name__, url_prefix='/api/generate-v2')

GEN_BUCKET = 'generated_assets'

REF_BUCKET = 'avatar_refs'
REF_ALLOWED_MIMES = {'image/png', 'image/jpeg', 'image/jpg', 'image/webp'}
REF_MAX_BYTES = 10 * 1024 * 1024
MAX_REFS_PER_AVATAR = 20  # spec calls for 10–20 in the LoRA range; cap there


def _owned_avatar(avatar_id, uid):
    return maybe_one(
        supabase().table('avatars')
        .select('*').eq('id', avatar_id).eq('user_id', uid)
    )


@avatars_bp.route('', methods=['GET'])
def list_avatars():
    uid, err = require_user()
    if err:
        return err
    res = (
        supabase().table('avatars').select('*')
        .eq('user_id', uid).order('created_at', desc=True).execute()
    )
    return jsonify({'avatars': res.data or []})


@avatars_bp.route('', methods=['POST'])
def create_avatar():
    """Create an avatar. Multipart form: name, description (optional),
    and zero or more 'files' for reference images (uploaded to avatar_refs)."""
    uid, err = require_user()
    if err:
        return err

    name = (request.form.get('name') or '').strip()
    if not name:
        return jsonify({'error': "form field 'name' required"}), 400
    description = (request.form.get('description') or '').strip() or None

    files = request.files.getlist('files') or ([request.files['file']] if 'file' in request.files else [])
    new_urls, skipped = _upload_refs(uid, None, files)

    sb = supabase()
    row = {
        'user_id': uid,
        'name': name,
        'description': description,
        'reference_image_urls': new_urls,
        'preview_url': new_urls[0] if new_urls else None,
    }
    res = sb.table('avatars').insert(row).execute()
    avatar = res.data[0] if res.data else None
    if not avatar:
        return jsonify({'error': 'insert failed'}), 500
    return jsonify({'avatar': avatar, 'skipped': skipped}), 201


@avatars_bp.route('/<avatar_id>', methods=['PATCH'])
def update_avatar(avatar_id):
    """Update name/description, or add new references via multipart upload.
    For removing a single reference, use DELETE /references."""
    uid, err = require_user()
    if err:
        return err
    avatar = _owned_avatar(avatar_id, uid)
    if not avatar:
        return jsonify({'error': 'avatar not found'}), 404

    patch = {}
    # JSON body for name/description
    body = request.get_json(silent=True) if request.is_json else None
    if body:
        if 'name' in body:
            n = (body['name'] or '').strip()
            if not n:
                return jsonify({'error': 'name cannot be empty'}), 400
            patch['name'] = n
        if 'description' in body:
            patch['description'] = (body['description'] or '').strip() or None

    # Multipart upload of additional references
    new_urls, skipped = [], []
    if request.files:
        existing = list(avatar.get('reference_image_urls') or [])
        new_urls, skipped = _upload_refs(uid, avatar_id, request.files.getlist('files'), existing_count=len(existing))
        if new_urls:
            patch['reference_image_urls'] = existing + new_urls
            if not avatar.get('preview_url') and new_urls:
                patch['preview_url'] = new_urls[0]

    if not patch:
        return jsonify({'error': 'no changes'}), 400

    res = supabase().table('avatars').update(patch).eq('id', avatar_id).eq('user_id', uid).execute()
    updated = res.data[0] if res.data else None
    return jsonify({'avatar': updated, 'added': new_urls, 'skipped': skipped})


@avatars_bp.route('/<avatar_id>/references', methods=['DELETE'])
def remove_reference(avatar_id):
    """Body: { url }. Removes the URL from reference_image_urls.
    Leaves the storage object behind (cheap; GC later if needed)."""
    uid, err = require_user()
    if err:
        return err
    avatar = _owned_avatar(avatar_id, uid)
    if not avatar:
        return jsonify({'error': 'avatar not found'}), 404

    body = request.get_json(silent=True) or {}
    url = (body.get('url') or '').strip()
    if not url:
        return jsonify({'error': 'url required'}), 400

    existing = list(avatar.get('reference_image_urls') or [])
    updated = [u for u in existing if u != url]
    if len(updated) == len(existing):
        return jsonify({'error': 'url not in references'}), 404

    new_preview = avatar.get('preview_url')
    if new_preview == url:
        new_preview = updated[0] if updated else None

    supabase().table('avatars').update({
        'reference_image_urls': updated,
        'preview_url': new_preview,
    }).eq('id', avatar_id).eq('user_id', uid).execute()
    return jsonify({'reference_image_urls': updated, 'preview_url': new_preview})


@avatars_bp.route('/<avatar_id>', methods=['DELETE'])
def delete_avatar(avatar_id):
    uid, err = require_user()
    if err:
        return err
    avatar = _owned_avatar(avatar_id, uid)
    if not avatar:
        return jsonify({'error': 'avatar not found'}), 404
    supabase().table('avatars').delete().eq('id', avatar_id).eq('user_id', uid).execute()
    return jsonify({'ok': True})


# ── helpers ────────────────────────────────────────────────

def _upload_refs(uid, avatar_id, files, existing_count=0):
    """Upload reference files to avatar_refs bucket. Returns (urls, skipped).
    `avatar_id` is None for create (path uses owner_id only at create time)."""
    if not files:
        return [], []
    sb = supabase()
    new_urls = []
    skipped = []
    folder = f"{uid}/{avatar_id}" if avatar_id else f"{uid}/_new"
    for f in files:
        if existing_count + len(new_urls) >= MAX_REFS_PER_AVATAR:
            skipped.append({'name': f.filename, 'reason': 'limit reached'})
            continue
        mime = (f.mimetype or '').lower()
        if mime not in REF_ALLOWED_MIMES:
            skipped.append({'name': f.filename, 'reason': f'unsupported type: {mime}'})
            continue
        data = f.read()
        if not data:
            skipped.append({'name': f.filename, 'reason': 'empty file'})
            continue
        if len(data) > REF_MAX_BYTES:
            skipped.append({'name': f.filename, 'reason': f'exceeds {REF_MAX_BYTES // (1024*1024)}MB'})
            continue
        original = (f.filename or '').lower()
        ext = '.' + original.rsplit('.', 1)[1][:6] if '.' in original else '.png'
        path = f"{folder}/{int(time.time()*1000)}_{os.urandom(3).hex()}{ext}"
        try:
            sb.storage.from_(REF_BUCKET).upload(
                path=path, file=data,
                file_options={'content-type': mime, 'upsert': 'true'},
            )
            url = sb.storage.from_(REF_BUCKET).get_public_url(path)
            new_urls.append(url)
        except Exception as e:
            skipped.append({'name': f.filename, 'reason': f'storage error: {e}'})
    return new_urls, skipped


# ── /api/generate — unified entry for Image Gen v2 ─────────

@generate_bp.route('', methods=['POST'])
def generate():
    """Unified generation entry. Resolves avatar references when avatar_id
    is given, then calls media_gen.generate_for_job and stores the result
    in the generated_assets bucket.

    Body (JSON):
      {
        "job_type": "background" | "hero_art" | "avatar" | "edit" | "safe_commercial",
        "prompt": str,
        "avatar_id": uuid?,            # resolves avatar.reference_image_urls
        "style_ref_urls": [url, ...]?, # extra refs appended to avatar refs
        "width": int = 1080,
        "height": int = 1350,
        "seed": int?
      }

    Returns: { image_url, provider, model, refs_used }
    """
    uid, err = require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}

    job_type = (body.get('job_type') or '').strip()
    prompt = (body.get('prompt') or '').strip()
    if not job_type or not prompt:
        return jsonify({'error': 'job_type and prompt are required'}), 400

    image_refs = []
    avatar_id = body.get('avatar_id')
    if avatar_id:
        avatar = _owned_avatar(avatar_id, uid)
        if not avatar:
            return jsonify({'error': 'avatar not found'}), 404
        image_refs.extend(list(avatar.get('reference_image_urls') or []))

    extra_refs = body.get('style_ref_urls') or []
    if isinstance(extra_refs, list):
        image_refs.extend([str(u) for u in extra_refs if u])

    width = int(body.get('width') or 1080)
    height = int(body.get('height') or 1350)
    seed = body.get('seed')

    try:
        png_bytes, provider, model = generate_for_job(
            job_type, prompt,
            image_refs=image_refs or None,
            width=width, height=height,
            seed=seed,
        )
    except ValueError as e:  # unknown job_type
        return jsonify({'error': str(e)}), 400
    except RuntimeError as e:  # missing FAL_KEY
        return jsonify({'error': str(e)}), 503
    except Exception as e:
        return jsonify({'error': f'generation failed: {e}'}), 502

    # Store in generated_assets bucket
    sb = supabase()
    path = f"{uid}/{int(time.time()*1000)}_{os.urandom(3).hex()}.png"
    try:
        sb.storage.from_(GEN_BUCKET).upload(
            path=path, file=png_bytes,
            file_options={'content-type': 'image/png', 'upsert': 'true'},
        )
        image_url = sb.storage.from_(GEN_BUCKET).get_public_url(path)
    except Exception as e:
        return jsonify({'error': f'storage failed: {e}'}), 500

    return jsonify({
        'image_url': image_url,
        'provider': provider,
        'model': model,
        'refs_used': len(image_refs),
    })
