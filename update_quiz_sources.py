import json
import sys
from pathlib import Path
from time import sleep
from typing import Any

import requests
import yt_dlp
from requests.exceptions import HTTPError
from yt_dlp.utils import DownloadError

# --- CONFIGURATION DES CHEMINS (Pathlib) ---
MAIN_PATH = Path(__file__).parent.resolve()
MAIN_JSON_PATH = MAIN_PATH / "frontend" / "myjson"
STATE_FILE_PATH = MAIN_JSON_PATH / "transcripts" / "current_state.json"

AVAILABLE_LANGUAGES: dict[str, dict[str, Any]] = {
    "French": {
        "path": MAIN_JSON_PATH / "transcripts" / "French",
        "language": "fr",
        "automatic": True,
    },
    "English": {
        "path": MAIN_JSON_PATH / "transcripts" / "English",
        "language": "en",
        "automatic": True,
    },
}


def load_current_state() -> dict[str, dict[str, list[str]]]:
    """Charge le fichier current_state.json s'il existe."""
    if STATE_FILE_PATH.exists():
        try:
            with open(STATE_FILE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Erreur lors de la lecture de {STATE_FILE_PATH.name} : {e}")

    return {lang: {"manual": [], "automatic": []} for lang in AVAILABLE_LANGUAGES}


def save_current_state(state: dict[str, dict[str, list[str]]]) -> None:
    """Sauvegarde l'état actuel dans current_state.json."""
    STATE_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=4)


def update_state(state: dict, lang_name: str, title: str, is_manual: bool) -> None:
    """Met à jour les listes manual/automatic dans current_state.json sans doublons."""
    if lang_name not in state:
        state[lang_name] = {"manual": [], "automatic": []}

    target_cat = "manual" if is_manual else "automatic"
    other_cat = "automatic" if is_manual else "manual"

    if title in state[lang_name][other_cat]:
        state[lang_name][other_cat].remove(title)

    if title not in state[lang_name][target_cat]:
        state[lang_name][target_cat].append(title)


def is_video_already_processed(video_id: str) -> bool:
    """Vérifie si le fichier existe et contient une transcription valide."""
    for lang_cfg in AVAILABLE_LANGUAGES.values():
        file_path = lang_cfg["path"] / f"{video_id}.json"
        if not file_path.exists():
            return False
        
        # Vérification du contenu du fichier
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                # On vérifie qu'il y a au moins une clé avec une liste non vide
                content = list(data.values())[0] if data else None
                if not content or not isinstance(content, list):
                    return False
        except Exception:
            return False

    return True


def get_channel(name: str, output_path: Path) -> None:
    """Récupère l'index des vidéos d'une chaîne via l'API yt-dlp."""
    ydl_opts: dict[str, str | bool] = {
        "extract_flat": "in_playlist",
        "dump_single_json": True,
        "quiet": True,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/@{name}", download=False)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(info, f, ensure_ascii=False, indent=4)


def load_all_videos_from_channel_json(json_file: Path) -> list[dict[str, str]]:
    """Extrait l'ID et le titre des vidéos depuis le fichier JSON de la chaîne."""
    with open(json_file, encoding="utf-8") as f:
        data = json.load(f)

    all_videos: list[dict[str, str]] = []
    entries = data.get("entries", [])
    playlist = entries[0] if entries else {}
    playlist_entries = playlist.get("entries", [])

    for video in playlist_entries:
        if video.get("_type") == "url" and video.get("ie_key") == "Youtube" and video.get("id"):
            all_videos.append({
                "id": video["id"],
                "title": video.get("title", "Titre inconnu")
            })
    return all_videos


def improve_transcript(trans: list[dict[str, Any]] | None) -> None:
    """Découpe les lignes avec des sauts de ligne '\\n' et ajuste les timestamps sur place."""
    if not trans:
        return

    bettertrans: list[dict[str, Any]] = []
    for item in trans:
        ligne = str(item["text"])
        parties = ligne.split("\n")
        duration = float(item["duration"])
        start = float(item["start"])

        modified_duration = round(duration / len(parties), 3)
        for j, part in enumerate(parties):
            bettertrans.append({
                "text": part,
                "start": round(start + modified_duration * j, 3),
                "duration": modified_duration
            })

    trans[:] = bettertrans


def find_subtitle_track(sub_dict: dict[str, Any], lang_code: str) -> list[dict[str, Any]] | None:
    """Recherche flexible d'une langue (supporte 'fr', 'fr-FR', 'en-US', etc.)."""
    if not sub_dict:
        return None
    if lang_code in sub_dict:
        return sub_dict[lang_code]
    for key, tracks in sub_dict.items():
        if key.startswith(lang_code):
            return tracks
    return None


def fetch_transcripts_for_video(video_id: str) -> dict[str, dict[str, Any]]:
    """Récupère les sous-titres et indique s'ils sont manuels ou automatiques."""
    ydl_opts = {
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitleslangs": ["fr*", "en*"],
        "subtitlesformat": "json3",
        "quiet": True,
    }

    results: dict[str, dict[str, Any]] = {}

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://youtube.com/watch?v={video_id}", download=False)
        subtitles = info.get("subtitles", {})
        automatic_captions = info.get("automatic_captions", {})

        for lang_key, lang_cfg in AVAILABLE_LANGUAGES.items():
            lang_code = str(lang_cfg["language"])
            is_manual = True

            # Recherche prioritaire : manuels puis automatiques
            subtitle_info = find_subtitle_track(subtitles, lang_code)
            if not subtitle_info and lang_cfg.get("automatic", True):
                subtitle_info = find_subtitle_track(automatic_captions, lang_code)
                is_manual = False

            if not subtitle_info:
                print(f"  └─ [{lang_key}] Aucun sous-titre ({lang_code}) disponible.")
                continue

            json3 = next((s for s in subtitle_info if s.get("ext") == "json3"), None)
            if not json3:
                print(f"  └─ [{lang_key}] Format json3 introuvable.")
                continue

            try:
                response = requests.get(json3["url"])
                response.raise_for_status()
                data = response.json()

                transcript: list[dict[str, Any]] = []
                for event in data.get("events", []):
                    if "segs" not in event:
                        continue
                    text = "".join(segment.get("utf8", "") for segment in event["segs"]).strip()
                    if not text:
                        continue
                    start = event.get("tStartMs", 0) / 1000
                    duration = event.get("dDurationMs", 0) / 1000
                    transcript.append({"start": start, "duration": duration, "text": text})

                results[lang_key] = {
                    "transcript": transcript,
                    "is_manual": is_manual
                }
            except HTTPError as e:
                if e.response is not None and e.response.status_code == 429:
                    print(f"\n[ERREUR FATALE] 429 Too Many Requests sur ({lang_key}). Arrêt du script.")
                    sys.exit(1)
                print(f"  └─ [{lang_key}] Erreur HTTP : {e}")
            except Exception as e:
                print(f"  └─ [{lang_key}] Erreur lors du téléchargement : {e}")

    return results


def save_transcript(lang_key: str, transcript: dict[str, Any], filename: str) -> None:
    folder_path = Path(str(AVAILABLE_LANGUAGES[lang_key]["path"]))
    folder_path.mkdir(parents=True, exist_ok=True)

    file_path = folder_path / filename
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(transcript, f, ensure_ascii=False, indent=4)

    index_path = folder_path / "index.json"
    index: list[str] = []
    if index_path.exists():
        with open(index_path, "r", encoding="utf-8") as f:
            index = json.load(f)

    if filename not in index:
        index.append(filename)
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=4)


def get_save_transcripts(video_list: list[dict[str, str]]) -> None:
    state = load_current_state()

    for video in video_list:
        vid = video["id"]
        title = video["title"]

        if is_video_already_processed(vid):
            print(f"{title} déjà complet, on passe")
            continue

        print(f"Pause de 320s avant la prochaine requête YouTube pour {title}...\n")
        sleep(320)
        print(f"Traitement : {title} ({vid})...")

        try:
            transcripts_by_lang = fetch_transcripts_for_video(vid)

            for lang_key, data in transcripts_by_lang.items():
                transcript = data["transcript"]
                is_manual = data["is_manual"]

                improve_transcript(transcript)
                save_transcript(lang_key, {title: transcript}, f"{vid}.json")
                
                update_state(state, lang_key, title, is_manual)
                save_current_state(state)

                mode_str = "Manuel" if is_manual else "Automatique"
                print(f"  └─ [{lang_key}] Sauvegardé avec succès ({mode_str}).")

        except DownloadError as e:
            if "429" in str(e) or "Too Many Requests" in str(e):
                print(f"\n[ERREUR FATALE] 429 interceptée par yt-dlp sur {vid}. Arrêt immédiat.")
                sys.exit(1)
            print(f"Erreur yt-dlp sur {vid} : {e}")

        except Exception as e:
            print(f"Erreur globale sur {vid} : {e}")


if __name__ == "__main__":
    channel_file = MAIN_JSON_PATH / "videos.json"
    get_channel("TheGreatReview", channel_file)

    videos = load_all_videos_from_channel_json(channel_file)
    print(f"{len(videos)} vidéos extraites.\n")

    get_save_transcripts(videos)
    print("Transcriptions et état sauvegardés.")