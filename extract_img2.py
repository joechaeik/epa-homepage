import json
import base64
import os
import sys
import re

fpath = r'C:\Users\joech\.claude\projects\C--Claude-Code-KENTECH\84de5955-24ce-49b4-9959-9c8c63f7c8d4.jsonl'
out_dir = r'C:\Claude Code_KENTECH\images\gallery'
log_file = r'C:\Claude Code_KENTECH\extract_log.txt'

os.makedirs(out_dir, exist_ok=True)
saved = []

with open(log_file, 'w', encoding='utf-8') as log:
    log.write("Starting extraction...\n")
    log.flush()

    with open(fpath, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            # Only process lines that are likely to have image data
            if '"type":"image"' not in line and '"media_type":"image' not in line:
                continue

            log.write(f"Processing line {line_num}, length={len(line)}\n")
            log.flush()

            try:
                obj = json.loads(line)

                def find_images(node, depth=0):
                    if depth > 50:
                        return
                    if isinstance(node, dict):
                        t = node.get('type', '')
                        if t == 'image':
                            src = node.get('source', {})
                            st = src.get('type', '')
                            if st == 'base64':
                                mt = src.get('media_type', 'image/jpeg')
                                data = src.get('data', '')
                                ext = 'jpg'
                                if 'png' in mt: ext = 'png'
                                elif 'gif' in mt: ext = 'gif'
                                elif 'webp' in mt: ext = 'webp'
                                outpath = os.path.join(out_dir, f'photo_{line_num}.{ext}')
                                img_bytes = base64.b64decode(data)
                                with open(outpath, 'wb') as img_f:
                                    img_f.write(img_bytes)
                                saved.append(outpath)
                                log.write(f"SAVED: {outpath} ({len(img_bytes)} bytes)\n")
                                log.flush()
                            elif st == 'url':
                                url = src.get('url', '')
                                log.write(f"URL image found: {url[:100]}\n")
                                log.flush()
                        for v in node.values():
                            find_images(v, depth+1)
                    elif isinstance(node, list):
                        for item in node:
                            find_images(item, depth+1)

                find_images(obj)

            except Exception as e:
                log.write(f"Error on line {line_num}: {e}\n")
                log.flush()

    log.write(f"\nDone! Total saved: {len(saved)}\n")
    for p in saved:
        log.write(f"  {p}\n")
