import json
from pathlib import Path
from time import sleep
from typing import Any, cast

import requests
import yt_dlp

# --- CONFIGURATION DES CHEMINS (Pathlib) ---
MAIN_PATH = Path(__file__).parent.resolve()
MAIN_JSON_PATH = MAIN_PATH / "frontend" / "myjson"

AVAILABLE_LANGUAGES: dict[str, dict[str, Any]] = {
    "autofrench": {
        "path": MAIN_JSON_PATH / "transcripts" / "AutoFrench",
        "language": "fr",
        "automatic": True,
    },
    "manufrench": {
        "path": MAIN_JSON_PATH / "transcripts" / "ManuFrench",
        "language": "fr",
        "automatic": False,
    },
    "manuenglish": {
        "path": MAIN_JSON_PATH / "transcripts" / "ManuEnglish",
        "language": "en",
        "automatic": False,
    },
}

CHOSEN_LANGUAGE = "autofrench"


def get_channel(name: str, output_path: Path) -> None:
    """Récupère l'index des vidéos d'une chaîne via l'API yt-dlp."""
    ydl_opts :dict[str,str|bool]= {
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

    # Mutation sur place
    trans[:] = bettertrans


def get_transcript(video_id: str) -> list[dict[str, Any]]:
    lang_cfg = AVAILABLE_LANGUAGES[CHOSEN_LANGUAGE]
    lang = str(lang_cfg["language"])

    ydl_opts = {
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": bool(lang_cfg["automatic"]),
        "subtitleslangs": [lang],
        "subtitlesformat": "json3",
        "quiet": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://youtube.com/watch?v={video_id}", download=False)
        subtitles = info.get("subtitles", {})
        automatic_captions = info.get("automatic_captions", {})

        if lang in subtitles:
            subtitle_info = subtitles[lang]
        elif lang in automatic_captions:
            subtitle_info = automatic_captions[lang]
        else:
            raise ValueError(f"Aucun sous-titre ({lang}) disponible pour la vidéo {video_id}.")

        json3 = next((s for s in subtitle_info if s.get("ext") == "json3"), None)
        if not json3:
            raise ValueError("Format json3 introuvable.")

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

    return transcript


def save_transcript(transcript: dict[str, Any], filename: str = "transcripts.json") -> None:
    folder_path = Path(str(AVAILABLE_LANGUAGES[CHOSEN_LANGUAGE]["path"]))
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
    for video in video_list:
        vid = video["id"]
        title = video["title"]
        print(f"Récupération du transcript de {title} ({vid})...")
        try:
            transcript = get_transcript(vid)
            improve_transcript(transcript)
            save_transcript({title: transcript}, f"{vid}.json")
        except Exception as e:
            print(f"Erreur lors de la récupération de {vid} : {e}")

        print("Pause de 30s...")
        sleep(30)


if __name__ == "__main__":
    channel_file = MAIN_JSON_PATH / "videos.json"
    get_channel("TheGreatReview", channel_file)

    videos = load_all_videos_from_channel_json(channel_file)
    print(f"{len(videos)} vidéos extraites.")

    get_save_transcripts(videos)
    print("Transcriptions sauvegardées.")